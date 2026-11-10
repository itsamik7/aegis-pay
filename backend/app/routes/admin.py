import os
import io
import csv
import json
import uuid
import datetime
import zipfile
import xml.etree.ElementTree as ET
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form, Response, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import desc, func, or_

from ..database import get_db
from ..models import (
    User, Merchant, MerchantProfile, MerchantCohort, Transaction, 
    SettlementEvent, CalendarEvent, AuditEvent, ImportBatch, 
    ImportRowRecord, DatasetVersion, PayerToken, Alert, RiskScoreSnapshot
)
from ..auth import get_current_user, require_admin
from ..risk_engine.scorer import evaluate_merchant_risk

router = APIRouter(prefix="/admin", tags=["Admin Portal & Data Ingestion"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

def sanitize_csv_cell(value: Any) -> str:
    """Protect against CSV formula injection."""
    val_str = str(value or "")
    if val_str and val_str[0] in ("=", "+", "-", "@", "\t", "\r"):
        return f"'{val_str}"
    return val_str

# -----------------------------------------------------------------------------
# Data Entry Guide Schemas & Documentation
# -----------------------------------------------------------------------------
DATA_ENTRY_GUIDE = {
    "merchants": {
        "title": "Merchant Entity",
        "description": "Onboards a new retail or online merchant into AEGIS-PAY behaviour monitoring.",
        "fields": [
            {
                "name": "merchant_id",
                "label": "Merchant ID",
                "type": "string",
                "required": True,
                "format": "MER-XXXXXX (or MER-001 format)",
                "rules": "Must start with 'MER-', unique in system, 6-20 characters.",
                "valid_example": "MER-000124",
                "invalid_example": "124, M-001, MER#12",
                "explanation": "Must use the standard prefix to ensure partition indexing."
            },
            {
                "name": "merchant_name",
                "label": "Trading Name",
                "type": "string",
                "required": True,
                "format": "3-255 characters",
                "rules": "Trading store name; non-empty trimmed string.",
                "valid_example": "Sharma Artisanal Bakery",
                "invalid_example": "   ",
                "explanation": "Blank or whitespace-only names are rejected."
            },
            {
                "name": "legal_name",
                "label": "Registered Business Entity",
                "type": "string",
                "required": True,
                "format": "3-255 characters",
                "rules": "Registered LLP, Private Limited, or Sole Proprietorship entity name.",
                "valid_example": "Sharma Food & Confectionery LLP",
                "invalid_example": "N/A",
                "explanation": "Must match legal registration documents."
            },
            {
                "name": "business_category",
                "label": "Business Category",
                "type": "enum",
                "required": True,
                "format": "Select from controlled list",
                "rules": "Bakeries, Confectionery, Restaurants, Retail, Groceries, Electronics, Fashion, Pharmacy, Hospitality, Services",
                "valid_example": "Bakeries",
                "invalid_example": "Gambling / Unknown",
                "explanation": "Arbitrary categories corrupt cohort baseline benchmarking."
            },
            {
                "name": "city",
                "label": "City",
                "type": "string",
                "required": True,
                "format": "City name",
                "rules": "City location of primary storefront or headquarters.",
                "valid_example": "Delhi NCR",
                "invalid_example": "",
                "explanation": "Required for regional cohort assignment."
            },
            {
                "name": "region",
                "label": "Sub-region / Area",
                "type": "string",
                "required": True,
                "format": "Area or neighborhood",
                "rules": "Commercial market or neighborhood locality.",
                "valid_example": "South Extension Part 1",
                "invalid_example": "",
                "explanation": "Used for peer group density comparison."
            },
            {
                "name": "onboarding_date",
                "label": "Onboarding Date",
                "type": "date",
                "required": True,
                "format": "YYYY-MM-DD",
                "rules": "ISO calendar date. Cannot be in the future.",
                "valid_example": "2026-08-15",
                "invalid_example": "15/08/2026, August 15",
                "explanation": "Strict ISO 8601 YYYY-MM-DD required."
            },
            {
                "name": "declared_operating_hours",
                "label": "Declared Operating Hours",
                "type": "string",
                "required": True,
                "format": "HH:MM - HH:MM",
                "rules": "24-hour format string, e.g. 08:00 - 22:00.",
                "valid_example": "08:00 - 22:00",
                "invalid_example": "9am to 9pm, 25:00 - 29:00",
                "explanation": "Timing anomaly engines evaluate transactions against this window."
            },
            {
                "name": "account_status",
                "label": "Account Status",
                "type": "enum",
                "required": True,
                "format": "Controlled enum",
                "rules": "Active, Under Review, Escalated, Suspended, Closed",
                "valid_example": "Active",
                "invalid_example": "Running, Verified",
                "explanation": "Governs whether merchant transactions are processed or held."
            },
            {
                "name": "declared_monthly_volume",
                "label": "Declared Monthly Volume (INR)",
                "type": "number",
                "required": False,
                "format": "Positive float",
                "rules": "Estimated monthly gross turnover in INR (e.g. 150000.0).",
                "valid_example": "150000.00",
                "invalid_example": "-5000, 1.5 Lakh",
                "explanation": "Capacity spike detector triggers on multiples of this baseline."
            },
            {
                "name": "declared_avg_ticket",
                "label": "Declared Avg Ticket (INR)",
                "type": "number",
                "required": False,
                "format": "Positive float",
                "rules": "Expected average transaction size in INR.",
                "valid_example": "180.00",
                "invalid_example": "0, -100",
                "explanation": "Used to establish normal variance boundaries."
            }
        ],
        "sample_record": {
            "merchant_id": "MER-000124",
            "merchant_name": "Sharma Artisanal Bakery",
            "legal_name": "Sharma Food & Confectionery LLP",
            "business_category": "Bakeries",
            "city": "Delhi NCR",
            "region": "South Extension Part 1",
            "onboarding_date": "2026-08-15",
            "declared_operating_hours": "08:00 - 22:00",
            "account_status": "Active",
            "declared_monthly_volume": 180000.0,
            "declared_avg_ticket": 195.0
        }
    },
    "transactions": {
        "title": "Transaction Event",
        "description": "Records individual customer payment collections for behaviour monitoring.",
        "fields": [
            {
                "name": "transaction_id",
                "label": "Transaction ID",
                "type": "string",
                "required": True,
                "format": "TXN-XXXXXX (or TXN- followed by 4-10 digits)",
                "rules": "Unique identifier for transaction.",
                "valid_example": "TXN-00004567",
                "invalid_example": "T123, 4567",
                "explanation": "Required standard format."
            },
            {
                "name": "merchant_id",
                "label": "Merchant ID",
                "type": "string",
                "required": True,
                "format": "Must exist in database",
                "rules": "Foreign key reference to an active or under review merchant.",
                "valid_example": "MER-001-GOLDEN",
                "invalid_example": "MER-999999",
                "explanation": "Rejected if merchant does not exist."
            },
            {
                "name": "transaction_timestamp",
                "label": "Timestamp (ISO 8601)",
                "type": "datetime",
                "required": True,
                "format": "YYYY-MM-DDTHH:MM:SS",
                "rules": "Timestamp of payment authorisation.",
                "valid_example": "2026-11-09T14:32:00",
                "invalid_example": "Yesterday, 14:32 PM",
                "explanation": "Evaluated by night-spike and off-hours signal detectors."
            },
            {
                "name": "amount",
                "label": "Amount (INR)",
                "type": "number",
                "required": True,
                "format": "Finite positive number > 0",
                "rules": "Strict positive decimal. Reject NaN, negative, zero, or text.",
                "valid_example": "450.00",
                "invalid_example": "-100, four hundred, 0",
                "explanation": "Checked against round-ratio and ticket deviation distributions."
            },
            {
                "name": "currency",
                "label": "Currency",
                "type": "enum",
                "required": True,
                "format": "INR",
                "rules": "Currently INR.",
                "valid_example": "INR",
                "invalid_example": "USD, EUR",
                "explanation": "Platform domestic processing currency."
            },
            {
                "name": "payment_status",
                "label": "Payment Status",
                "type": "enum",
                "required": True,
                "format": "Controlled enum",
                "rules": "Success, Failed, Refunded, Pending",
                "valid_example": "Success",
                "invalid_example": "Done, Completed",
                "explanation": "Only authorised transactions impact risk scores."
            },
            {
                "name": "payer_token",
                "label": "Synthetic Payer Token",
                "type": "string",
                "required": True,
                "format": "payer_XXXXXX or token_XXXXXX",
                "rules": "Synthetic pseudonymous token only. NEVER enter phone numbers or UPI IDs.",
                "valid_example": "payer_000123",
                "invalid_example": "+919876543210, john@okaxis",
                "explanation": "Strict privacy rule: real PII is rejected by the ingest validator."
            },
            {
                "name": "payment_method",
                "label": "Payment Method",
                "type": "enum",
                "required": True,
                "format": "Controlled enum",
                "rules": "UPI, Card, NetBanking, Wallet",
                "valid_example": "UPI",
                "invalid_example": "Cash, Cheque",
                "explanation": "Standard digital gateway payment methods."
            },
            {
                "name": "channel",
                "label": "Channel",
                "type": "enum",
                "required": True,
                "format": "Controlled enum",
                "rules": "QR, Web Checkout, POS, Payment Link",
                "valid_example": "QR",
                "invalid_example": "In-person cash",
                "explanation": "Merchant collection touchpoint."
            }
        ],
        "sample_record": {
            "transaction_id": "TXN-00004567",
            "merchant_id": "MER-001-GOLDEN",
            "transaction_timestamp": "2026-11-09T14:32:00",
            "amount": 450.00,
            "currency": "INR",
            "payment_status": "Success",
            "payer_token": "payer_000123",
            "payment_method": "UPI",
            "channel": "QR"
        }
    },
    "settlements": {
        "title": "Settlement / Payout Event",
        "description": "Provider-visible payout batch transfers and instant outflow requests.",
        "fields": [
            {
                "name": "settlement_id",
                "label": "Settlement ID",
                "type": "string",
                "required": True,
                "format": "SET-XXXXXX",
                "rules": "Unique payout reference ID.",
                "valid_example": "SET-2026-00412",
                "invalid_example": "123",
                "explanation": "Provider bank payout batch identifier."
            },
            {
                "name": "merchant_id",
                "label": "Merchant ID",
                "type": "string",
                "required": True,
                "format": "Must exist in database",
                "rules": "Reference to valid merchant.",
                "valid_example": "MER-001-GOLDEN",
                "invalid_example": "MER-999999",
                "explanation": "Target of settlement payout."
            },
            {
                "name": "amount",
                "label": "Payout Amount (INR)",
                "type": "number",
                "required": True,
                "format": "Positive float",
                "rules": "Net disbursed amount.",
                "valid_example": "24500.00",
                "invalid_example": "-500",
                "explanation": "Used for settlement velocity ratio calculations."
            },
            {
                "name": "timestamp",
                "label": "Timestamp",
                "type": "datetime",
                "required": True,
                "format": "YYYY-MM-DDTHH:MM:SS",
                "rules": "Disbursement timestamp.",
                "valid_example": "2026-11-09T18:00:00",
                "invalid_example": "today",
                "explanation": "Evaluated for instant payout request velocity."
            },
            {
                "name": "status",
                "label": "Status",
                "type": "enum",
                "required": True,
                "format": "Completed, Pending, Failed",
                "rules": "Status of bank transfer.",
                "valid_example": "Completed",
                "invalid_example": "In progress",
                "explanation": "Payout status."
            }
        ],
        "sample_record": {
            "settlement_id": "SET-2026-00412",
            "merchant_id": "MER-001-GOLDEN",
            "amount": 24500.00,
            "timestamp": "2026-11-09T18:00:00",
            "status": "Completed"
        }
    },
    "calendar_events": {
        "title": "Calendar & Festival Context",
        "description": "Registers festivals, sports events, and holidays for intelligent false-positive damping.",
        "fields": [
            {
                "name": "event_id",
                "label": "Event ID",
                "type": "string",
                "required": True,
                "format": "EVT-XXXXXX",
                "rules": "Unique event identifier.",
                "valid_example": "EVT-HOLI-2026",
                "invalid_example": "1",
                "explanation": "Identifier."
            },
            {
                "name": "name",
                "label": "Event Name",
                "type": "string",
                "required": True,
                "format": "Event title",
                "rules": "Official holiday or festival name.",
                "valid_example": "Holi Festival Sweets Rush",
                "invalid_example": "",
                "explanation": "Displayed on merchant profile context timeline."
            },
            {
                "name": "event_type",
                "label": "Event Type",
                "type": "enum",
                "required": True,
                "format": "Festival, National Holiday, Sports Event, Weekend Spike",
                "rules": "Controlled event taxonomy.",
                "valid_example": "Festival",
                "invalid_example": "Sale",
                "explanation": "Guides baseline dampening equations."
            },
            {
                "name": "start_date",
                "label": "Start Date",
                "type": "datetime",
                "required": True,
                "format": "YYYY-MM-DDTHH:MM:SS",
                "rules": "Start of observed surge window.",
                "valid_example": "2026-03-24T00:00:00",
                "invalid_example": "March",
                "explanation": "Window start."
            },
            {
                "name": "end_date",
                "label": "End Date",
                "type": "datetime",
                "required": True,
                "format": "YYYY-MM-DDTHH:MM:SS",
                "rules": "End of window (must be after start_date).",
                "valid_example": "2026-03-26T23:59:59",
                "invalid_example": "2026-03-20T00:00:00",
                "explanation": "Window end."
            },
            {
                "name": "expected_volume_multiplier",
                "label": "Volume Multiplier",
                "type": "number",
                "required": True,
                "format": "Float >= 1.0",
                "rules": "Expected turnover factor (e.g. 2.5 = 250% of regular volume).",
                "valid_example": "2.8",
                "invalid_example": "0.5, -2",
                "explanation": "Damps false-alarm ticket and volume surges."
            }
        ],
        "sample_record": {
            "event_id": "EVT-HOLI-2026",
            "name": "Holi Festival Sweets Rush",
            "event_type": "Festival",
            "start_date": "2026-03-24T00:00:00",
            "end_date": "2026-03-26T23:59:59",
            "expected_volume_multiplier": 2.8
        }
    }
}

# -----------------------------------------------------------------------------
# Admin Overview Endpoint
# -----------------------------------------------------------------------------
@router.get("/overview")
def get_admin_overview(
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin)
):
    """
    Returns administrative telemetry, batch ingestion status, staging counters, and recent audit logs.
    """
    # Merchants counts
    total_merchants = db.query(Merchant).count()
    published_merchants = db.query(Merchant).filter(Merchant.publication_status == "published").count()
    draft_merchants = db.query(Merchant).filter(Merchant.publication_status == "draft").count()

    # Transactions counts
    total_tx = db.query(Transaction).count()
    published_tx = db.query(Transaction).filter(Transaction.publication_status == "published").count()
    draft_tx = db.query(Transaction).filter(Transaction.publication_status == "draft").count()

    # Batches telemetry
    total_batches = db.query(ImportBatch).count()
    staged_batches = db.query(ImportBatch).filter(ImportBatch.status == "staged").count()
    published_batches = db.query(ImportBatch).filter(ImportBatch.status == "published").count()
    rejected_batches = db.query(ImportBatch).filter(ImportBatch.status == "rejected").count()

    # Records awaiting validation / publication
    total_staged_records = draft_merchants + draft_tx
    
    # Last successful import
    last_import = db.query(ImportBatch).filter(ImportBatch.status == "published").order_by(desc(ImportBatch.published_at)).first()
    last_import_data = None
    if last_import:
        last_import_data = {
            "batch_id": last_import.id,
            "filename": last_import.source_filename,
            "dataset_type": last_import.dataset_type,
            "published_at": last_import.published_at.isoformat() if last_import.published_at else None,
            "published_rows": last_import.published_rows,
            "published_by": last_import.published_by_name
        }

    # Recent admin audit actions
    recent_audits = db.query(AuditEvent).order_by(desc(AuditEvent.timestamp)).limit(10).all()
    audit_list = [
        {
            "id": a.id,
            "timestamp": a.timestamp.isoformat(),
            "actor_name": a.actor_name,
            "actor_role": a.actor_role,
            "action": a.action,
            "entity_type": a.entity_type,
            "entity_id": a.entity_id,
            "rationale": a.rationale
        }
        for a in recent_audits
    ]

    return {
        "telemetry": {
            "total_merchants": total_merchants,
            "published_merchants": published_merchants,
            "draft_merchants": draft_merchants,
            "total_transactions": total_tx,
            "published_transactions": published_tx,
            "draft_transactions": draft_tx,
            "total_batches": total_batches,
            "staged_batches": staged_batches,
            "published_batches": published_batches,
            "rejected_batches": rejected_batches,
            "records_awaiting_publication": total_staged_records,
            "last_import": last_import_data
        },
        "recent_audit_actions": audit_list
    }

# -----------------------------------------------------------------------------
# Data Entry Guide & Template Downloads
# -----------------------------------------------------------------------------
@router.get("/guide")
def get_guide(current_admin: User = Depends(require_admin)):
    """Returns exact field rules, allowed enums, descriptions, and examples."""
    return DATA_ENTRY_GUIDE

@router.get("/templates/{dataset_type}")
def download_template(dataset_type: str, current_admin: User = Depends(require_admin)):
    """Downloads official CSV template with field definitions and 1 valid sample row."""
    if dataset_type not in DATA_ENTRY_GUIDE:
        raise HTTPException(status_code=400, detail=f"Unknown dataset type: {dataset_type}")
    
    guide_entry = DATA_ENTRY_GUIDE[dataset_type]
    field_names = [f["name"] for f in guide_entry["fields"]]
    sample_data = guide_entry["sample_record"]

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(field_names)
    writer.writerow([sample_data.get(f, "") for f in field_names])

    content = output.getvalue()
    return Response(
        content=content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=template_{dataset_type}.csv"}
    )

@router.get("/samples/{dataset_type}")
def download_sample_data(dataset_type: str, current_admin: User = Depends(require_admin)):
    """Downloads a complete populated synthetic sample CSV for immediate testing."""
    if dataset_type not in DATA_ENTRY_GUIDE:
        raise HTTPException(status_code=400, detail=f"Unknown dataset type: {dataset_type}")

    guide_entry = DATA_ENTRY_GUIDE[dataset_type]
    field_names = [f["name"] for f in guide_entry["fields"]]

    samples_map = {
        "merchants": [
            guide_entry["sample_record"],
            {
                "merchant_id": "MER-000125",
                "merchant_name": "Delhi High-Street Confectionery",
                "legal_name": "Delhi Sweets & Bakes Pvt Ltd",
                "business_category": "Confectionery",
                "city": "Delhi NCR",
                "region": "Connaught Place",
                "onboarding_date": "2026-07-10",
                "declared_operating_hours": "09:00 - 23:00",
                "account_status": "Active",
                "declared_monthly_volume": 320000.0,
                "declared_avg_ticket": 280.0
            },
            {
                "merchant_id": "MER-000126",
                "merchant_name": "Indiranagar Patisserie & Espresso",
                "legal_name": "Bengaluru Patisserie Ventures LLP",
                "business_category": "Bakeries",
                "city": "Bengaluru",
                "region": "Indiranagar",
                "onboarding_date": "2026-06-20",
                "declared_operating_hours": "08:00 - 22:00",
                "account_status": "Active",
                "declared_monthly_volume": 210000.0,
                "declared_avg_ticket": 240.0
            }
        ],
        "transactions": [
            guide_entry["sample_record"],
            {
                "transaction_id": "TXN-00004568",
                "merchant_id": "MER-001-GOLDEN",
                "transaction_timestamp": "2026-11-09T14:45:00",
                "amount": 180.00,
                "currency": "INR",
                "payment_status": "Success",
                "payer_token": "payer_000124",
                "payment_method": "UPI",
                "channel": "QR"
            },
            {
                "transaction_id": "TXN-00004569",
                "merchant_id": "MER-001-GOLDEN",
                "transaction_timestamp": "2026-11-09T15:10:00",
                "amount": 320.00,
                "currency": "INR",
                "payment_status": "Success",
                "payer_token": "payer_000125",
                "payment_method": "Card",
                "channel": "POS"
            }
        ],
        "settlements": [
            guide_entry["sample_record"],
            {
                "settlement_id": "SET-2026-00413",
                "merchant_id": "MER-001-GOLDEN",
                "amount": 31200.00,
                "timestamp": "2026-11-10T18:00:00",
                "status": "Completed"
            }
        ],
        "calendar_events": [
            guide_entry["sample_record"],
            {
                "event_id": "EVT-CRICKET-FINALS-2026",
                "name": "T20 Championship Finals Matchday",
                "event_type": "Sports Event",
                "start_date": "2026-04-12T18:00:00",
                "end_date": "2026-04-12T23:59:59",
                "expected_volume_multiplier": 1.9
            }
        ]
    }

    rows = samples_map.get(dataset_type, [guide_entry["sample_record"]])
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(field_names)
    for r in rows:
        writer.writerow([r.get(f, "") for f in field_names])

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=sample_{dataset_type}.csv"}
    )

