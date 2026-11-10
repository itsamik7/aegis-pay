"""
AEGIS-PAY Deterministic Explainable Risk Scoring Engine
Implements the 4-layer architecture:
1. Observe: Fetch recent transaction window
2. Baseline: Compare against 30-day merchant baseline, cohort, and calendar events
3. Score: Compute weighted transparent signal contributions (0 - 1000 range)
4. Respond: Map to exact graduated tiers (0 - 5) and generate human-governed alerts
"""

import json
import math
import datetime
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.orm import Session
from ..models import (
    Merchant, Transaction, SettlementEvent, RiskSignal, 
    RiskScoreSnapshot, Alert, AuditEvent, RiskConfiguration
)
from .signals import SIGNALS_CATALOG
from .baselines import get_merchant_baseline, get_cohort_baseline, get_active_calendar_context

TIER_DEFINITIONS = [
    {
        "tier": 0,
        "min_score": 0,
        "max_score": 250,
        "label": "Standard",
        "action": "Standard settlement; normal monitoring",
        "color": "emerald",
    },
    {
        "tier": 1,
        "min_score": 251,
        "max_score": 500,
        "label": "Passive Monitoring",
        "action": "Continue monitoring; record trend",
        "color": "sky",
    },
    {
        "tier": 2,
        "min_score": 501,
        "max_score": 700,
        "label": "Targeted Merchant Query",
        "action": "Request clarification and supporting information",
        "color": "amber",
    },
    {
        "tier": 3,
        "min_score": 701,
        "max_score": 850,
        "label": "Enhanced Review",
        "action": "Stronger verification; recommend policy review of incremental exposure",
        "color": "orange",
    },
    {
        "tier": 4,
        "min_score": 851,
        "max_score": 950,
        "label": "Senior Review / Containment Recommendation",
        "action": "Escalate for senior human review; simulated recommendation only",
        "color": "red",
    },
    {
        "tier": 5,
        "min_score": 951,
        "max_score": 1000,
        "label": "Compliance Decision Required",
        "action": "Mandatory senior/compliance review; no automatic finding or real offboarding",
        "color": "rose",
    },
]

def score_to_tier(score: int) -> int:
    """
    Exact mapping for the six tiers (0 - 5):
    0-250: Tier 0
    251-500: Tier 1
    501-700: Tier 2
    701-850: Tier 3
    851-950: Tier 4
    951-1000: Tier 5
    """
    clamped_score = max(0, min(1000, score))
    if clamped_score <= 250:
        return 0
    elif clamped_score <= 500:
        return 1
    elif clamped_score <= 700:
        return 2
    elif clamped_score <= 850:
        return 3
    elif clamped_score <= 950:
        return 4
    else:
        return 5

