import pytest
from app.risk_engine.scorer import score_to_tier, TIER_DEFINITIONS
from app.risk_engine.signals import SIGNALS_CATALOG
from app.database import SessionLocal
from app.models import Merchant
from app.risk_engine.scorer import evaluate_merchant_risk

def test_tier_boundaries_exact():
    """
    Non-negotiable acceptance test:
    Tier boundaries must be tested exactly at:
    250 / 251, 500 / 501, 700 / 701, 850 / 851, and 950 / 951.
    Six tiers numbered 0–5.
    """
    assert len(TIER_DEFINITIONS) == 6
    assert [t["tier"] for t in TIER_DEFINITIONS] == [0, 1, 2, 3, 4, 5]
    
    # Boundary 0 -> 1 at 250 / 251
    assert score_to_tier(0) == 0
    assert score_to_tier(250) == 0
    assert score_to_tier(251) == 1
    
    # Boundary 1 -> 2 at 500 / 501
    assert score_to_tier(500) == 1
    assert score_to_tier(501) == 2
    
    # Boundary 2 -> 3 at 700 / 701
    assert score_to_tier(700) == 2
    assert score_to_tier(701) == 3
    
    # Boundary 3 -> 4 at 850 / 851
    assert score_to_tier(850) == 3
    assert score_to_tier(851) == 4
    
    # Boundary 4 -> 5 at 950 / 951
    assert score_to_tier(950) == 4
    assert score_to_tier(951) == 5
    assert score_to_tier(1000) == 5
    
    # Out of range clamping
    assert score_to_tier(-10) == 0
    assert score_to_tier(1500) == 5

def test_five_behavioural_dimensions_catalog():
    """Verify all 5 dimensions exist in signals catalog."""
    dimensions = set(s["dimension"] for s in SIGNALS_CATALOG.values())
    assert "WHEN" in dimensions
    assert "HOW MUCH" in dimensions
    assert "WHO" in dimensions
    assert "HOW FAST" in dimensions
    assert "CAPACITY / PLAUSIBILITY" in dimensions
    assert len(SIGNALS_CATALOG) >= 10

def test_risk_evaluation_reproducibility():
    """Risk score on same data must be deterministic and reproducible."""
    db = SessionLocal()
    merchant = db.query(Merchant).filter(Merchant.id == "MER-001-GOLDEN").first()
    assert merchant is not None
    
    eval1 = evaluate_merchant_risk(merchant, db, window_hours=48, record_snapshot=False)
    eval2 = evaluate_merchant_risk(merchant, db, window_hours=48, record_snapshot=False)
    
    assert eval1["current_score"] == eval2["current_score"]
    assert eval1["current_tier"] == eval2["current_tier"]
    assert len(eval1["signals"]) == len(eval2["signals"])
    db.close()

def test_festive_merchant_seasonality_damped():
    """Festive bakery surge should have calendar context and avoid severe false alarm."""
    db = SessionLocal()
    festive_merchant = db.query(Merchant).filter(Merchant.id == "MER-002-FESTIVE").first()
    assert festive_merchant is not None
    
    res = evaluate_merchant_risk(festive_merchant, db, window_hours=48, record_snapshot=False)
    # Must have calendar context active
    assert res["calendar_context"]["has_calendar_event"] is True
    # Tier should remain low (0 or 1), not escalated to Tier 4 or 5
    assert res["current_tier"] in [0, 1]
    db.close()

def test_hybrid_betting_front_escalated():
    """Sunrise Artisanal Bakes (betting front) must escalate to high tier (Tier 4 or 5) with explainable signals."""
    db = SessionLocal()
    sunrise = db.query(Merchant).filter(Merchant.id == "MER-003-SUNRISE").first()
    assert sunrise is not None
    
    res = evaluate_merchant_risk(sunrise, db, window_hours=48, record_snapshot=False)
    assert res["current_tier"] >= 4
    assert res["current_score"] >= 851
    # Check that multiple signals fired
    triggered = [s["id"] for s in res["signals"] if s["triggered"]]
    assert "SIG_TIMING_NIGHT_SPIKE" in triggered or "SIG_TIMING_OFFHOURS" in triggered
    assert "SIG_AMOUNT_ROUND_RATIO" in triggered
    assert "SIG_PAYER_FANIN_VELOCITY" in triggered
    db.close()