# -----------------------------------------------------------------------------
# Manual Data Entry Endpoint with Strict Validation
# -----------------------------------------------------------------------------
class ManualEntryRequest(BaseModel):
    dataset_type: str = Field(..., description="merchants, transactions, settlements, calendar_events")
    publication_mode: str = Field("draft", description="draft (staged) or published")
    payload: Dict[str, Any]

@router.post("/manual-entry")
def create_manual_entry(
    req: ManualEntryRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin)
):
    """
    Validates and persists a single record entered manually by an authorized administrator.
    """
    dtype = req.dataset_type
    p = req.payload
    is_published = req.publication_mode == "published"
    pub_status = "published" if is_published else "draft"
    now = datetime.datetime.now(datetime.timezone.utc)

    if dtype == "merchants":
        # Required fields validation
        m_id = str(p.get("merchant_id", "")).strip()
        name = str(p.get("merchant_name", "")).strip()
        legal = str(p.get("legal_name", "")).strip()
        cat = str(p.get("business_category", "")).strip()
        city = str(p.get("city", "")).strip()
        region = str(p.get("region", "")).strip()
        onboard_str = str(p.get("onboarding_date", "")).strip()
        hours = str(p.get("declared_operating_hours", "08:00 - 22:00")).strip()
        acc_status = str(p.get("account_status", "Active")).strip()

        errors = []
        if not m_id or not m_id.startswith("MER-"):
            errors.append({"field": "merchant_id", "message": "Merchant ID must start with 'MER-'"})
        if db.query(Merchant).filter(Merchant.id == m_id).first():
            errors.append({"field": "merchant_id", "message": f"Merchant ID '{m_id}' already exists."})
        if len(name) < 3:
            errors.append({"field": "merchant_name", "message": "Merchant name must be at least 3 characters."})
        if len(legal) < 3:
            errors.append({"field": "legal_name", "message": "Legal entity name must be at least 3 characters."})
        if cat not in ["Bakeries", "Confectionery", "Restaurants", "Retail", "Groceries", "Electronics", "Fashion", "Pharmacy", "Hospitality", "Services"]:
            errors.append({"field": "business_category", "message": f"Invalid business category '{cat}'."})
        if not city:
            errors.append({"field": "city", "message": "City cannot be empty."})
        if not region:
            errors.append({"field": "region", "message": "Region cannot be empty."})

        # Parse date
        onboard_dt = None
        try:
            onboard_dt = datetime.datetime.fromisoformat(onboard_str)
        except Exception:
            errors.append({"field": "onboarding_date", "message": "Expected ISO date (YYYY-MM-DD)."})

        # Monthly volume & ticket
        try:
            vol = float(p.get("declared_monthly_volume", 150000.0))
            if vol <= 0:
                errors.append({"field": "declared_monthly_volume", "message": "Volume must be greater than zero."})
        except Exception:
            errors.append({"field": "declared_monthly_volume", "message": "Expected finite numeric value."})
            vol = 150000.0

        try:
            ticket = float(p.get("declared_avg_ticket", 180.0))
            if ticket <= 0:
                errors.append({"field": "declared_avg_ticket", "message": "Average ticket must be greater than zero."})
        except Exception:
            errors.append({"field": "declared_avg_ticket", "message": "Expected finite numeric value."})
            ticket = 180.0

        if errors:
            raise HTTPException(status_code=422, detail={"errors": errors})

        merchant = Merchant(
            id=m_id,
            name=name,
            legal_name=legal,
            business_category=cat,
            city=city,
            region=region,
            onboarding_date=onboard_dt,
            declared_operating_hours=hours,
            account_status=acc_status,
            declared_monthly_volume=vol,
            declared_avg_ticket=ticket,
            current_risk_score=120,
            current_risk_tier=0,
            publication_status=pub_status,
            data_source="manual",
            created_by=current_admin.full_name,
            published_by=current_admin.full_name if is_published else None,
            published_at=now if is_published else None
        )
        db.add(merchant)

        profile = MerchantProfile(
            merchant_id=m_id,
            pan_masked=f"{m_id[:3]}PA****M",
            gst_number_masked=f"27{m_id[:3]}****1Z5",
            registered_address=f"Storefront, {region}, {city}",
            corroboration_status="Verified at Onboarding",
            notes=f"Manually added by Admin: {current_admin.full_name}"
        )
        db.add(profile)

        # Audit Event
        audit = AuditEvent(
            actor_id=current_admin.id,
            actor_name=current_admin.full_name,
            actor_role=current_admin.role,
            action="MANUAL_MERCHANT_CREATE",
            entity_type="Merchant",
            entity_id=m_id,
            after_state=json.dumps({"name": name, "status": pub_status}),
            rationale=f"Admin manual entry (mode: {pub_status})"
        )
        db.add(audit)
        db.commit()

        return {
            "status": "success",
            "message": f"Merchant {m_id} successfully saved ({pub_status}).",
            "entity_id": m_id,
            "publication_status": pub_status
        }

    elif dtype == "transactions":
        t_id = str(p.get("transaction_id", "")).strip()
        m_id = str(p.get("merchant_id", "")).strip()
        ts_str = str(p.get("transaction_timestamp", "")).strip()
        payer = str(p.get("payer_token", "")).strip()
        status_val = str(p.get("payment_status", "Success")).strip()
        method_val = str(p.get("payment_method", "UPI")).strip()
        channel_val = str(p.get("channel", "QR")).strip()

        errors = []
        if not t_id or not t_id.startswith("TXN-"):
            errors.append({"field": "transaction_id", "message": "Transaction ID must start with 'TXN-'"})
        if db.query(Transaction).filter(Transaction.id == t_id).first():
            errors.append({"field": "transaction_id", "message": f"Transaction ID '{t_id}' already exists."})
        
        # Foreign key merchant check
        merchant_obj = db.query(Merchant).filter(Merchant.id == m_id).first()
        if not merchant_obj:
            errors.append({"field": "merchant_id", "message": f"Merchant '{m_id}' does not exist in database."})

        # Amount validation
        amt = None
        try:
            amt = float(p.get("amount", 0.0))
            if amt <= 0:
                errors.append({"field": "amount", "message": "Amount must be a positive number greater than zero."})
        except Exception:
            errors.append({"field": "amount", "message": "Expected finite numeric amount (e.g. 450.00)."})

        # Timestamp validation
        tx_dt = None
        try:
            tx_dt = datetime.datetime.fromisoformat(ts_str)
        except Exception:
            errors.append({"field": "transaction_timestamp", "message": "Expected ISO 8601 timestamp (YYYY-MM-DDTHH:MM:SS)."})

        # Payer token validation (synthetic privacy check)
        if not payer or ("@" in payer or (payer.startswith("+") and len(payer) > 9) or (payer.isdigit() and len(payer) >= 10)):
            errors.append({"field": "payer_token", "message": "Rejected PII. Must be a pseudonymous token (e.g. payer_000123)."})

        if status_val not in ["Success", "Failed", "Refunded", "Pending"]:
            errors.append({"field": "payment_status", "message": f"Invalid payment status '{status_val}'."})

        if errors:
            raise HTTPException(status_code=422, detail={"errors": errors})

        # Ensure payer token exists in payer_tokens table
        token_obj = db.query(PayerToken).filter(PayerToken.token_id == payer).first()
        if not token_obj:
            token_obj = PayerToken(token_id=payer, first_seen_at=tx_dt, last_seen_at=tx_dt)
            db.add(token_obj)
        else:
            token_obj.total_tx_count += 1
            token_obj.last_seen_at = tx_dt

        txn = Transaction(
            id=t_id,
            merchant_id=m_id,
            timestamp=tx_dt,
            amount=amt,
            currency="INR",
            status=status_val,
            payment_method=method_val,
            payer_token=payer,
            channel=channel_val,
            publication_status=pub_status,
            data_source="manual",
            created_by=current_admin.full_name,
            published_by=current_admin.full_name if is_published else None,
            published_at=now if is_published else None
        )
        db.add(txn)

        audit = AuditEvent(
            actor_id=current_admin.id,
            actor_name=current_admin.full_name,
            actor_role=current_admin.role,
            action="MANUAL_TRANSACTION_CREATE",
            entity_type="Transaction",
            entity_id=t_id,
            after_state=json.dumps({"merchant_id": m_id, "amount": amt, "status": pub_status}),
            rationale=f"Admin manual transaction entry (mode: {pub_status})"
        )
        db.add(audit)
        db.commit()

        return {
            "status": "success",
            "message": f"Transaction {t_id} successfully saved ({pub_status}).",
            "entity_id": t_id,
            "publication_status": pub_status
        }

    elif dtype == "settlements":
        s_id = str(p.get("settlement_id", "")).strip()
        m_id = str(p.get("merchant_id", "")).strip()
        ts_str = str(p.get("timestamp", "")).strip()

        errors = []
        if not s_id:
            errors.append({"field": "settlement_id", "message": "Settlement ID is required."})
        if db.query(SettlementEvent).filter(SettlementEvent.id == s_id).first():
            errors.append({"field": "settlement_id", "message": f"Settlement ID '{s_id}' already exists."})
        if not db.query(Merchant).filter(Merchant.id == m_id).first():
            errors.append({"field": "merchant_id", "message": f"Merchant '{m_id}' does not exist."})

        amt = None
        try:
            amt = float(p.get("amount", 0.0))
            if amt <= 0:
                errors.append({"field": "amount", "message": "Amount must be positive."})
        except Exception:
            errors.append({"field": "amount", "message": "Invalid numeric amount."})

        s_dt = None
        try:
            s_dt = datetime.datetime.fromisoformat(ts_str)
        except Exception:
            errors.append({"field": "timestamp", "message": "Invalid ISO timestamp."})

        if errors:
            raise HTTPException(status_code=422, detail={"errors": errors})

        settle = SettlementEvent(
            id=s_id,
            merchant_id=m_id,
            timestamp=s_dt,
            amount=amt,
            status=str(p.get("status", "Completed")),
            publication_status=pub_status,
            data_source="manual",
            created_by=current_admin.full_name,
            published_by=current_admin.full_name if is_published else None,
            published_at=now if is_published else None
        )
        db.add(settle)
        db.commit()

        return {"status": "success", "message": f"Settlement {s_id} saved.", "entity_id": s_id}

    elif dtype == "calendar_events":
        e_id = str(p.get("event_id", "")).strip()
        name = str(p.get("name", "")).strip()
        etype = str(p.get("event_type", "Festival")).strip()
        st_str = str(p.get("start_date", "")).strip()
        end_str = str(p.get("end_date", "")).strip()

        errors = []
        if not e_id:
            errors.append({"field": "event_id", "message": "Event ID is required."})
        if db.query(CalendarEvent).filter(CalendarEvent.id == e_id).first():
            errors.append({"field": "event_id", "message": f"Event ID '{e_id}' already exists."})
        if not name:
            errors.append({"field": "name", "message": "Event name cannot be empty."})

        try:
            st_dt = datetime.datetime.fromisoformat(st_str)
            end_dt = datetime.datetime.fromisoformat(end_str)
            if end_dt < st_dt:
                errors.append({"field": "end_date", "message": "End date must be on or after start date."})
        except Exception:
            errors.append({"field": "dates", "message": "Expected valid ISO start and end timestamps."})

        try:
            mult = float(p.get("expected_volume_multiplier", 2.0))
            if mult < 1.0:
                errors.append({"field": "expected_volume_multiplier", "message": "Multiplier must be >= 1.0."})
        except Exception:
            errors.append({"field": "expected_volume_multiplier", "message": "Invalid numeric multiplier."})

        if errors:
            raise HTTPException(status_code=422, detail={"errors": errors})

        cal = CalendarEvent(
            id=e_id,
            name=name,
            event_type=etype,
            start_date=st_dt,
            end_date=end_dt,
            expected_volume_multiplier=mult,
            publication_status=pub_status,
            data_source="manual",
            created_by=current_admin.full_name,
            published_by=current_admin.full_name if is_published else None,
            published_at=now if is_published else None
        )
        db.add(cal)
        db.commit()

        return {"status": "success", "message": f"Calendar event {e_id} saved.", "entity_id": e_id}

    else:
        raise HTTPException(status_code=400, detail=f"Unsupported dataset type: {dtype}")

