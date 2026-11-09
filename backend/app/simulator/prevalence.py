"""
AEGIS-PAY Rare-Event Prevalence Calculator (Bayesian Sensitivity Analysis)
Demonstrates how Base-Rate Fallacy affects fraud & transaction laundering detection.
All inputs and outputs are explicit user assumptions.
"""

from typing import Dict, Any

def calculate_rare_event_impact(
    total_merchants: int = 100_000,
    prevalence_rate: float = 0.002, # 0.2% of merchants are bad actors
    sensitivity: float = 0.85,      # 85% detection rate
    false_positive_rate: float = 0.02 # 2% false alarm rate on good merchants
) -> Dict[str, Any]:
    """
    Computes expected alert counts and Positive Predictive Value (PPV)
    under realistic sparse-crime conditions.
    """
    actual_suspicious = int(round(total_merchants * prevalence_rate))
    actual_legitimate = total_merchants - actual_suspicious
    
    true_positives = int(round(actual_suspicious * sensitivity))
    false_negatives = actual_suspicious - true_positives
    
    false_positives = int(round(actual_legitimate * false_positive_rate))
    true_negatives = actual_legitimate - false_positives
    
    total_flagged = true_positives + false_positives
    
    # Positive Predictive Value (Precision)
    ppv = (true_positives / total_flagged) if total_flagged > 0 else 0.0
    false_discovery_rate = (false_positives / total_flagged) if total_flagged > 0 else 0.0
    
    # Workload burden on analysts
    analyst_investigations_per_true_catch = (total_flagged / true_positives) if true_positives > 0 else 0.0
    
    return {
        "inputs": {
            "total_merchants": total_merchants,
            "prevalence_rate": prevalence_rate,
            "prevalence_percent": round(prevalence_rate * 100, 3),
            "sensitivity": sensitivity,
            "sensitivity_percent": round(sensitivity * 100, 1),
            "false_positive_rate": false_positive_rate,
            "false_positive_rate_percent": round(false_positive_rate * 100, 2),
        },
        "outcomes": {
            "actual_suspicious_merchants": actual_suspicious,
            "actual_legitimate_merchants": actual_legitimate,
            "true_positives": true_positives,
            "false_positives": false_positives,
            "false_negatives": false_negatives,
            "true_negatives": true_negatives,
            "total_flagged_for_review": total_flagged,
            "precision_ppv": round(ppv, 4),
            "precision_ppv_percent": round(ppv * 100, 2),
            "false_discovery_rate": round(false_discovery_rate, 4),
            "false_discovery_rate_percent": round(false_discovery_rate * 100, 2),
            "analyst_reviews_per_catch": round(analyst_investigations_per_true_catch, 1),
        },
        "analyst_takeaway": (
            f"Even with 85% sensitivity and a low 2% FPR, out of {total_flagged:,} alerts generated across "
            f"{total_merchants:,} merchants, {false_positives:,} ({round(false_discovery_rate*100, 1)}%) will be legitimate businesses. "
            f"This mathematically proves why AEGIS-PAY emphasizes graduated targeted queries and human review rather than automatic de-platforming."
        )
    }
