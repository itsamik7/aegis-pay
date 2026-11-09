import csv
import io
import json
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from ..database import get_db
from ..models import Merchant, Alert, Case, Transaction, AuditEvent
from ..auth import get_current_user
from ..risk_engine.signals import SIGNALS_CATALOG
from ..risk_engine.scorer import TIER_DEFINITIONS

router = APIRouter(prefix="/reports", tags=["Reports & Analytics"])

@router.get("/risk-distribution")
def get_risk_distribution_report(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    merchants = db.query(Merchant).all()
    tier_counts = {t: 0 for t in range(6)}
    for m in merchants:
        tier_counts[m.current_risk_tier] = tier_counts.get(m.current_risk_tier, 0) + 1
        
    return [{
        "tier": t,
        "label": TIER_DEFINITIONS[t]["label"],
        "count": tier_counts[t],
        "action": TIER_DEFINITIONS[t]["action"]
    } for t in range(6)]

@router.get("/alerts-by-signal")
def get_alerts_by_signal_report(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    alerts = db.query(Alert).all()
    signal_counts = {sig_id: 0 for sig_id in SIGNALS_CATALOG}
    for a in alerts:
        if a.triggered_signals:
            sig_ids = json.loads(a.triggered_signals)
            for sid in sig_ids:
                if sid in signal_counts:
                    signal_counts[sid] += 1
                    
    results = []
    for sig_id, count in signal_counts.items():
        meta = SIGNALS_CATALOG[sig_id]
        results.append({
            "signal_id": sig_id,
            "name": meta["name"],
            "dimension": meta["dimension"],
            "severity": meta["severity"],
            "trigger_count": count
        })
    results.sort(key=lambda x: x["trigger_count"], reverse=True)
    return results

@router.get("/case-outcomes")
def get_case_outcomes_report(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    cases = db.query(Case).all()
    outcomes = {}
    for c in cases:
        outcomes[c.status] = outcomes.get(c.status, 0) + 1
    return [{"status": s, "count": count} for s, count in outcomes.items()]

@router.get("/export/{report_type}")
def export_report_csv(
    report_type: str, # risk_summary, alerts_summary, cases_summary
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    output = io.StringIO()
    writer = csv.writer(output)
    
    if report_type == "risk_summary":
        writer.writerow(["Merchant ID", "Name", "Category", "City", "Score", "Tier", "Tier Label", "Account Status"])
        merchants = db.query(Merchant).order_by(desc(Merchant.current_risk_score)).all()
        for m in merchants:
            writer.writerow([
                m.id, m.name, m.business_category, m.city, m.current_risk_score,
                m.current_risk_tier, TIER_DEFINITIONS[m.current_risk_tier]["label"], m.account_status
            ])
    elif report_type == "alerts_summary":
        writer.writerow(["Alert ID", "Merchant ID", "Score", "Tier", "Severity", "Status", "Latest Detected", "Assigned To"])
        alerts = db.query(Alert).order_by(desc(Alert.latest_detected_at)).all()
        for a in alerts:
            writer.writerow([
                a.id, a.merchant_id, a.score, a.tier, a.severity, a.status,
                a.latest_detected_at.strftime("%Y-%m-%d %H:%M"), a.assigned_analyst_name or "Unassigned"
            ])
    else:
        writer.writerow(["Case ID", "Title", "Merchant ID", "Status", "Priority", "Assigned To", "Updated At"])
        cases = db.query(Case).order_by(desc(Case.updated_at)).all()
        for c in cases:
            writer.writerow([
                c.id, c.title, c.merchant_id, c.status, c.priority, c.assigned_to_name or "Unassigned",
                c.updated_at.strftime("%Y-%m-%d %H:%M")
            ])
            
    csv_data = output.getvalue()
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=aegis_pay_{report_type}.csv"}
    )