# -----------------------------------------------------------------------------
# File Import Wizard: Step 3 - Upload
# -----------------------------------------------------------------------------
def parse_rows_from_bytes(file_bytes: bytes, filename: str) -> List[List[str]]:
    """Parses raw bytes from CSV or XLSX safely without external dependencies."""
    is_xlsx = filename.lower().endswith(".xlsx")
    if is_xlsx:
        try:
            with zipfile.ZipFile(io.BytesIO(file_bytes)) as z:
                # Read shared strings if any
                shared_strings = []
                if "xl/sharedStrings.xml" in z.namelist():
                    tree = ET.fromstring(z.read("xl/sharedStrings.xml"))
                    for si in tree.findall("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}si"):
                        t = si.find("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t")
                        shared_strings.append(t.text if t is not None and t.text else "")
                
                # Read sheet1.xml
                sheet_xml = z.read("xl/worksheets/sheet1.xml")
                sheet_tree = ET.fromstring(sheet_xml)
                rows_data = []
                for row in sheet_tree.findall(".//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row"):
                    row_vals = []
                    for c in row.findall("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}c"):
                        v = c.find("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}v")
                        val = v.text if v is not None and v.text else ""
                        if c.get("t") == "s" and val.isdigit():
                            idx = int(val)
                            val = shared_strings[idx] if idx < len(shared_strings) else val
                        row_vals.append(val.strip())
                    if any(row_vals):
                        rows_data.append(row_vals)
                return rows_data
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Corrupt or unsupported XLSX archive: {str(e)}")
    else:
        # CSV parsing
        try:
            text = file_bytes.decode("utf-8-sig")
        except UnicodeDecodeError:
            try:
                text = file_bytes.decode("latin-1")
            except Exception:
                raise HTTPException(status_code=400, detail="Cannot decode file encoding. Expected UTF-8 encoded CSV.")
        
        reader = csv.reader(io.StringIO(text))
        rows = [list(r) for r in reader if any(r)]
        return rows

