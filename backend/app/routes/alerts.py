import json
import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_
from ..database import get_db
from ..models import Alert, Merchant, User, AuditEvent
from ..auth import get_current_user, require_write_permission
from ..risk_engine.signals import SIGNALS_CATALOG
from ..risk_engine.scorer import TIER_DEFINITIONS

router = APIRouter(prefix="/alerts", tags=["Alerts & Risk Queue"])

class UpdateAlertRequest(BaseModel):
    status: Optional[str] = None
    assigned_analyst_id: Optional[int] = None
    rationale: Optional[str] = None
    cleared_reason: Optional[str] = None

class BulkAssignRequest(BaseModel):
    alert_ids: List[str]
    analyst_id: int
    rationale: str

class BulkStatusRequest(BaseModel):
    alert_ids: List[str]
    status: str
    rationale: str

@router.get("")
def list_alerts(
    status_filter: Optional[str] = Query(None, alias="status"),
    severity: Optional[str] = None,
    tier: Optional[int] = None,
    merchant_id: Optional[str] = None,
    analyst_id: Optional[int] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(15, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    query = db.query(Alert)
    
    if status_filter:
        query = query.filter(Alert.status == status_filter)
        
    if severity:
        query = query.filter(Alert.severity == severity)
        
    if tier is not None:
        query = query.filter(Alert.tier == tier)
        
    if merchant_id:
        query = query.filter(Alert.merchant_id == merchant_id)
        
    if analyst_id is not None:
        query = query.filter(Alert.assigned_analyst_id == analyst_id)
        
    total_count = query.count()
    items = query.order_by(desc(Alert.latest_detected_at)).offset((page - 1) * page_size).limit(page_size).all()
    
    results = []
    for a in items:
        m = db.query(Merchant).filter(Merchant.id == a.merchant_id).first()
        results.append({
            "id": a.id,
            "merchant_id": a.merchant_id,
            "merchant_name": m.name if m else a.merchant_id,
            "merchant_category": m.business_category if m else "Unknown",
            "merchant_city": m.city if m else "Unknown",
            "score": a.score,
            "tier": a.tier,
            "tier_label": TIER_DEFINITIONS[a.tier]["label"],
            "severity": a.severity,
            "status": a.status,
            "assigned_analyst_id": a.assigned_analyst_id,
            "assigned_analyst_name": a.assigned_analyst_name or "Unassigned",
            "triggered_signals": json.loads(a.triggered_signals) if a.triggered_signals else [],
            "recommended_next_step": a.recommended_next_step,
            "review_due_date": a.review_due_date.isoformat() if a.review_due_date else None,
            "first_detected_at": a.first_detected_at.isoformat(),
            "latest_detected_at": a.latest_detected_at.isoformat(),
            "cleared_reason": a.cleared_reason,
            "configuration_version": a.configuration_version,
        })
        
    return {
        "items": results,
        "total": total_count,
        "page": page,
        "page_size": page_size,
        "total_pages": (total_count + page_size - 1) // page_size
    }

@router.get("/{alert_id}")
def get_alert_detail(
    alert_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found.")
        
    merchant = db.query(Merchant).filter(Merchant.id == alert.merchant_id).first()
    sig_ids = json.loads(alert.triggered_signals) if alert.triggered_signals else []
    
    enriched_signals = []
    for sid in sig_ids:
        meta = SIGNALS_CATALOG.get(sid, {})
        enriched_signals.append({
            "id": sid,
            "name": meta.get("name", sid),
            "dimension": meta.get("dimension", "GENERAL"),
            "severity": meta.get("severity", "Medium"),
            "confidence_label": meta.get("confidence_label", "Derived"),
            "analyst_explanation": meta.get("analyst_explanation", ""),
            "false_positive_notes": meta.get("false_positive_notes", "")
        })
        
    return {
        "alert": {
            "id": alert.id,
            "merchant_id": alert.merchant_id,
            "merchant_name": merchant.name if merchant else alert.merchant_id,
            "score": alert.score,
            "tier": alert.tier,
            "tier_label": TIER_DEFINITIONS[alert.tier]["label"],
            "severity": alert.severity,
            "status": alert.status,
            "assigned_analyst_id": alert.assigned_analyst_id,
            "assigned_analyst_name": alert.assigned_analyst_name or "Unassigned",
            "recommended_next_step": alert.recommended_next_step,
            "review_due_date": alert.review_due_date.isoformat() if alert.review_due_date else None,
            "first_detected_at": alert.first_detected_at.isoformat(),
            "latest_detected_at": alert.latest_detected_at.isoformat(),
            "cleared_reason": alert.cleared_reason,
            "configuration_version": alert.configuration_version,
        },
        "merchant_snapshot": {
            "name": merchant.name if merchant else "Unknown",
            "category": merchant.business_category if merchant else "Unknown",
            "city": merchant.city if merchant else "Unknown",
            "declared_operating_hours": merchant.declared_operating_hours if merchant else "",
            "declared_monthly_volume": merchant.declared_monthly_volume if merchant else 0,
        },
        "signals": enriched_signals
    }

@router.patch("/{alert_id}")
def update_alert(
    alert_id: str,
    req: UpdateAlertRequest,
    db: Session = Depends(get_db),
    current_user = Depends(require_write_permission)
):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found.")
        
    before_state = {
        "status": alert.status,
        "assigned_analyst_id": alert.assigned_analyst_id,
        "assigned_analyst_name": alert.assigned_analyst_name,
        "cleared_reason": alert.cleared_reason
    }
    
    if req.status:
        valid_statuses = [
            "New", "Assigned", "Under Review", "Merchant Information Requested",
            "Escalated", "Cleared", "Confirmed Policy Breach", "Closed — Insufficient Evidence"
        ]
        if req.status not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of {valid_statuses}")
            
        if req.status == "Cleared" and not (req.cleared_reason or req.rationale):
            raise HTTPException(status_code=400, detail="A mandatory rationale/cleared reason is required to clear an alert.")
            
        alert.status = req.status
        if req.cleared_reason:
            alert.cleared_reason = req.cleared_reason
            
    if req.assigned_analyst_id is not None:
        assignee = db.query(User).filter(User.id == req.assigned_analyst_id).first()
        if not assignee:
            raise HTTPException(status_code=404, detail="Assignee user not found.")
        alert.assigned_analyst_id = assignee.id
        alert.assigned_analyst_name = assignee.full_name
        if alert.status == "New":
            alert.status = "Assigned"
            
    alert.updated_at = datetime.datetime.now(datetime.timezone.utc)
    
    after_state = {
        "status": alert.status,
        "assigned_analyst_id": alert.assigned_analyst_id,
        "assigned_analyst_name": alert.assigned_analyst_name,
        "cleared_reason": alert.cleared_reason
    }
    
    # Audit log entry
    audit = AuditEvent(
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        actor_role=current_user.role,
        action="ALERT_UPDATE",
        entity_type="Alert",
        entity_id=alert.id,
        before_state=json.dumps(before_state),
        after_state=json.dumps(after_state),
        rationale=req.rationale or req.cleared_reason or f"Updated alert status to {alert.status}"
    )
    db.add(audit)
    db.commit()
    
    return {"status": "success", "alert_id": alert.id, "current_status": alert.status}

@router.post("/bulk-assign")
def bulk_assign_alerts(
    req: BulkAssignRequest,
    db: Session = Depends(get_db),
    current_user = Depends(require_write_permission)
):
    analyst = db.query(User).filter(User.id == req.analyst_id).first()
    if not analyst:
        raise HTTPException(status_code=404, detail="Analyst not found.")
        
    alerts = db.query(Alert).filter(Alert.id.in_(req.alert_ids)).all()
    for a in alerts:
        a.assigned_analyst_id = analyst.id
        a.assigned_analyst_name = analyst.full_name
        if a.status == "New":
            a.status = "Assigned"
        a.updated_at = datetime.datetime.now(datetime.timezone.utc)
        
        db.add(AuditEvent(
            actor_id=current_user.id,
            actor_name=current_user.full_name,
            actor_role=current_user.role,
            action="ALERT_BULK_ASSIGN",
            entity_type="Alert",
            entity_id=a.id,
            before_state=None,
            after_state=json.dumps({"assigned_to": analyst.full_name}),
            rationale=req.rationale
        ))
    db.commit()
    return {"status": "success", "updated_count": len(alerts)}
