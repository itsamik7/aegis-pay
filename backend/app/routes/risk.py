import json
import datetime
from typing import Dict, Any, Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import desc
from ..database import get_db
from ..models import (
    RiskSignal, RiskConfiguration, RiskConfigurationVersion, 
    Merchant, AuditEvent
)
from ..auth import get_current_user, require_admin
from ..risk_engine.signals import SIGNALS_CATALOG
from ..risk_engine.scorer import evaluate_merchant_risk, TIER_DEFINITIONS

router = APIRouter(prefix="/risk", tags=["Risk Engine & Policy"])

class UpdatePolicyConfigInput(BaseModel):
    version: str # e.g. v1.1.0
    weights: Dict[str, float]
    thresholds: Dict[str, float]
    tier_boundaries: Optional[Dict[str, Any]] = None
    change_rationale: str

class RollbackVersionInput(BaseModel):
    target_version: str
    rationale: str

@router.get("/signals")
def get_signals_catalog(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Returns all 10 behavioural risk signals with metadata."""
    db_signals = db.query(RiskSignal).all()
    results = []
    for s in db_signals:
        results.append({
            "id": s.id,
            "name": s.name,
            "dimension": s.dimension,
            "weight": s.weight,
            "threshold": s.threshold,
            "severity": s.severity,
            "confidence_label": s.confidence_label,
            "formula_description": s.formula_description,
            "analyst_explanation": s.analyst_explanation,
            "false_positive_notes": s.false_positive_notes,
            "is_active": s.is_active,
        })
    return results

@router.get("/config")
def get_active_configuration(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    active_cfg = db.query(RiskConfiguration).filter(RiskConfiguration.is_active == True).first()
    if not active_cfg:
        raise HTTPException(status_code=404, detail="Active configuration not found.")
        
    return {
        "version": active_cfg.version,
        "is_active": active_cfg.is_active,
        "weights": json.loads(active_cfg.weights_json),
        "thresholds": json.loads(active_cfg.thresholds_json),
        "tier_boundaries": json.loads(active_cfg.tier_boundaries_json),
        "created_by": active_cfg.created_by,
        "created_at": active_cfg.created_at.isoformat(),
        "notes": active_cfg.notes,
        "tier_definitions": TIER_DEFINITIONS,
        "disclaimer": "Illustrative demo defaults — require calibration on real, authorised data."
    }

@router.get("/config/versions")
def get_configuration_versions(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    versions = db.query(RiskConfigurationVersion).order_by(desc(RiskConfigurationVersion.created_at)).all()
    return [{
        "version": v.version,
        "created_by": v.created_by,
        "created_at": v.created_at.isoformat(),
        "change_rationale": v.change_rationale,
    } for v in versions]

@router.put("/config")
def update_policy_configuration(
    req: UpdatePolicyConfigInput,
    db: Session = Depends(get_db),
    current_user = Depends(require_admin)
):
    """
    Admin-only: updates weights, thresholds, tier boundaries; saves new version and logs audit event.
    """
    if not req.change_rationale or len(req.change_rationale.strip()) < 10:
        raise HTTPException(status_code=400, detail="A detailed change rationale of at least 10 characters is required.")
        
    # Validation: ensure weights are non-negative
    for k, v in req.weights.items():
        if v < 0 or v > 500:
            raise HTTPException(status_code=400, detail=f"Weight for {k} must be between 0 and 500.")
            
    now = datetime.datetime.now(datetime.timezone.utc)
    
    # Deactivate current active config
    active_cfg = db.query(RiskConfiguration).filter(RiskConfiguration.is_active == True).first()
    old_version = active_cfg.version if active_cfg else "v1.0.0"
    if active_cfg:
        active_cfg.is_active = False
        
    # Check if version string already exists
    existing_v = db.query(RiskConfiguration).filter(RiskConfiguration.version == req.version).first()
    if existing_v:
        # increment patch version automatically
        req.version = f"{req.version}-{int(now.timestamp())}"
        
    tier_boundaries_json = json.dumps(req.tier_boundaries) if req.tier_boundaries else (active_cfg.tier_boundaries_json if active_cfg else "{}")
    
    new_cfg = RiskConfiguration(
        version=req.version,
        is_active=True,
        weights_json=json.dumps(req.weights),
        thresholds_json=json.dumps(req.thresholds),
        tier_boundaries_json=tier_boundaries_json,
        created_by=f"{current_user.full_name} ({current_user.role})",
        created_at=now,
        notes=req.change_rationale
    )
    db.add(new_cfg)
    
    # Record version history
    hist = RiskConfigurationVersion(
        version=req.version,
        weights_json=json.dumps(req.weights),
        thresholds_json=json.dumps(req.thresholds),
        tier_boundaries_json=tier_boundaries_json,
        change_rationale=req.change_rationale,
        created_by=current_user.full_name,
        created_at=now
    )
    db.add(hist)
    
    # Audit log
    db.add(AuditEvent(
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        actor_role=current_user.role,
        action="POLICY_CONFIGURATION_UPDATE",
        entity_type="RiskConfiguration",
        entity_id=req.version,
        before_state=json.dumps({"version": old_version}),
        after_state=json.dumps({"version": req.version}),
        rationale=req.change_rationale
    ))
    db.commit()
    return {"status": "success", "new_version": req.version}

@router.post("/config/rollback")
def rollback_configuration(
    req: RollbackVersionInput,
    db: Session = Depends(get_db),
    current_user = Depends(require_admin)
):
    target = db.query(RiskConfigurationVersion).filter(RiskConfigurationVersion.version == req.target_version).first()
    if not target:
        raise HTTPException(status_code=404, detail="Target configuration version not found in history.")
        
    now = datetime.datetime.now(datetime.timezone.utc)
    active_cfg = db.query(RiskConfiguration).filter(RiskConfiguration.is_active == True).first()
    if active_cfg:
        active_cfg.is_active = False
        
    restored_version_name = f"{req.target_version}-restored-{int(now.timestamp())}"
    restored_cfg = RiskConfiguration(
        version=restored_version_name,
        is_active=True,
        weights_json=target.weights_json,
        thresholds_json=target.thresholds_json,
        tier_boundaries_json=target.tier_boundaries_json,
        created_by=f"{current_user.full_name} ({current_user.role})",
        created_at=now,
        notes=f"Restored from version {req.target_version}. Reason: {req.rationale}"
    )
    db.add(restored_cfg)
    
    db.add(AuditEvent(
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        actor_role=current_user.role,
        action="POLICY_CONFIGURATION_ROLLBACK",
        entity_type="RiskConfiguration",
        entity_id=restored_version_name,
        before_state=json.dumps({"version": active_cfg.version if active_cfg else "unknown"}),
        after_state=json.dumps({"version": restored_version_name}),
        rationale=req.rationale
    ))
    db.commit()
    return {"status": "success", "active_version": restored_version_name}

@router.get("/evaluate/{merchant_id}")
def evaluate_merchant(
    merchant_id: str,
    window_hours: int = Query(48, ge=6, le=168),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    merchant = db.query(Merchant).filter(Merchant.id == merchant_id).first()
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found.")
        
    result = evaluate_merchant_risk(
        merchant=merchant,
        db=db,
        window_hours=window_hours,
        record_snapshot=True,
        actor_name=current_user.full_name
    )
    return result