def evaluate_merchant_risk(
    merchant: Merchant,
    db: Session,
    window_hours: int = 48,
    custom_weights: Optional[Dict[str, float]] = None,
    custom_thresholds: Optional[Dict[str, float]] = None,
    evaluation_time: Optional[datetime.datetime] = None,
    record_snapshot: bool = True,
    actor_name: str = "Risk Engine System"
) -> Dict[str, Any]:
    """
    Evaluates merchant risk over an observation window.
    Returns full explainable evaluation payload.
    """
    if evaluation_time is None:
        evaluation_time = datetime.datetime.now(datetime.timezone.utc)
        
    window_start = evaluation_time - datetime.timedelta(hours=window_hours)
    
    # 1. OBSERVE: Fetch recent transactions
    recent_txs = db.query(Transaction).filter(
        Transaction.merchant_id == merchant.id,
        Transaction.timestamp >= window_start,
        Transaction.timestamp <= evaluation_time,
        Transaction.status == "Success"
    ).all()
    
    # 2. BASELINE: Fetch merchant baseline, cohort benchmark, calendar context
    baseline = get_merchant_baseline(merchant, db, end_time=window_start)
    cohort = get_cohort_baseline(merchant, db)
    calendar_ctx = get_active_calendar_context(window_start, evaluation_time, merchant.business_category, db)
    
    has_sufficient_baseline = baseline.get("has_sufficient_baseline", False)
    
    # Get active configuration weights/thresholds
    active_config = db.query(RiskConfiguration).filter(RiskConfiguration.is_active == True).first()
    config_version = active_config.version if active_config else "v1.0.0"
    
    weights = {}
    thresholds = {}
    if active_config:
        try:
            weights = json.loads(active_config.weights_json)
            thresholds = json.loads(active_config.thresholds_json)
        except Exception:
            pass
            
    if custom_weights:
        weights.update(custom_weights)
    if custom_thresholds:
        thresholds.update(custom_thresholds)
        
    # Apply defaults if not set
    for sig_id, meta in SIGNALS_CATALOG.items():
        if sig_id not in weights:
            weights[sig_id] = meta["weight"]
        if sig_id not in thresholds:
            thresholds[sig_id] = meta["threshold"]
            
    # Compute observed window metrics
    tx_count = len(recent_txs)
    if tx_count == 0:
        # No recent transactions in window
        base_score = min(merchant.current_risk_score, 100) # Decay towards baseline low score
        tier = score_to_tier(base_score)
        return {
            "merchant_id": merchant.id,
            "merchant_name": merchant.name,
            "evaluation_time": evaluation_time.isoformat(),
            "observation_window_hours": window_hours,
            "transaction_count": 0,
            "total_volume": 0.0,
            "current_score": base_score,
            "current_tier": tier,
            "tier_label": TIER_DEFINITIONS[tier]["label"],
            "recommended_action": TIER_DEFINITIONS[tier]["action"],
            "has_sufficient_baseline": has_sufficient_baseline,
            "calendar_context": calendar_ctx,
            "signals": [],
            "reason_summary": "No transactions in evaluation window; merchant in quiet state.",
            "configuration_version": config_version,
        }

    amounts = [t.amount for t in recent_txs]
    total_volume = sum(amounts)
    avg_ticket = total_volume / tx_count
    
    # Parse operating hours
    start_hour, end_hour = 8, 22
    if merchant.declared_operating_hours and "-" in merchant.declared_operating_hours:
        try:
            parts = merchant.declared_operating_hours.split("-")
            start_hour = int(parts[0].strip().split(":")[0])
            end_hour = int(parts[1].strip().split(":")[0])
        except Exception:
            start_hour, end_hour = 8, 22
            
    # Timing calculations
    offhours_count = sum(1 for t in recent_txs if (t.timestamp.hour < start_hour or t.timestamp.hour >= end_hour))
    observed_offhours_ratio = offhours_count / tx_count
    
    night_count = sum(1 for t in recent_txs if (t.timestamp.hour >= 23 or t.timestamp.hour < 5))
    observed_night_ratio = night_count / tx_count
    
    # Amount calculations
    round_count = sum(1 for a in amounts if a >= 100 and (a % 100 == 0 or a % 500 == 0 or a % 1000 == 0))
    observed_round_ratio = round_count / tx_count
    
    baseline_avg_ticket = baseline.get("avg_ticket", 180.0)
    baseline_std = max(10.0, baseline.get("std_ticket", 40.0))
    ticket_z_score = max(0.0, (avg_ticket - baseline_avg_ticket) / baseline_std)
    
    # Payer calculations (pseudonymous tokens)
    payer_counts: Dict[str, int] = {}
    timestamps_by_payer: Dict[str, List[datetime.datetime]] = {}
    for t in recent_txs:
        payer_counts[t.payer_token] = payer_counts.get(t.payer_token, 0) + 1
        timestamps_by_payer.setdefault(t.payer_token, []).append(t.timestamp)
        
    unique_payers = len(payer_counts)
    repeat_payers = sum(1 for p, c in payer_counts.items() if c > 1)
    observed_repeat_ratio = repeat_payers / max(1, unique_payers)
    
    # Fan-in velocity: unique payers per 24h vs expected unique new customers
    window_days = max(0.1, window_hours / 24.0)
    payers_per_day = unique_payers / window_days
    expected_payers_per_day = max(5.0, cohort.get("avg_daily_tx_count", 65.0) * (1.0 - baseline.get("repeat_ratio", 0.55)))
    payer_fanin_ratio = payers_per_day / expected_payers_per_day
    
    # Cluster velocity: check tight bursts (< 60s apart with identical round amounts)
    cluster_tx_count = 0
    sorted_txs = sorted(recent_txs, key=lambda x: x.timestamp)
    for i in range(1, len(sorted_txs)):
        delta_sec = (sorted_txs[i].timestamp - sorted_txs[i-1].timestamp).total_seconds()
        if 0 <= delta_sec <= 60 and sorted_txs[i].amount == sorted_txs[i-1].amount and sorted_txs[i].amount in [500, 1000, 2000, 3000, 5000]:
            cluster_tx_count += 1
    observed_cluster_ratio = cluster_tx_count / max(1, tx_count)
    
    # Flow & Settlement velocity (provider-visible payout events)
    recent_settlements = db.query(SettlementEvent).filter(
        SettlementEvent.merchant_id == merchant.id,
        SettlementEvent.timestamp >= window_start,
        SettlementEvent.timestamp <= evaluation_time
    ).all()
    settlement_volume = sum(s.amount for s in recent_settlements)
    observed_settlement_velocity = min(1.0, settlement_volume / max(1.0, total_volume)) if total_volume > 0 else 0.0
    
    # Capacity / Plausibility
    daily_volume = total_volume / window_days
    cohort_p95 = cohort.get("p95_daily_volume", 25000.0)
    cohort_volume_ratio = daily_volume / max(100.0, cohort_p95)
    
    effective_calendar_multiplier = calendar_ctx.get("effective_multiplier", 1.0)
    baseline_daily = max(1000.0, baseline.get("avg_daily_volume", 5000.0))
    adjusted_baseline_volume = baseline_daily * effective_calendar_multiplier
    baseline_volume_surge = daily_volume / adjusted_baseline_volume
    
    # 3. SCORE: Evaluate individual signals
    signal_results = []
    raw_score = 0.0
    who_dimension_triggered_count = 0
    
    # SIG 1: SIG_TIMING_OFFHOURS
    meta = SIGNALS_CATALOG["SIG_TIMING_OFFHOURS"]
    weight = weights.get(meta["id"], meta["weight"])
    thresh = thresholds.get(meta["id"], meta["threshold"])
    sig1_triggered = observed_offhours_ratio > thresh and tx_count >= 5
    sig1_severity = "High" if observed_offhours_ratio > 0.40 else "Medium"
    sig1_contrib = weight * min(1.0, (observed_offhours_ratio / 0.50)) if sig1_triggered else 0.0
    signal_results.append({
        "id": meta["id"],
        "name": meta["name"],
        "dimension": meta["dimension"],
        "weight": weight,
        "threshold": thresh,
        "observed_value": round(observed_offhours_ratio, 4),
        "observed_display": f"{round(observed_offhours_ratio * 100, 1)}% off-hours",
        "baseline_value": baseline.get("offhours_ratio", 0.05),
        "baseline_display": f"{round(baseline.get('offhours_ratio', 0.05) * 100, 1)}% declared baseline",
        "triggered": sig1_triggered,
        "severity": sig1_severity,
        "contribution": round(sig1_contrib, 1),
        "confidence_label": meta["confidence_label"],
        "analyst_explanation": meta["analyst_explanation"],
        "false_positive_notes": meta["false_positive_notes"],
        "reason_code": "OFFHOURS_CONCENTRATION" if sig1_triggered else None
    })
    raw_score += sig1_contrib
    
    # SIG 2: SIG_TIMING_NIGHT_SPIKE
    meta = SIGNALS_CATALOG["SIG_TIMING_NIGHT_SPIKE"]
    weight = weights.get(meta["id"], meta["weight"])
    thresh = thresholds.get(meta["id"], meta["threshold"])
    sig2_triggered = observed_night_ratio > thresh and tx_count >= 5
    sig2_severity = "High" if observed_night_ratio > 0.50 else "Medium"
    sig2_contrib = weight * min(1.0, (observed_night_ratio / 0.60)) if sig2_triggered else 0.0
    signal_results.append({
        "id": meta["id"],
        "name": meta["name"],
        "dimension": meta["dimension"],
        "weight": weight,
        "threshold": thresh,
        "observed_value": round(observed_night_ratio, 4),
        "observed_display": f"{round(observed_night_ratio * 100, 1)}% night tx (23:00-05:00)",
        "baseline_value": baseline.get("night_ratio", 0.02),
        "baseline_display": f"{round(baseline.get('night_ratio', 0.02) * 100, 1)}% baseline (peer: {round(cohort.get('avg_night_ratio', 0.03)*100, 1)}%)",
        "triggered": sig2_triggered,
        "severity": sig2_severity,
        "contribution": round(sig2_contrib, 1),
        "confidence_label": meta["confidence_label"],
        "analyst_explanation": meta["analyst_explanation"],
        "false_positive_notes": meta["false_positive_notes"],
        "reason_code": "NIGHT_SPIKE_ATYPICAL" if sig2_triggered else None
    })
    raw_score += sig2_contrib
    
    # SIG 3: SIG_AMOUNT_ROUND_RATIO
    meta = SIGNALS_CATALOG["SIG_AMOUNT_ROUND_RATIO"]
    weight = weights.get(meta["id"], meta["weight"])
    thresh = thresholds.get(meta["id"], meta["threshold"])
    sig3_triggered = observed_round_ratio > thresh and tx_count >= 5
    sig3_severity = "High" if observed_round_ratio > 0.70 else "Medium"
    sig3_contrib = weight * min(1.0, (observed_round_ratio / 0.80)) if sig3_triggered else 0.0
    signal_results.append({
        "id": meta["id"],
        "name": meta["name"],
        "dimension": meta["dimension"],
        "weight": weight,
        "threshold": thresh,
        "observed_value": round(observed_round_ratio, 4),
        "observed_display": f"{round(observed_round_ratio * 100, 1)}% round amounts",
        "baseline_value": baseline.get("round_ratio", 0.15),
        "baseline_display": f"{round(baseline.get('round_ratio', 0.15) * 100, 1)}% historical round ratio",
        "triggered": sig3_triggered,
        "severity": sig3_severity,
        "contribution": round(sig3_contrib, 1),
        "confidence_label": meta["confidence_label"],
        "analyst_explanation": meta["analyst_explanation"],
        "false_positive_notes": meta["false_positive_notes"],
        "reason_code": "ROUND_AMOUNT_CLUSTER" if sig3_triggered else None
    })
    raw_score += sig3_contrib
    
    # SIG 4: SIG_AMOUNT_TICKET_DEVIATION
    meta = SIGNALS_CATALOG["SIG_AMOUNT_TICKET_DEVIATION"]
    weight = weights.get(meta["id"], meta["weight"])
    thresh = thresholds.get(meta["id"], meta["threshold"])
    # If festive season active, dampen ticket size deviation
    effective_thresh = thresh * (1.5 if calendar_ctx.get("has_calendar_event") else 1.0)
    sig4_triggered = ticket_z_score > effective_thresh and has_sufficient_baseline
    sig4_severity = "High" if ticket_z_score > 4.0 else "Medium"
    sig4_contrib = weight * min(1.0, ticket_z_score / 4.0) if sig4_triggered else 0.0
    signal_results.append({
        "id": meta["id"],
        "name": meta["name"],
        "dimension": meta["dimension"],
        "weight": weight,
        "threshold": effective_thresh,
        "observed_value": round(ticket_z_score, 2),
        "observed_display": f"Z={round(ticket_z_score, 2)} (Avg ₹{round(avg_ticket, 1)})",
        "baseline_value": baseline_avg_ticket,
        "baseline_display": f"Avg ₹{round(baseline_avg_ticket, 1)} ± ₹{round(baseline_std, 1)}" + (" (Festive dampened)" if calendar_ctx.get("has_calendar_event") else ""),
        "triggered": sig4_triggered,
        "severity": sig4_severity,
        "contribution": round(sig4_contrib, 1),
        "confidence_label": meta["confidence_label"],
        "analyst_explanation": meta["analyst_explanation"],
        "false_positive_notes": meta["false_positive_notes"],
        "reason_code": "TICKET_SIZE_ANOMALY" if sig4_triggered else None
    })
    raw_score += sig4_contrib
    
    # WHO DIMENSION: Avoid double counting correlated payer indicators
    # SIG 5: SIG_PAYER_FANIN_VELOCITY
    meta = SIGNALS_CATALOG["SIG_PAYER_FANIN_VELOCITY"]
    weight = weights.get(meta["id"], meta["weight"])
    thresh = thresholds.get(meta["id"], meta["threshold"])
    sig5_triggered = payer_fanin_ratio > thresh and unique_payers >= 10
    sig5_severity = "High" if payer_fanin_ratio > 3.0 else "Medium"
    sig5_contrib = weight * min(1.0, (payer_fanin_ratio / 3.0)) if sig5_triggered else 0.0
    if sig5_triggered:
        who_dimension_triggered_count += 1
        
    # SIG 6: SIG_PAYER_REPEAT_DROP
    meta = SIGNALS_CATALOG["SIG_PAYER_REPEAT_DROP"]
    weight = weights.get(meta["id"], meta["weight"])
    thresh = thresholds.get(meta["id"], meta["threshold"])
    base_repeat = baseline.get("repeat_ratio", 0.50)
    sig6_triggered = (observed_repeat_ratio < thresh) and (base_repeat >= 0.15) and (unique_payers >= 15)
    sig6_severity = "Medium"
    sig6_contrib = weight * (1.0 - min(1.0, (observed_repeat_ratio / thresh))) if sig6_triggered else 0.0
    if sig6_triggered:
        who_dimension_triggered_count += 1
        
    # SIG 7: SIG_PAYER_CLUSTER_VELOCITY
    meta = SIGNALS_CATALOG["SIG_PAYER_CLUSTER_VELOCITY"]
    weight = weights.get(meta["id"], meta["weight"])
    thresh = thresholds.get(meta["id"], meta["threshold"])
    sig7_triggered = observed_cluster_ratio > thresh and tx_count >= 10
    sig7_severity = "High" if observed_cluster_ratio > 0.30 else "Medium"
    sig7_contrib = weight * min(1.0, (observed_cluster_ratio / 0.35)) if sig7_triggered else 0.0
    if sig7_triggered:
        who_dimension_triggered_count += 1
        
    # Apply correlation damper to WHO dimension:
    # If 2 or 3 correlated payer signals fire simultaneously, damp the secondary (2nd and 3rd) signals
    # to prevent runaway inflation while preserving the primary fan-in signal strength.
    who_damper = 1.0
    if who_dimension_triggered_count == 2:
        who_damper = 0.85
    elif who_dimension_triggered_count >= 3:
        who_damper = 0.75
        
    sig6_contrib = sig6_contrib * (who_damper if who_dimension_triggered_count > 1 else 1.0)
    sig7_contrib = sig7_contrib * (who_damper if who_dimension_triggered_count > 1 else 1.0)
    
    signal_results.append({
        "id": SIGNALS_CATALOG["SIG_PAYER_FANIN_VELOCITY"]["id"],
        "name": SIGNALS_CATALOG["SIG_PAYER_FANIN_VELOCITY"]["name"],
        "dimension": "WHO",
        "weight": weights.get("SIG_PAYER_FANIN_VELOCITY", 140.0),
        "threshold": thresholds.get("SIG_PAYER_FANIN_VELOCITY", 3.0),
        "observed_value": round(payer_fanin_ratio, 2),
        "observed_display": f"{round(payer_fanin_ratio, 1)}x baseline fan-in ({unique_payers} distinct payers)",
        "baseline_value": round(expected_payers_per_day, 1),
        "baseline_display": f"{round(expected_payers_per_day, 1)} expected payers/day",
        "triggered": sig5_triggered,
        "severity": sig5_severity,
        "contribution": round(sig5_contrib, 1),
        "confidence_label": SIGNALS_CATALOG["SIG_PAYER_FANIN_VELOCITY"]["confidence_label"],
        "analyst_explanation": SIGNALS_CATALOG["SIG_PAYER_FANIN_VELOCITY"]["analyst_explanation"] + (f" (Correlation damped: {int((1-who_damper)*100)}%)" if who_damper < 1.0 else ""),
        "false_positive_notes": SIGNALS_CATALOG["SIG_PAYER_FANIN_VELOCITY"]["false_positive_notes"],
        "reason_code": "RAPID_PAYER_FANIN" if sig5_triggered else None
    })
    raw_score += sig5_contrib
    
    signal_results.append({
        "id": SIGNALS_CATALOG["SIG_PAYER_REPEAT_DROP"]["id"],
        "name": SIGNALS_CATALOG["SIG_PAYER_REPEAT_DROP"]["name"],
        "dimension": "WHO",
        "weight": weights.get("SIG_PAYER_REPEAT_DROP", 90.0),
        "threshold": thresholds.get("SIG_PAYER_REPEAT_DROP", 0.15),
        "observed_value": round(observed_repeat_ratio, 4),
        "observed_display": f"{round(observed_repeat_ratio * 100, 1)}% repeat customers",
        "baseline_value": round(base_repeat, 4),
        "baseline_display": f"{round(base_repeat * 100, 1)}% historical repeat customers",
        "triggered": sig6_triggered,
        "severity": sig6_severity,
        "contribution": round(sig6_contrib, 1),
        "confidence_label": SIGNALS_CATALOG["SIG_PAYER_REPEAT_DROP"]["confidence_label"],
        "analyst_explanation": SIGNALS_CATALOG["SIG_PAYER_REPEAT_DROP"]["analyst_explanation"] + (f" (Correlation damped: {int((1-who_damper)*100)}%)" if who_damper < 1.0 else ""),
        "false_positive_notes": SIGNALS_CATALOG["SIG_PAYER_REPEAT_DROP"]["false_positive_notes"],
        "reason_code": "REPEAT_CUSTOMER_COLLAPSE" if sig6_triggered else None
    })
    raw_score += sig6_contrib
    
    signal_results.append({
        "id": SIGNALS_CATALOG["SIG_PAYER_CLUSTER_VELOCITY"]["id"],
        "name": SIGNALS_CATALOG["SIG_PAYER_CLUSTER_VELOCITY"]["name"],
        "dimension": "WHO",
        "weight": weights.get("SIG_PAYER_CLUSTER_VELOCITY", 110.0),
        "threshold": thresholds.get("SIG_PAYER_CLUSTER_VELOCITY", 0.30),
        "observed_value": round(observed_cluster_ratio, 4),
        "observed_display": f"{round(observed_cluster_ratio * 100, 1)}% synchronized burst deposits",
        "baseline_value": 0.05,
        "baseline_display": "< 5% retail normal",
        "triggered": sig7_triggered,
        "severity": sig7_severity,
        "contribution": round(sig7_contrib, 1),
        "confidence_label": SIGNALS_CATALOG["SIG_PAYER_CLUSTER_VELOCITY"]["confidence_label"],
        "analyst_explanation": SIGNALS_CATALOG["SIG_PAYER_CLUSTER_VELOCITY"]["analyst_explanation"] + (f" (Correlation damped: {int((1-who_damper)*100)}%)" if who_damper < 1.0 else ""),
        "false_positive_notes": SIGNALS_CATALOG["SIG_PAYER_CLUSTER_VELOCITY"]["false_positive_notes"],
        "reason_code": "CLUSTER_DEPOSIT_VELOCITY" if sig7_triggered else None
    })
    raw_score += sig7_contrib
    
    # SIG 8: SIG_FLOW_SETTLEMENT_VELOCITY
    meta = SIGNALS_CATALOG["SIG_FLOW_SETTLEMENT_VELOCITY"]
    weight = weights.get(meta["id"], meta["weight"])
    thresh = thresholds.get(meta["id"], meta["threshold"])
    sig8_triggered = observed_settlement_velocity > thresh and total_volume > 20000.0
    sig8_severity = "High" if observed_settlement_velocity > 0.90 else "Medium"
    sig8_contrib = weight * (observed_settlement_velocity / 1.0) if sig8_triggered else 0.0
    signal_results.append({
        "id": meta["id"],
        "name": meta["name"],
        "dimension": meta["dimension"],
        "weight": weight,
        "threshold": thresh,
        "observed_value": round(observed_settlement_velocity, 4),
        "observed_display": f"{round(observed_settlement_velocity * 100, 1)}% rapid provider payout ratio",
        "baseline_value": 0.30,
        "baseline_display": "Standard scheduled next-day batch settlement",
        "triggered": sig8_triggered,
        "severity": sig8_severity,
        "contribution": round(sig8_contrib, 1),
        "confidence_label": meta["confidence_label"],
        "analyst_explanation": meta["analyst_explanation"],
        "false_positive_notes": meta["false_positive_notes"],
        "reason_code": "INSTANT_OUTFLOW_VELOCITY" if sig8_triggered else None
    })
    raw_score += sig8_contrib
    
    # CAPACITY / PLAUSIBILITY
    # SIG 9: SIG_CAPACITY_PEER_DIVERGENCE
    meta = SIGNALS_CATALOG["SIG_CAPACITY_PEER_DIVERGENCE"]
    weight = weights.get(meta["id"], meta["weight"])
    thresh = thresholds.get(meta["id"], meta["threshold"])
    sig9_triggered = cohort_volume_ratio > thresh and total_volume > 30000.0
    sig9_severity = "High" if cohort_volume_ratio > 5.0 else "Medium"
    sig9_contrib = weight * min(1.0, (cohort_volume_ratio / 6.0)) if sig9_triggered else 0.0
    signal_results.append({
        "id": meta["id"],
        "name": meta["name"],
        "dimension": meta["dimension"],
        "weight": weight,
        "threshold": thresh,
        "observed_value": round(cohort_volume_ratio, 2),
        "observed_display": f"{round(cohort_volume_ratio, 1)}x cohort 95th percentile volume",
        "baseline_value": round(cohort_p95, 1),
        "baseline_display": f"₹{round(cohort_p95):,} cohort p95 daily volume",
        "triggered": sig9_triggered,
        "severity": sig9_severity,
        "contribution": round(sig9_contrib, 1),
        "confidence_label": meta["confidence_label"],
        "analyst_explanation": meta["analyst_explanation"],
        "false_positive_notes": meta["false_positive_notes"],
        "reason_code": "COHORT_CAPACITY_DIVERGENCE" if sig9_triggered else None
    })
    raw_score += sig9_contrib
    
    # SIG 10: SIG_CAPACITY_BASELINE_SURGE
    meta = SIGNALS_CATALOG["SIG_CAPACITY_BASELINE_SURGE"]
    weight = weights.get(meta["id"], meta["weight"])
    thresh = thresholds.get(meta["id"], meta["threshold"])
    sig10_triggered = baseline_volume_surge > thresh and total_volume > 25000.0 and has_sufficient_baseline
    sig10_severity = "Medium"
    sig10_contrib = weight * min(1.0, (baseline_volume_surge / 6.0)) if sig10_triggered else 0.0
    signal_results.append({
        "id": meta["id"],
        "name": meta["name"],
        "dimension": meta["dimension"],
        "weight": weight,
        "threshold": thresh,
        "observed_value": round(baseline_volume_surge, 2),
        "observed_display": f"{round(baseline_volume_surge, 1)}x baseline volume",
        "baseline_value": round(adjusted_baseline_volume, 1),
        "baseline_display": f"₹{round(adjusted_baseline_volume):,}/day baseline" + (f" (Holiday {effective_calendar_multiplier}x factored)" if effective_calendar_multiplier > 1.0 else ""),
        "triggered": sig10_triggered,
        "severity": sig10_severity,
        "contribution": round(sig10_contrib, 1),
        "confidence_label": meta["confidence_label"],
        "analyst_explanation": meta["analyst_explanation"],
        "false_positive_notes": meta["false_positive_notes"],
        "reason_code": "BASELINE_SURGE_UNEXPLAINED" if sig10_triggered else None
    })
    raw_score += sig10_contrib
    
    # Multi-dimensional convergence:
    # When signals trigger across 4 or more distinct behavioural dimensions simultaneously,
    # composite risk escalates reflecting systemic cross-vector anomaly.
    triggered_dimensions = set(s["dimension"] for s in signal_results if s["triggered"])
    multi_dim_synergy = 0.0
    if len(triggered_dimensions) >= 5:
        multi_dim_synergy = 55.0
    elif len(triggered_dimensions) >= 4:
        multi_dim_synergy = 30.0
    raw_score += multi_dim_synergy

    # Base background score (calibrated baseline risk, e.g. 80-120 pts for normal active business)
    bg_score = 80 if has_sufficient_baseline else 100
    total_computed_score = int(round(min(1000.0, bg_score + raw_score)))
    
    # Exact tier mapping
    tier = score_to_tier(total_computed_score)
    
    # Triggered signals filter
    triggered_signals = [s for s in signal_results if s["triggered"]]
    reason_codes = [s["reason_code"] for s in triggered_signals if s.get("reason_code")]
    
    # Synthesize reason summary
    if len(triggered_signals) == 0:
        reason_summary = "All monitored behaviour patterns (timing, amounts, payer network, settlements) align with established retail merchant baseline and peer cohort."
    else:
        sig_phrases = [s["name"] for s in triggered_signals[:3]]
        reason_summary = f"Elevated risk signals detected: {'; '.join(sig_phrases)}."
        if calendar_ctx.get("has_calendar_event"):
            reason_summary += f" [Calendar note: {calendar_ctx.get('context_note')} considered in baseline calculation]."
            
    # Update merchant table
    merchant.current_risk_score = total_computed_score
    merchant.current_risk_tier = tier
    merchant.last_scored_at = evaluation_time
    
    # Record snapshot if requested
    if record_snapshot:
        snapshot = RiskScoreSnapshot(
            merchant_id=merchant.id,
            timestamp=evaluation_time,
            score=total_computed_score,
            tier=tier,
            configuration_version=config_version,
            signal_contributions=json.dumps(signal_results),
            triggered_signals=json.dumps([s["id"] for s in triggered_signals]),
            reason_summary=reason_summary
        )
        db.add(snapshot)
        
        # Check if an alert should be created or updated (Tiers 2, 3, 4, 5)
        if tier >= 2:
            existing_open_alert = db.query(Alert).filter(
                Alert.merchant_id == merchant.id,
                Alert.status.in_(["New", "Assigned", "Under Review", "Merchant Information Requested", "Escalated"])
            ).first()
            
            severity_map = {2: "Medium", 3: "High", 4: "Critical", 5: "Critical"}
            recommended_steps = {
                2: "Issue Targeted Clarification Request (Form R-2)",
                3: "Conduct Enhanced Verification & Portfolio Manager Review",
                4: "Escalate to Senior Risk Committee for Simulated Containment Review",
                5: "Mandatory Senior Review & Compliance Counsel Determination"
            }
            
            if existing_open_alert:
                existing_open_alert.score = total_computed_score
                existing_open_alert.tier = tier
                existing_open_alert.severity = severity_map.get(tier, "Medium")
                existing_open_alert.triggered_signals = json.dumps([s["id"] for s in triggered_signals])
                existing_open_alert.latest_detected_at = evaluation_time
                existing_open_alert.recommended_next_step = recommended_steps.get(tier, "Review account")
            else:
                alert_id = f"ALT-{merchant.id}-{int(evaluation_time.timestamp())}"
                new_alert = Alert(
                    id=alert_id,
                    merchant_id=merchant.id,
                    score=total_computed_score,
                    tier=tier,
                    severity=severity_map.get(tier, "Medium"),
                    status="New",
                    triggered_signals=json.dumps([s["id"] for s in triggered_signals]),
                    recommended_next_step=recommended_steps.get(tier, "Review account"),
                    review_due_date=evaluation_time + datetime.timedelta(days=2),
                    first_detected_at=evaluation_time,
                    latest_detected_at=evaluation_time,
                    configuration_version=config_version
                )
                db.add(new_alert)
                
        db.commit()
        
    return {
        "merchant_id": merchant.id,
        "merchant_name": merchant.name,
        "evaluation_time": evaluation_time.isoformat(),
        "observation_window_hours": window_hours,
        "transaction_count": tx_count,
        "total_volume": round(total_volume, 2),
        "current_score": total_computed_score,
        "current_tier": tier,
        "tier_label": TIER_DEFINITIONS[tier]["label"],
        "recommended_action": TIER_DEFINITIONS[tier]["action"],
        "has_sufficient_baseline": has_sufficient_baseline,
        "calendar_context": calendar_ctx,
        "signals": signal_results,
        "triggered_count": len(triggered_signals),
        "reason_codes": reason_codes,
        "reason_summary": reason_summary,
        "configuration_version": config_version,
    }
