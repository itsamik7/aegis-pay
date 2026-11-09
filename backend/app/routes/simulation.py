import datetime
import json
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import desc
from ..database import get_db
from ..models import (
    Merchant, SimulationScenario, SimulationRun, Alert, 
    Transaction, AuditEvent, RiskConfiguration
)
from ..auth import get_current_user, require_write_permission, require_admin
from ..simulator.scenarios import (
    SCENARIO_DEFINITIONS, ADVERSARIAL_TEST_CASES, generate_synthetic_transactions
)
from ..simulator.evaluator import run_synthetic_evaluation
from ..simulator.prevalence import calculate_rare_event_impact
from ..risk_engine.scorer import evaluate_merchant_risk, TIER_DEFINITIONS
from ..seed import seed_database

router = APIRouter(prefix="/simulation", tags=["Simulation Lab"])

class RunScenarioInput(BaseModel):
    scenario_key: str
    target_merchant_id: Optional[str] = None
    transaction_count: Optional[int] = None
    observation_hours: int = 48

class PrevalenceInput(BaseModel):
    total_merchants: int = 100000
    prevalence_rate: float = 0.002
    sensitivity: float = 0.85
    false_positive_rate: float = 0.02

@router.get("/scenarios")
def get_scenarios(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    return SCENARIO_DEFINITIONS

@router.get("/adversarial-tests")
def get_adversarial_tests(
    current_user = Depends(get_current_user)
):
    return ADVERSARIAL_TEST_CASES

@router.get("/runs")
def list_simulation_runs(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    runs = db.query(SimulationRun).order_by(desc(SimulationRun.timestamp)).limit(20).all()
    return [{
        "id": r.id,
        "scenario_key": r.scenario_key,
        "merchant_id": r.merchant_id,
        "timestamp": r.timestamp.isoformat(),
        "configuration_version": r.configuration_version,
        "generated_tx_count": r.generated_tx_count,
        "before_score": r.before_score,
        "before_tier": r.before_tier,
        "after_score": r.after_score,
        "after_tier": r.after_tier,
        "generated_alerts_count": r.generated_alerts_count,
        "status": r.status,
        "notes": r.notes
    } for r in runs]

@router.post("/run")
def execute_simulation_run(
    req: RunScenarioInput,
    db: Session = Depends(get_db),
    current_user = Depends(require_write_permission)
):
    # Find matching scenario definition
    sc_meta = next((s for s in SCENARIO_DEFINITIONS if s["key"] == req.scenario_key), None)
    if not sc_meta:
        raise HTTPException(status_code=404, detail="Scenario key not found.")
        
    merchant_id = req.target_merchant_id or sc_meta["target_merchant_id"]
    merchant = db.query(Merchant).filter(Merchant.id == merchant_id).first()
    if not merchant:
        # Fallback to any merchant
        merchant = db.query(Merchant).first()
        if not merchant:
            raise HTTPException(status_code=404, detail="No merchants available to run simulation.")
            
    now = datetime.datetime.now(datetime.timezone.utc)
    
    # Pre-run evaluation
    before_eval = evaluate_merchant_risk(merchant, db, window_hours=req.observation_hours, record_snapshot=False)
    before_score = before_eval["current_score"]
    before_tier = before_eval["current_tier"]
    
    # Generate batch of synthetic transactions
    created_txs = generate_synthetic_transactions(
        merchant_id=merchant.id,
        scenario_key=req.scenario_key,
        db=db,
        start_time=now - datetime.timedelta(hours=req.observation_hours),
        duration_hours=req.observation_hours,
        tx_count_override=req.transaction_count
    )
    
    # Post-run evaluation (updates score and generates alerts if >= Tier 2)
    after_eval = evaluate_merchant_risk(merchant, db, window_hours=req.observation_hours, record_snapshot=True)
    after_score = after_eval["current_score"]
    after_tier = after_eval["current_tier"]
    
    active_cfg = db.query(RiskConfiguration).filter(RiskConfiguration.is_active == True).first()
    config_v = active_cfg.version if active_cfg else "v1.0.0"
    
    import uuid
    run_id = f"SIM-{int(now.timestamp())}-{uuid.uuid4().hex[:4].upper()}"
    sim_run = SimulationRun(
        id=run_id,
        scenario_key=req.scenario_key,
        merchant_id=merchant.id,
        timestamp=now,
        configuration_version=config_v,
        generated_tx_count=len(created_txs),
        before_score=before_score,
        before_tier=before_tier,
        after_score=after_score,
        after_tier=after_tier,
        generated_alerts_count=after_eval.get("triggered_count", 0),
        status="Completed",
        notes=f"Evaluated {sc_meta['title']}. Score moved from {before_score} (Tier {before_tier}) to {after_score} (Tier {after_tier})."
    )
    db.add(sim_run)
    
    db.add(AuditEvent(
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        actor_role=current_user.role,
        action="SIMULATION_EXECUTE",
        entity_type="SimulationRun",
        entity_id=run_id,
        before_state=json.dumps({"score": before_score, "tier": before_tier}),
        after_state=json.dumps({"score": after_score, "tier": after_tier}),
        rationale=f"Simulated {sc_meta['title']} on merchant {merchant.id}"
    ))
    db.commit()
    
    return {
        "status": "success",
        "run_id": run_id,
        "scenario": sc_meta,
        "merchant_id": merchant.id,
        "merchant_name": merchant.name,
        "generated_transactions": len(created_txs),
        "before": {
            "score": before_score,
            "tier": before_tier,
            "tier_label": TIER_DEFINITIONS[before_tier]["label"]
        },
        "after": {
            "score": after_score,
            "tier": after_tier,
            "tier_label": TIER_DEFINITIONS[after_tier]["label"],
            "tier_action": TIER_DEFINITIONS[after_tier]["action"],
            "signals": after_eval["signals"],
            "reason_summary": after_eval["reason_summary"]
        }
    }

@router.get("/evaluate")
def get_synthetic_evaluation(
    ablation: Optional[str] = None, # e.g. WHEN, WHO, HOW FAST, CAPACITY
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Evaluates engine performance across the labelled synthetic test set.
    """
    return run_synthetic_evaluation(db, ablation_exclude_dimension=ablation)

@router.post("/prevalence")
def calculate_prevalence(
    req: PrevalenceInput,
    current_user = Depends(get_current_user)
):
    """
    Computes Bayesian impact of rare-event fraud on precision & false discovery rates.
    """
    return calculate_rare_event_impact(
        total_merchants=req.total_merchants,
        prevalence_rate=req.prevalence_rate,
        sensitivity=req.sensitivity,
        false_positive_rate=req.false_positive_rate
    )

@router.post("/reset")
def reset_demo_data(
    db: Session = Depends(get_db),
    current_user = Depends(require_admin)
):
    """
    Admin-only: restores synthetic demo dataset to pristine initial state.
    """
    seed_database(force=True)
    return {"status": "success", "message": "Demo database reset to pristine baseline synthetic state."}
