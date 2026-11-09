import json
import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import desc
from ..database import get_db
from ..models import Case, CaseNote, EvidenceItem, Alert, Merchant, User, AuditEvent
from ..auth import get_current_user, require_write_permission, require_reviewer

router = APIRouter(prefix="/cases", tags=["Investigation Cases"])

class CreateCaseRequest(BaseModel):
    title: str
    merchant_id: str
    alert_ids: List[str]
    priority: str = "Medium" # Low, Medium, High, Critical
    initial_note: Optional[str] = None

class AddCaseNoteRequest(BaseModel):
    note_type: str = "Investigation Note" # Investigation Note, Review Note
    content: str

class RecommendActionRequest(BaseModel):
    recommendation: str
    rationale: str

class ReviewerDecisionRequest(BaseModel):
    decision: str # Approved, Rejected, Modification Requested
    rationale: str

class CloseCaseRequest(BaseModel):
    status: str # Closed — Cleared, Closed — Simulated Containment, Closed — Insufficient Evidence
    reason: str

class ReopenCaseRequest(BaseModel):
    reason: str

@router.get("")
def list_cases(
    status_filter: Optional[str] = Query(None, alias="status"),
    priority: Optional[str] = None,
    merchant_id: Optional[str] = None,
    assigned_to_id: Optional[int] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(15, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    query = db.query(Case)
    if status_filter:
        query = query.filter(Case.status == status_filter)
    if priority:
        query = query.filter(Case.priority == priority)
    if merchant_id:
        query = query.filter(Case.merchant_id == merchant_id)
    if assigned_to_id:
        query = query.filter(Case.assigned_to_id == assigned_to_id)
        
    total_count = query.count()
    items = query.order_by(desc(Case.updated_at)).offset((page - 1) * page_size).limit(page_size).all()
    
    results = []
    for c in items:
        m = db.query(Merchant).filter(Merchant.id == c.merchant_id).first()
        results.append({
            "id": c.id,
            "title": c.title,
            "merchant_id": c.merchant_id,
            "merchant_name": m.name if m else c.merchant_id,
            "merchant_category": m.business_category if m else "Unknown",
            "merchant_risk_score": m.current_risk_score if m else 0,
            "merchant_risk_tier": m.current_risk_tier if m else 0,
            "status": c.status,
            "priority": c.priority,
            "assigned_to_id": c.assigned_to_id,
            "assigned_to_name": c.assigned_to_name or "Unassigned",
            "current_recommendation": c.current_recommendation,
            "reviewer_decision": c.reviewer_decision,
            "created_at": c.created_at.isoformat(),
            "updated_at": c.updated_at.isoformat(),
        })
        
    return {
        "items": results,
        "total": total_count,
        "page": page,
        "page_size": page_size,
        "total_pages": (total_count + page_size - 1) // page_size
    }

@router.post("")
def create_case(
    req: CreateCaseRequest,
    db: Session = Depends(get_db),
    current_user = Depends(require_write_permission)
):
    merchant = db.query(Merchant).filter(Merchant.id == req.merchant_id).first()
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found.")
        
    now = datetime.datetime.now(datetime.timezone.utc)
    import uuid
    case_id = f"CASE-{now.year}-{int(now.timestamp()) % 10000:04d}-{uuid.uuid4().hex[:4].upper()}"
    
    new_case = Case(
        id=case_id,
        title=req.title,
        merchant_id=req.merchant_id,
        alert_ids=json.dumps(req.alert_ids),
        status="Open",
        priority=req.priority,
        assigned_to_id=current_user.id,
        assigned_to_name=current_user.full_name,
        created_at=now,
        updated_at=now
    )
    db.add(new_case)
    db.flush()
    
    if req.initial_note:
        note = CaseNote(
            case_id=new_case.id,
            author_id=current_user.id,
            author_name=current_user.full_name,
            note_type="Investigation Note",
            content=req.initial_note,
            created_at=now
        )
        db.add(note)
        
    # Mark linked alerts as Under Review
    for aid in req.alert_ids:
        alert = db.query(Alert).filter(Alert.id == aid).first()
        if alert:
            alert.status = "Under Review"
            alert.assigned_analyst_id = current_user.id
            alert.assigned_analyst_name = current_user.full_name
            alert.updated_at = now
            
    # Audit log
    db.add(AuditEvent(
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        actor_role=current_user.role,
        action="CASE_CREATE",
        entity_type="Case",
        entity_id=new_case.id,
        before_state=None,
        after_state=json.dumps({"title": req.title, "merchant_id": req.merchant_id}),
        rationale=f"Created investigation case linked to alerts: {', '.join(req.alert_ids)}"
    ))
    db.commit()
    
    return {"status": "success", "case_id": new_case.id}

@router.get("/{case_id}")
def get_case_detail(
    case_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    c = db.query(Case).filter(Case.id == case_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Case not found.")
        
    merchant = db.query(Merchant).filter(Merchant.id == c.merchant_id).first()
    notes = db.query(CaseNote).filter(CaseNote.case_id == c.id).order_by(CaseNote.created_at.asc()).all()
    evidence = db.query(EvidenceItem).filter(EvidenceItem.case_id == c.id).order_by(EvidenceItem.created_at.asc()).all()
    
    alert_ids = json.loads(c.alert_ids) if c.alert_ids else []
    alerts = db.query(Alert).filter(Alert.id.in_(alert_ids)).all()
    
    audits = db.query(AuditEvent).filter(
        AuditEvent.entity_type == "Case",
        AuditEvent.entity_id == c.id
    ).order_by(AuditEvent.timestamp.asc()).all()

    return {
        "case": {
            "id": c.id,
            "title": c.title,
            "merchant_id": c.merchant_id,
            "status": c.status,
            "priority": c.priority,
            "assigned_to_id": c.assigned_to_id,
            "assigned_to_name": c.assigned_to_name or "Unassigned",
            "current_recommendation": c.current_recommendation,
            "recommendation_rationale": c.recommendation_rationale,
            "reviewer_decision": c.reviewer_decision,
            "reviewer_rationale": c.reviewer_rationale,
            "closed_reason": c.closed_reason,
            "reopen_reason": c.reopen_reason,
            "created_at": c.created_at.isoformat(),
            "updated_at": c.updated_at.isoformat(),
        },
        "merchant": {
            "id": merchant.id if merchant else c.merchant_id,
            "name": merchant.name if merchant else "Unknown",
            "category": merchant.business_category if merchant else "Unknown",
            "city": merchant.city if merchant else "Unknown",
            "current_score": merchant.current_risk_score if merchant else 0,
            "current_tier": merchant.current_risk_tier if merchant else 0,
            "declared_operating_hours": merchant.declared_operating_hours if merchant else "",
        },
        "notes": [{
            "id": n.id,
            "author_id": n.author_id,
            "author_name": n.author_name,
            "note_type": n.note_type,
            "content": n.content,
            "created_at": n.created_at.isoformat()
        } for n in notes],
        "evidence": [{
            "id": e.id,
            "title": e.title,
            "evidence_type": e.evidence_type,
            "description": e.description,
            "provenance_type": e.provenance_type,
            "raw_data": json.loads(e.raw_data_json) if e.raw_data_json else None,
            "created_at": e.created_at.isoformat()
        } for e in evidence],
        "linked_alerts": [{
            "id": a.id,
            "score": a.score,
            "tier": a.tier,
            "severity": a.severity,
            "status": a.status,
            "triggered_signals": json.loads(a.triggered_signals) if a.triggered_signals else []
        } for a in alerts],
        "audit_trail": [{
            "id": a.id,
            "actor_name": a.actor_name,
            "actor_role": a.actor_role,
            "action": a.action,
            "rationale": a.rationale,
            "timestamp": a.timestamp.isoformat()
        } for a in audits]
    }

@router.post("/{case_id}/notes")
def add_case_note(
    case_id: str,
    req: AddCaseNoteRequest,
    db: Session = Depends(get_db),
    current_user = Depends(require_write_permission)
):
    c = db.query(Case).filter(Case.id == case_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Case not found.")
        
    now = datetime.datetime.now(datetime.timezone.utc)
    note = CaseNote(
        case_id=c.id,
        author_id=current_user.id,
        author_name=current_user.full_name,
        note_type=req.note_type,
        content=req.content,
        created_at=now
    )
    db.add(note)
    c.updated_at = now
    
    db.add(AuditEvent(
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        actor_role=current_user.role,
        action="CASE_NOTE_ADD",
        entity_type="Case",
        entity_id=c.id,
        before_state=None,
        after_state=json.dumps({"note_preview": req.content[:100]}),
        rationale=f"Added {req.note_type}"
    ))
    db.commit()
    return {"status": "success", "note_id": note.id}

@router.post("/{case_id}/recommendation")
def recommend_action(
    case_id: str,
    req: RecommendActionRequest,
    db: Session = Depends(get_db),
    current_user = Depends(require_write_permission)
):
    c = db.query(Case).filter(Case.id == case_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Case not found.")
        
    now = datetime.datetime.now(datetime.timezone.utc)
    c.current_recommendation = req.recommendation
    c.recommendation_rationale = req.rationale
    c.status = "Senior Review Pending"
    c.updated_at = now
    
    db.add(AuditEvent(
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        actor_role=current_user.role,
        action="CASE_RECOMMENDATION_SUBMIT",
        entity_type="Case",
        entity_id=c.id,
        before_state=None,
        after_state=json.dumps({"recommendation": req.recommendation}),
        rationale=req.rationale
    ))
    db.commit()
    return {"status": "success", "current_recommendation": c.current_recommendation}

@router.post("/{case_id}/review-decision")
def review_decision(
    case_id: str,
    req: ReviewerDecisionRequest,
    db: Session = Depends(get_db),
    current_user = Depends(require_reviewer)
):
    c = db.query(Case).filter(Case.id == case_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Case not found.")
        
    now = datetime.datetime.now(datetime.timezone.utc)
    c.reviewer_decision = req.decision
    c.reviewer_rationale = req.rationale
    if req.decision == "Approved":
        c.status = "Closed — Simulated Containment"
    elif req.decision == "Rejected":
        c.status = "Under Investigation"
    else:
        c.status = "Pending Merchant Clarification"
        
    c.updated_at = now
    
    db.add(AuditEvent(
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        actor_role=current_user.role,
        action=f"REVIEW_DECISION_{req.decision.upper()}",
        entity_type="Case",
        entity_id=c.id,
        before_state=None,
        after_state=json.dumps({"decision": req.decision, "case_status": c.status}),
        rationale=req.rationale
    ))
    db.commit()
    return {"status": "success", "decision": req.decision, "case_status": c.status}

@router.patch("/{case_id}/close")
def close_case(
    case_id: str,
    req: CloseCaseRequest,
    db: Session = Depends(get_db),
    current_user = Depends(require_write_permission)
):
    c = db.query(Case).filter(Case.id == case_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Case not found.")
        
    if not req.reason or len(req.reason.strip()) < 5:
        raise HTTPException(status_code=400, detail="A mandatory closure reason of at least 5 characters is required.")
        
    now = datetime.datetime.now(datetime.timezone.utc)
    before_status = c.status
    c.status = req.status
    c.closed_reason = req.reason
    c.updated_at = now
    
    db.add(AuditEvent(
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        actor_role=current_user.role,
        action="CASE_CLOSE",
        entity_type="Case",
        entity_id=c.id,
        before_state=json.dumps({"status": before_status}),
        after_state=json.dumps({"status": c.status, "closed_reason": c.closed_reason}),
        rationale=req.reason
    ))
    db.commit()
    return {"status": "success", "status": c.status}

@router.patch("/{case_id}/reopen")
def reopen_case(
    case_id: str,
    req: ReopenCaseRequest,
    db: Session = Depends(get_db),
    current_user = Depends(require_write_permission)
):
    c = db.query(Case).filter(Case.id == case_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Case not found.")
        
    if not req.reason:
        raise HTTPException(status_code=400, detail="A mandatory reason is required to reopen a case.")
        
    now = datetime.datetime.now(datetime.timezone.utc)
    before_status = c.status
    c.status = "Under Investigation"
    c.reopen_reason = req.reason
    c.updated_at = now
    
    db.add(AuditEvent(
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        actor_role=current_user.role,
        action="CASE_REOPEN",
        entity_type="Case",
        entity_id=c.id,
        before_state=json.dumps({"status": before_status}),
        after_state=json.dumps({"status": "Under Investigation", "reopen_reason": req.reason}),
        rationale=req.reason
    ))
    db.commit()
    return {"status": "success", "status": c.status}
