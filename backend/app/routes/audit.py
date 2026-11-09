import json
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from ..database import get_db
from ..models import AuditEvent
from ..auth import get_current_user

router = APIRouter(prefix="/audit", tags=["Audit Trail"])

@router.get("")
def list_audit_events(
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    action: Optional[str] = None,
    actor_id: Optional[int] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    query = db.query(AuditEvent)
    if entity_type:
        query = query.filter(AuditEvent.entity_type == entity_type)
    if entity_id:
        query = query.filter(AuditEvent.entity_id == entity_id)
    if action:
        query = query.filter(AuditEvent.action == action)
    if actor_id:
        query = query.filter(AuditEvent.actor_id == actor_id)
        
    total_count = query.count()
    items = query.order_by(desc(AuditEvent.timestamp)).offset((page - 1) * page_size).limit(page_size).all()
    
    results = []
    for a in items:
        results.append({
            "id": a.id,
            "timestamp": a.timestamp.isoformat(),
            "actor_id": a.actor_id,
            "actor_name": a.actor_name,
            "actor_role": a.actor_role,
            "action": a.action,
            "entity_type": a.entity_type,
            "entity_id": a.entity_id,
            "before_state": json.loads(a.before_state) if a.before_state else None,
            "after_state": json.loads(a.after_state) if a.after_state else None,
            "rationale": a.rationale,
            "ip_address": a.ip_address
        })
        
    return {
        "items": results,
        "total": total_count,
        "page": page,
        "page_size": page_size,
        "total_pages": (total_count + page_size - 1) // page_size
    }