@router.post("/import/upload")
async def upload_import_file(
    dataset_type: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin)
):
    """
    Accepts CSV or XLSX file upload, validates extension, stores with safe UUID key in private storage.
    """
    if dataset_type not in DATA_ENTRY_GUIDE:
        raise HTTPException(status_code=400, detail=f"Unknown dataset type: {dataset_type}")

    filename = file.filename or "upload.csv"
    ext = os.path.splitext(filename)[1].lower()
    if ext not in [".csv", ".xlsx"]:
        raise HTTPException(status_code=400, detail=f"Unsupported file extension '{ext}'. Only .csv and .xlsx supported.")

    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if len(file_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File exceeds maximum 10MB limit.")

    # Save to storage with safe UUID key
    storage_key = f"ingest_{uuid.uuid4().hex[:12]}{ext}"
    local_path = os.path.join(UPLOAD_DIR, storage_key)
    with open(local_path, "wb") as f:
        f.write(file_bytes)

    # Parse preview rows
    rows = parse_rows_from_bytes(file_bytes, filename)
    if not rows:
        raise HTTPException(status_code=400, detail="File contains no readable rows or headers.")

    headers = [str(h).strip() for h in rows[0]]
    preview_rows = rows[1:6]

    batch_id = f"BATCH-{datetime.datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
    batch = ImportBatch(
        id=batch_id,
        dataset_type=dataset_type,
        source_filename=filename,
        storage_key=storage_key,
        file_size_bytes=len(file_bytes),
        mime_type=file.content_type or ("text/csv" if ext == ".csv" else "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
        status="uploaded",
        total_rows=max(0, len(rows) - 1),
        created_by_id=current_admin.id,
        created_by_name=current_admin.full_name
    )
    db.add(batch)
    db.commit()

    return {
        "status": "success",
        "batch_id": batch_id,
        "filename": filename,
        "dataset_type": dataset_type,
        "total_rows": max(0, len(rows) - 1),
        "headers": headers,
        "preview": preview_rows,
        "expected_fields": [f["name"] for f in DATA_ENTRY_GUIDE[dataset_type]["fields"]]
    }

# -----------------------------------------------------------------------------
# File Import Wizard: Step 5 - Validate
# -----------------------------------------------------------------------------
@router.post("/import/validate")
def validate_batch(
    batch_id: str = Query(...),
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin)
):
    """
    Parses and validates all rows against schema, checks foreign keys and duplicates.
    Produces comprehensive row-by-row validation report.
    """
    batch = db.query(ImportBatch).filter(ImportBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found.")

    local_path = os.path.join(UPLOAD_DIR, batch.storage_key)
    if not os.path.exists(local_path):
        raise HTTPException(status_code=404, detail="Source file missing from storage.")

    with open(local_path, "rb") as f:
        file_bytes = f.read()

    raw_rows = parse_rows_from_bytes(file_bytes, batch.source_filename)
    if len(raw_rows) < 2:
        raise HTTPException(status_code=400, detail="File contains header but zero data rows.")

    headers = [str(h).strip() for h in raw_rows[0]]
    data_rows = raw_rows[1:]

    # Clean existing row records if re-validating
    db.query(ImportRowRecord).filter(ImportRowRecord.batch_id == batch_id).delete()

    valid_count = 0
    invalid_count = 0
    duplicate_count = 0
    all_row_reports = []
    seen_ids = set()

    for idx, row in enumerate(data_rows, start=2):
        row_dict = {}
        for c_idx, h in enumerate(headers):
            row_dict[h] = row[c_idx].strip() if c_idx < len(row) else ""

        errors = []
        entity_id = None

        if batch.dataset_type == "merchants":
            entity_id = row_dict.get("merchant_id", "")
            if not entity_id or not entity_id.startswith("MER-"):
                errors.append({"field": "merchant_id", "message": "Expected pattern 'MER-XXXXXX'", "received": entity_id})
            elif entity_id in seen_ids:
                errors.append({"field": "merchant_id", "message": "Duplicate ID found within this file", "received": entity_id})
                duplicate_count += 1
            elif db.query(Merchant).filter(Merchant.id == entity_id).first():
                errors.append({"field": "merchant_id", "message": f"Merchant ID '{entity_id}' already exists in database", "received": entity_id})
                duplicate_count += 1
            seen_ids.add(entity_id)

            name = row_dict.get("merchant_name", "")
            if len(name) < 3:
                errors.append({"field": "merchant_name", "message": "Trading name required (min 3 chars)", "received": name})

            cat = row_dict.get("business_category", "")
            if cat not in ["Bakeries", "Confectionery", "Restaurants", "Retail", "Groceries", "Electronics", "Fashion", "Pharmacy", "Hospitality", "Services"]:
                errors.append({"field": "business_category", "message": "Invalid category enum", "received": cat})

            onboard_str = row_dict.get("onboarding_date", "")
            try:
                datetime.datetime.fromisoformat(onboard_str)
            except Exception:
                errors.append({"field": "onboarding_date", "message": "Expected ISO 8601 date (YYYY-MM-DD)", "received": onboard_str})

        elif batch.dataset_type == "transactions":
            entity_id = row_dict.get("transaction_id", "")
            if not entity_id or not entity_id.startswith("TXN-"):
                errors.append({"field": "transaction_id", "message": "Expected pattern 'TXN-XXXXXX'", "received": entity_id})
            elif entity_id in seen_ids:
                errors.append({"field": "transaction_id", "message": "Duplicate ID in this file", "received": entity_id})
                duplicate_count += 1
            elif db.query(Transaction).filter(Transaction.id == entity_id).first():
                errors.append({"field": "transaction_id", "message": f"Transaction ID '{entity_id}' already exists in database", "received": entity_id})
                duplicate_count += 1
            seen_ids.add(entity_id)

            m_id = row_dict.get("merchant_id", "")
            if not db.query(Merchant).filter(Merchant.id == m_id).first():
                errors.append({"field": "merchant_id", "message": f"Merchant '{m_id}' does not exist in database", "received": m_id})

            amt_str = row_dict.get("amount", "")
            try:
                amt = float(amt_str)
                if amt <= 0:
                    errors.append({"field": "amount", "message": "Expected positive amount > 0", "received": amt_str})
            except Exception:
                errors.append({"field": "amount", "message": "Expected finite numeric amount", "received": amt_str})

            ts_str = row_dict.get("transaction_timestamp", "")
            try:
                datetime.datetime.fromisoformat(ts_str)
            except Exception:
                errors.append({"field": "transaction_timestamp", "message": "Expected ISO 8601 timestamp with timezone", "received": ts_str})

            payer = row_dict.get("payer_token", "")
            if not payer or "@" in payer or (payer.startswith("+") and len(payer) > 9) or (payer.isdigit() and len(payer) >= 10):
                errors.append({"field": "payer_token", "message": "PII detected or invalid token. Must be synthetic (e.g. payer_000123)", "received": payer})

        elif batch.dataset_type == "settlements":
            entity_id = row_dict.get("settlement_id", "")
            if not entity_id:
                errors.append({"field": "settlement_id", "message": "Settlement ID required", "received": ""})
            elif db.query(SettlementEvent).filter(SettlementEvent.id == entity_id).first():
                errors.append({"field": "settlement_id", "message": f"Settlement ID '{entity_id}' exists in database", "received": entity_id})

            m_id = row_dict.get("merchant_id", "")
            if not db.query(Merchant).filter(Merchant.id == m_id).first():
                errors.append({"field": "merchant_id", "message": f"Merchant '{m_id}' not found", "received": m_id})

            amt_str = row_dict.get("amount", "")
            try:
                if float(amt_str) <= 0:
                    errors.append({"field": "amount", "message": "Must be > 0", "received": amt_str})
            except Exception:
                errors.append({"field": "amount", "message": "Invalid numeric", "received": amt_str})

        elif batch.dataset_type == "calendar_events":
            entity_id = row_dict.get("event_id", "")
            if not entity_id:
                errors.append({"field": "event_id", "message": "Event ID required", "received": ""})
            elif db.query(CalendarEvent).filter(CalendarEvent.id == entity_id).first():
                errors.append({"field": "event_id", "message": f"Event ID '{entity_id}' already exists", "received": entity_id})

        is_valid = len(errors) == 0
        if is_valid:
            valid_count += 1
            row_status = "valid"
        else:
            invalid_count += 1
            row_status = "invalid"

        row_record = ImportRowRecord(
            batch_id=batch_id,
            row_number=idx,
            entity_id=entity_id,
            status=row_status,
            raw_data_json=json.dumps(row_dict),
            errors_json=json.dumps(errors) if errors else None
        )
        db.add(row_record)

        if not is_valid or len(all_row_reports) < 15:
            all_row_reports.append({
                "row_number": idx,
                "entity_id": entity_id,
                "status": row_status,
                "errors": errors,
                "data": row_dict
            })

    batch.status = "validated"
    batch.total_rows = len(data_rows)
    batch.valid_rows = valid_count
    batch.invalid_rows = invalid_count
    batch.error_summary = json.dumps([r for r in all_row_reports if r["status"] == "invalid"][:50])
    db.commit()

    return {
        "status": "success",
        "batch_id": batch_id,
        "total_rows": len(data_rows),
        "valid_rows": valid_count,
        "invalid_rows": invalid_count,
        "duplicate_rows": duplicate_count,
        "is_ready_for_strict_staging": invalid_count == 0,
        "reports": all_row_reports
    }

# -----------------------------------------------------------------------------
# File Import Wizard: Step 7 & 8 - Stage Records
# -----------------------------------------------------------------------------
class StageBatchRequest(BaseModel):
    batch_id: str
    import_mode: str = Field("strict", description="strict or valid_only")

@router.post("/import/stage")
def stage_batch(
    req: StageBatchRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin)
):
    """
    Stages records into database draft state.
    Strict mode: atomic reject if any invalid rows exist.
    Valid-only mode: stages only valid rows with explicit acknowledgement.
    """
    batch = db.query(ImportBatch).filter(ImportBatch.id == req.batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found.")

    if req.import_mode == "strict" and batch.invalid_rows > 0:
        batch.status = "rejected"
        db.commit()
        raise HTTPException(
            status_code=400,
            detail=f"Strict mode rejected batch: found {batch.invalid_rows} invalid row(s). No records staged."
        )

    # Fetch valid row records
    valid_rows = db.query(ImportRowRecord).filter(
        ImportRowRecord.batch_id == req.batch_id,
        ImportRowRecord.status == "valid"
    ).all()

    staged_count = 0
    now = datetime.datetime.now(datetime.timezone.utc)

    for r in valid_rows:
        data = json.loads(r.raw_data_json)

        if batch.dataset_type == "merchants":
            m = Merchant(
                id=data["merchant_id"],
                name=data["merchant_name"],
                legal_name=data.get("legal_name", data["merchant_name"]),
                business_category=data["business_category"],
                city=data["city"],
                region=data["region"],
                onboarding_date=datetime.datetime.fromisoformat(data["onboarding_date"]),
                declared_operating_hours=data.get("declared_operating_hours", "08:00 - 22:00"),
                account_status=data.get("account_status", "Active"),
                declared_monthly_volume=float(data.get("declared_monthly_volume", 150000.0)),
                declared_avg_ticket=float(data.get("declared_avg_ticket", 180.0)),
                publication_status="draft",
                data_source="file_import",
                import_batch_id=batch.id,
                created_by=current_admin.full_name
            )
            db.add(m)
            prof = MerchantProfile(
                merchant_id=m.id,
                pan_masked=f"{m.id[:3]}PA****M",
                gst_number_masked=f"27{m.id[:3]}****1Z5",
                registered_address=f"{data['region']}, {data['city']}",
                corroboration_status="Verified at Onboarding",
                notes=f"Staged via batch {batch.id}"
            )
            db.add(prof)

        elif batch.dataset_type == "transactions":
            tx_dt = datetime.datetime.fromisoformat(data["transaction_timestamp"])
            payer = data["payer_token"]

            token_obj = db.query(PayerToken).filter(PayerToken.token_id == payer).first()
            if not token_obj:
                token_obj = PayerToken(token_id=payer, first_seen_at=tx_dt, last_seen_at=tx_dt)
                db.add(token_obj)

            t = Transaction(
                id=data["transaction_id"],
                merchant_id=data["merchant_id"],
                timestamp=tx_dt,
                amount=float(data["amount"]),
                currency=data.get("currency", "INR"),
                status=data.get("payment_status", "Success"),
                payment_method=data.get("payment_method", "UPI"),
                payer_token=payer,
                channel=data.get("channel", "QR"),
                publication_status="draft",
                data_source="file_import",
                import_batch_id=batch.id,
                created_by=current_admin.full_name
            )
            db.add(t)

        elif batch.dataset_type == "settlements":
            s = SettlementEvent(
                id=data["settlement_id"],
                merchant_id=data["merchant_id"],
                timestamp=datetime.datetime.fromisoformat(data["timestamp"]),
                amount=float(data["amount"]),
                status=data.get("status", "Completed"),
                publication_status="draft",
                data_source="file_import",
                import_batch_id=batch.id,
                created_by=current_admin.full_name
            )
            db.add(s)

        elif batch.dataset_type == "calendar_events":
            c = CalendarEvent(
                id=data["event_id"],
                name=data["name"],
                event_type=data.get("event_type", "Festival"),
                start_date=datetime.datetime.fromisoformat(data["start_date"]),
                end_date=datetime.datetime.fromisoformat(data["end_date"]),
                expected_volume_multiplier=float(data.get("expected_volume_multiplier", 2.0)),
                publication_status="draft",
                data_source="file_import",
                import_batch_id=batch.id,
                created_by=current_admin.full_name
            )
            db.add(c)

        r.status = "staged"
        staged_count += 1

    batch.status = "staged"
    batch.import_mode = req.import_mode
    batch.staged_rows = staged_count

    audit = AuditEvent(
        actor_id=current_admin.id,
        actor_name=current_admin.full_name,
        actor_role=current_admin.role,
        action="BATCH_STAGED",
        entity_type="ImportBatch",
        entity_id=batch.id,
        after_state=json.dumps({"staged_rows": staged_count, "mode": req.import_mode}),
        rationale=f"Staged {staged_count} records from {batch.source_filename}"
    )
    db.add(audit)
    db.commit()

    return {
        "status": "success",
        "batch_id": batch.id,
        "import_mode": req.import_mode,
        "staged_rows": staged_count,
        "message": f"Successfully staged {staged_count} records. Ready for administrative publication."
    }

# -----------------------------------------------------------------------------
# File Import Wizard: Step 9 - Publish Staged Batch
# -----------------------------------------------------------------------------
class PublishBatchRequest(BaseModel):
    batch_id: str

@router.post("/import/publish")
def publish_batch(
    req: PublishBatchRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin)
):
    """
    Publishes staged batch to the public platform. Updates publication_status to 'published'
    and triggers cache invalidation / dataset versioning.
    """
    batch = db.query(ImportBatch).filter(ImportBatch.id == req.batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found.")
    if batch.status != "staged":
        raise HTTPException(status_code=400, detail=f"Cannot publish batch in '{batch.status}' status. Must be 'staged'.")

    now = datetime.datetime.now(datetime.timezone.utc)
    published_count = 0

    if batch.dataset_type == "merchants":
        merchants = db.query(Merchant).filter(Merchant.import_batch_id == batch.id, Merchant.publication_status == "draft").all()
        for m in merchants:
            m.publication_status = "published"
            m.published_by = current_admin.full_name
            m.published_at = now
            published_count += 1

    elif batch.dataset_type == "transactions":
        txs = db.query(Transaction).filter(Transaction.import_batch_id == batch.id, Transaction.publication_status == "draft").all()
        for t in txs:
            t.publication_status = "published"
            t.published_by = current_admin.full_name
            t.published_at = now
            published_count += 1

    elif batch.dataset_type == "settlements":
        sets = db.query(SettlementEvent).filter(SettlementEvent.import_batch_id == batch.id, SettlementEvent.publication_status == "draft").all()
        for s in sets:
            s.publication_status = "published"
            s.published_by = current_admin.full_name
            s.published_at = now
            published_count += 1

    elif batch.dataset_type == "calendar_events":
        cals = db.query(CalendarEvent).filter(CalendarEvent.import_batch_id == batch.id, CalendarEvent.publication_status == "draft").all()
        for c in cals:
            c.publication_status = "published"
            c.published_by = current_admin.full_name
            c.published_at = now
            published_count += 1

    batch.status = "published"
    batch.published_rows = published_count
    batch.published_by_id = current_admin.id
    batch.published_by_name = current_admin.full_name
    batch.published_at = now

    # Record dataset version
    v_tag = f"DATASET-v{now.strftime('%Y%m%d%H%M%S')}"
    ds_version = DatasetVersion(
        version_tag=v_tag,
        dataset_type=batch.dataset_type,
        batch_id=batch.id,
        action="publish",
        records_count=published_count,
        published_by=current_admin.full_name,
        published_at=now,
        notes=f"Published {published_count} {batch.dataset_type} from {batch.source_filename}"
    )
    db.add(ds_version)

    audit = AuditEvent(
        actor_id=current_admin.id,
        actor_name=current_admin.full_name,
        actor_role=current_admin.role,
        action="BATCH_PUBLISHED",
        entity_type="ImportBatch",
        entity_id=batch.id,
        after_state=json.dumps({"published_rows": published_count, "version": v_tag}),
        rationale=f"Admin published dataset batch {batch.id}"
    )
    db.add(audit)
    db.commit()

    return {
        "status": "success",
        "batch_id": batch.id,
        "dataset_version": v_tag,
        "published_rows": published_count,
        "published_at": now.isoformat(),
        "message": f"Dataset published successfully! Public AEGIS-PAY platform now reflects {published_count} new {batch.dataset_type}."
    }

# -----------------------------------------------------------------------------
# Rollback / Unpublish Batch Endpoint
# -----------------------------------------------------------------------------
class RollbackRequest(BaseModel):
    rationale: str = Field(..., min_length=5, description="Audited explanation for reverting the dataset batch")

@router.post("/datasets/{batch_id}/rollback")
def rollback_batch(
    batch_id: str,
    req: RollbackRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin)
):
    """
    Safely unpublishes records from a batch and restores previous state with full audit trail.
    """
    batch = db.query(ImportBatch).filter(ImportBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found.")

    now = datetime.datetime.now(datetime.timezone.utc)
    reverted_count = 0

    if batch.dataset_type == "merchants":
        items = db.query(Merchant).filter(Merchant.import_batch_id == batch.id).all()
        for i in items:
            i.publication_status = "unpublished"
            reverted_count += 1
    elif batch.dataset_type == "transactions":
        items = db.query(Transaction).filter(Transaction.import_batch_id == batch.id).all()
        for i in items:
            i.publication_status = "unpublished"
            reverted_count += 1
    elif batch.dataset_type == "settlements":
        items = db.query(SettlementEvent).filter(SettlementEvent.import_batch_id == batch.id).all()
        for i in items:
            i.publication_status = "unpublished"
            reverted_count += 1
    elif batch.dataset_type == "calendar_events":
        items = db.query(CalendarEvent).filter(CalendarEvent.import_batch_id == batch.id).all()
        for i in items:
            i.publication_status = "unpublished"
            reverted_count += 1

    batch.status = "rolled_back"
    batch.rolled_back_at = now
    batch.rolled_back_by = current_admin.full_name
    batch.rollback_rationale = req.rationale

    audit = AuditEvent(
        actor_id=current_admin.id,
        actor_name=current_admin.full_name,
        actor_role=current_admin.role,
        action="BATCH_ROLLBACK",
        entity_type="ImportBatch",
        entity_id=batch.id,
        after_state=json.dumps({"reverted_rows": reverted_count, "rationale": req.rationale}),
        rationale=req.rationale
    )
    db.add(audit)
    db.commit()

    return {
        "status": "success",
        "batch_id": batch.id,
        "reverted_rows": reverted_count,
        "message": f"Batch {batch.id} rolled back. Records unpublished from public view."
    }

# -----------------------------------------------------------------------------
# Batches & Datasets Listing
# -----------------------------------------------------------------------------
@router.get("/datasets")
def list_datasets(
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin)
):
    """Lists all uploaded batches, validation results, and published dataset versions."""
    batches = db.query(ImportBatch).order_by(desc(ImportBatch.created_at)).all()
    batch_list = [
        {
            "id": b.id,
            "dataset_type": b.dataset_type,
            "source_filename": b.source_filename,
            "file_size_bytes": b.file_size_bytes,
            "status": b.status,
            "import_mode": b.import_mode,
            "total_rows": b.total_rows,
            "valid_rows": b.valid_rows,
            "invalid_rows": b.invalid_rows,
            "staged_rows": b.staged_rows,
            "published_rows": b.published_rows,
            "created_by": b.created_by_name,
            "created_at": b.created_at.isoformat(),
            "published_by": b.published_by_name,
            "published_at": b.published_at.isoformat() if b.published_at else None,
            "rolled_back_at": b.rolled_back_at.isoformat() if b.rolled_back_at else None
        }
        for b in batches
    ]

    versions = db.query(DatasetVersion).order_by(desc(DatasetVersion.published_at)).limit(20).all()
    version_list = [
        {
            "id": v.id,
            "version_tag": v.version_tag,
            "dataset_type": v.dataset_type,
            "batch_id": v.batch_id,
            "action": v.action,
            "records_count": v.records_count,
            "published_by": v.published_by,
            "published_at": v.published_at.isoformat(),
            "notes": v.notes
        }
        for v in versions
    ]

    return {"batches": batch_list, "versions": version_list}

@router.get("/datasets/{batch_id}")
def get_batch_details(
    batch_id: str,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin)
):
    """Returns granular row records and validation reports for a single batch."""
    batch = db.query(ImportBatch).filter(ImportBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found.")

    rows = db.query(ImportRowRecord).filter(ImportRowRecord.batch_id == batch_id).limit(100).all()
    row_list = [
        {
            "row_number": r.row_number,
            "entity_id": r.entity_id,
            "status": r.status,
            "errors": json.loads(r.errors_json) if r.errors_json else [],
            "data": json.loads(r.raw_data_json)
        }
        for r in rows
    ]

    return {
        "batch": {
            "id": batch.id,
            "dataset_type": batch.dataset_type,
            "source_filename": batch.source_filename,
            "status": batch.status,
            "total_rows": batch.total_rows,
            "valid_rows": batch.valid_rows,
            "invalid_rows": batch.invalid_rows,
            "staged_rows": batch.staged_rows,
            "published_rows": batch.published_rows,
            "created_by": batch.created_by_name,
            "created_at": batch.created_at.isoformat()
        },
        "rows": row_list
    }

# -----------------------------------------------------------------------------
# Downloadable Error CSV Report with Formula-Injection Protection
# -----------------------------------------------------------------------------
@router.get("/datasets/{batch_id}/errors.csv")
def download_batch_errors_csv(
    batch_id: str,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin)
):
    """
    Downloads sanitised CSV of all rejected/invalid rows with exact column error messages.
    Includes formula injection mitigation.
    """
    batch = db.query(ImportBatch).filter(ImportBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found.")

    invalid_rows = db.query(ImportRowRecord).filter(
        ImportRowRecord.batch_id == batch_id,
        ImportRowRecord.status == "invalid"
    ).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Row Number", "Entity ID", "Error Field", "Error Message", "Received Value"])

    for r in invalid_rows:
        errors = json.loads(r.errors_json) if r.errors_json else []
        for err in errors:
            writer.writerow([
                r.row_number,
                sanitize_csv_cell(r.entity_id or "N/A"),
                sanitize_csv_cell(err.get("field", "")),
                sanitize_csv_cell(err.get("message", "")),
                sanitize_csv_cell(err.get("received", ""))
            ])

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=errors_{batch_id}.csv"}
    )
