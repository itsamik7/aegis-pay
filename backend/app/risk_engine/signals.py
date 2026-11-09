"""
AEGIS-PAY Behavioural Signal Definitions
Categorized across 5 Behavioural Dimensions:
- WHEN (Timing Alignment)
- HOW MUCH (Amount Behaviour)
- WHO (Payer Behaviour)
- HOW FAST (Flow & Settlement Behaviour)
- CAPACITY / PLAUSIBILITY (Cohort & Declared Business Plausibility)

All thresholds and weights are illustrative demo defaults requiring calibration on real, authorised data.
"""

from typing import Dict, Any, List, Optional
import math

SIGNALS_CATALOG = {
    "SIG_TIMING_OFFHOURS": {
        "id": "SIG_TIMING_OFFHOURS",
        "name": "Transactions Outside Declared Operating Hours",
        "dimension": "WHEN",
        "weight": 80.0,
        "threshold": 0.20, # > 20% of tx volume outside declared hours
        "severity": "Medium",
        "confidence_label": "Directly Observed",
        "formula_description": "Ratio of transaction count occurring outside merchant's declared operating hours: count(tx_outside_hours) / total_tx",
        "analyst_explanation": "A high proportion of customer payments are being collected during hours when the physical business is closed (e.g., between 23:00 and 06:00).",
        "false_positive_notes": "Late-night catering preparation, midnight cake delivery services, or 24/7 cloud kitchens can exhibit legitimate off-hours volume.",
        "is_core": True,
    },
    "SIG_TIMING_NIGHT_SPIKE": {
        "id": "SIG_TIMING_NIGHT_SPIKE",
        "name": "Unusual Night-Time Volume Concentration",
        "dimension": "WHEN",
        "weight": 110.0,
        "threshold": 0.35, # > 35% night tx vs baseline of < 5%
        "severity": "High",
        "confidence_label": "Derived",
        "formula_description": "(night_tx_volume / total_tx_volume) normalized against peer cohort night ratio and merchant rolling baseline",
        "analyst_explanation": "Abnormal volume spike during late-night hours (23:00 - 04:00) that deviates by more than 4x from both the merchant's 30-day baseline and peer bakeries.",
        "false_positive_notes": "Major holiday eves, New Year celebrations, or overnight baking prep sales.",
        "is_core": True,
    },
    "SIG_AMOUNT_ROUND_RATIO": {
        "id": "SIG_AMOUNT_ROUND_RATIO",
        "name": "Elevated Round-Amount Transaction Ratio",
        "dimension": "HOW MUCH",
        "weight": 90.0,
        "threshold": 0.40, # > 40% round amounts
        "severity": "Medium",
        "confidence_label": "Directly Observed",
        "formula_description": "count(amount in [500, 1000, 2000, 3000, 5000, 10000, ...]) / count(all_tx)",
        "analyst_explanation": "A disproportionate share of incoming payments are exact round sums (e.g. Rs 500, Rs 1000, Rs 2000) rather than fractional retail tickets typical of bakery items (e.g. Rs 147, Rs 285).",
        "false_positive_notes": "Fixed-price combo menus, holiday gift hampers, or gift vouchers sold in round denominations.",
        "is_core": True,
    },
    "SIG_AMOUNT_TICKET_DEVIATION": {
        "id": "SIG_AMOUNT_TICKET_DEVIATION",
        "name": "Abnormal Ticket Size Shift (Z-Score)",
        "dimension": "HOW MUCH",
        "weight": 80.0,
        "threshold": 2.5, # Z-score > 2.5
        "severity": "Medium",
        "confidence_label": "Derived",
        "formula_description": "(current_window_avg_ticket - baseline_avg_ticket) / baseline_std_ticket",
        "analyst_explanation": "Average transaction value has shifted drastically from the historical baseline without an annotated holiday catering order.",
        "false_positive_notes": "Bulk corporate gifting, wedding cake orders, or inflation-driven menu repricing.",
        "is_core": True,
    },
    "SIG_PAYER_FANIN_VELOCITY": {
        "id": "SIG_PAYER_FANIN_VELOCITY",
        "name": "Rapid Unique Payer Fan-in Velocity",
        "dimension": "WHO",
        "weight": 140.0,
        "threshold": 2.0, # 2x increase in distinct payers per day
        "severity": "High",
        "confidence_label": "Directly Observed (Pseudonymous Token)",
        "formula_description": "distinct_payers_in_window / expected_baseline_distinct_payers",
        "analyst_explanation": "Hundreds of distinct, first-time pseudonymous payer tokens are depositing money into this merchant account in rapid succession within short time windows.",
        "false_positive_notes": "Viral social media promotion, food influencer review, or sudden footfall during local community events.",
        "is_core": True,
    },
    "SIG_PAYER_REPEAT_DROP": {
        "id": "SIG_PAYER_REPEAT_DROP",
        "name": "Severe Repeat Customer Ratio Collapse",
        "dimension": "WHO",
        "weight": 90.0,
        "threshold": 0.20, # repeat ratio drops below 20% when baseline was > 40%
        "severity": "Medium",
        "confidence_label": "Derived",
        "formula_description": "repeat_payer_count / total_unique_payers in observation window vs baseline repeat ratio",
        "analyst_explanation": "The merchant's customer base suddenly transitioned from a steady local neighbourhood clientele into predominantly single-visit external payers.",
        "false_positive_notes": "Transit hubs (airport or railway station branches), pop-up stalls, or tourist destination seasonal shops.",
        "is_core": True,
    },
    "SIG_PAYER_CLUSTER_VELOCITY": {
        "id": "SIG_PAYER_CLUSTER_VELOCITY",
        "name": "Coordinated Payer Clustered Deposits",
        "dimension": "WHO",
        "weight": 110.0,
        "threshold": 0.15, # > 15% of tx belong to tight bursts
        "severity": "High",
        "confidence_label": "Derived",
        "formula_description": "Ratio of transactions occurring in tight time bursts (< 60s apart) with identical denomination amounts",
        "analyst_explanation": "Multiple distinct payers are submitting identical amounts in tightly spaced synchronized intervals, characteristic of betting round cut-offs.",
        "false_positive_notes": "Lunch-hour cafeteria queues or checkout rushes where customers order identical combo items.",
        "is_core": True,
    },
    "SIG_FLOW_SETTLEMENT_VELOCITY": {
        "id": "SIG_FLOW_SETTLEMENT_VELOCITY",
        "name": "Accelerated Provider-Visible Settlement / Payout Requests",
        "dimension": "HOW FAST",
        "weight": 120.0,
        "threshold": 0.85, # > 85% volume requested for rapid payout within < 2 hours of collection
        "severity": "High",
        "confidence_label": "Derived (Provider-Visible Only)",
        "formula_description": "provider_visible_rapid_payout_volume / total_inflow_volume (within same business cycle)",
        "analyst_explanation": "Merchant exhibits immediate withdrawal or on-demand payout requests following incoming collection bursts, leaving negligible settlement balance.",
        "false_positive_notes": "Merchants with automated same-day settlement configurations to pay daily raw material suppliers (flour, dairy).",
        "is_core": True,
    },
    "SIG_CAPACITY_PEER_DIVERGENCE": {
        "id": "SIG_CAPACITY_PEER_DIVERGENCE",
        "name": "Volume Exceeds Category Peer Cohort 95th Percentile",
        "dimension": "CAPACITY / PLAUSIBILITY",
        "weight": 100.0,
        "threshold": 3.0, # > 3x the 95th percentile volume of same cohort
        "severity": "High",
        "confidence_label": "Derived",
        "formula_description": "merchant_daily_volume / cohort_p95_daily_volume",
        "analyst_explanation": "The transaction volume collected by this single retail outlet significantly exceeds the capacity of similar bakeries in the same geographical region.",
        "false_positive_notes": "Flagship store expanding into B2B distribution or supply contracts.",
        "is_core": True,
    },
    "SIG_CAPACITY_BASELINE_SURGE": {
        "id": "SIG_CAPACITY_BASELINE_SURGE",
        "name": "Unexplained Volume Surge Relative to Own Baseline",
        "dimension": "CAPACITY / PLAUSIBILITY",
        "weight": 70.0,
        "threshold": 3.5, # > 3.5x baseline volume without calendar holiday
        "severity": "Medium",
        "confidence_label": "Derived",
        "formula_description": "current_volume / (baseline_daily_volume * active_calendar_multiplier)",
        "analyst_explanation": "Sudden multi-fold volume increase without an associated holiday or documented business expansion.",
        "false_positive_notes": "Successful promotional campaign or opening of an adjacent commercial development.",
        "is_core": True,
    },
}
