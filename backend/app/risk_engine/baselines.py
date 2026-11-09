import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
from ..models import Merchant, Transaction, MerchantCohort, CalendarEvent

def get_merchant_baseline(merchant: Merchant, db: Session, end_time: Optional[datetime.datetime] = None) -> Dict[str, Any]:
    """
    Computes rolling 30-day baseline for the merchant before the observation window.
    """
    if end_time is None:
        end_time = datetime.datetime.now(datetime.timezone.utc)
    
    baseline_start = end_time - datetime.timedelta(days=30)
    
    txs = db.query(Transaction).filter(
        Transaction.merchant_id == merchant.id,
        Transaction.timestamp >= baseline_start,
        Transaction.timestamp < end_time,
        Transaction.status == "Success"
    ).all()
    
    if len(txs) < 10:
        return {
            "has_sufficient_baseline": False,
            "sample_size": len(txs),
            "reason": "Insufficient baseline data: Fewer than 10 transactions in rolling 30-day window. System treats merchant with cold-start damping.",
            "avg_ticket": merchant.declared_avg_ticket or 180.0,
            "std_ticket": 40.0,
            "avg_daily_volume": (merchant.declared_monthly_volume or 150000.0) / 30.0,
            "night_ratio": 0.02,
            "offhours_ratio": 0.05,
            "round_ratio": 0.15,
            "repeat_ratio": 0.50,
        }
    
    amounts = [t.amount for t in txs]
    total_volume = sum(amounts)
    avg_ticket = total_volume / len(amounts)
    variance = sum((a - avg_ticket) ** 2 for a in amounts) / len(amounts)
    std_ticket = max(10.0, variance ** 0.5)
    
    # Days spanned
    days_span = max(1.0, (max(t.timestamp for t in txs) - min(t.timestamp for t in txs)).total_seconds() / 86400.0)
    avg_daily_volume = total_volume / days_span
    
    # Operating hours: parse declared hours e.g. "08:00 - 22:00"
    start_hour, end_hour = 8, 22
    if merchant.declared_operating_hours and "-" in merchant.declared_operating_hours:
        try:
            parts = merchant.declared_operating_hours.split("-")
            start_hour = int(parts[0].strip().split(":")[0])
            end_hour = int(parts[1].strip().split(":")[0])
        except Exception:
            start_hour, end_hour = 8, 22
            
    offhours_count = sum(1 for t in txs if (t.timestamp.hour < start_hour or t.timestamp.hour >= end_hour))
    offhours_ratio = offhours_count / len(txs)
    
    # Night hours: 23:00 to 05:00
    night_count = sum(1 for t in txs if (t.timestamp.hour >= 23 or t.timestamp.hour < 5))
    night_ratio = night_count / len(txs)
    
    # Round amounts
    round_count = sum(1 for a in amounts if a >= 100 and (a % 100 == 0 or a % 500 == 0 or a % 1000 == 0))
    round_ratio = round_count / len(txs)
    
    # Repeat customer share (share of transactions from repeat customers)
    payer_counts: Dict[str, int] = {}
    for t in txs:
        payer_counts[t.payer_token] = payer_counts.get(t.payer_token, 0) + 1
    repeat_tx_count = sum(c for p, c in payer_counts.items() if c > 1)
    repeat_ratio = repeat_tx_count / max(1, len(txs))
    
    return {
        "has_sufficient_baseline": True,
        "sample_size": len(txs),
        "days_span": round(days_span, 1),
        "avg_ticket": round(avg_ticket, 2),
        "std_ticket": round(std_ticket, 2),
        "avg_daily_volume": round(avg_daily_volume, 2),
        "night_ratio": round(night_ratio, 4),
        "offhours_ratio": round(offhours_ratio, 4),
        "round_ratio": round(round_ratio, 4),
        "repeat_ratio": round(repeat_ratio, 4),
    }

def get_cohort_baseline(merchant: Merchant, db: Session) -> Dict[str, Any]:
    if merchant.cohort_id:
        cohort = db.query(MerchantCohort).filter(MerchantCohort.id == merchant.cohort_id).first()
        if cohort:
            return {
                "cohort_id": cohort.id,
                "cohort_name": cohort.name,
                "category": cohort.category,
                "region": cohort.region,
                "avg_ticket": cohort.avg_ticket,
                "std_ticket": cohort.std_ticket,
                "avg_daily_tx_count": cohort.avg_daily_tx_count,
                "avg_night_ratio": cohort.avg_night_ratio,
                "p95_daily_volume": cohort.p95_daily_volume,
            }
            
    # Default bakery cohort
    return {
        "cohort_id": "DEFAULT_COHORT",
        "cohort_name": f"{merchant.business_category} - {merchant.city} Benchmark",
        "category": merchant.business_category,
        "region": merchant.region,
        "avg_ticket": 180.0,
        "std_ticket": 50.0,
        "avg_daily_tx_count": 65.0,
        "avg_night_ratio": 0.03,
        "p95_daily_volume": 25000.0,
    }

def get_active_calendar_context(window_start: datetime.datetime, window_end: datetime.datetime, merchant_category: str, db: Session) -> Dict[str, Any]:
    """
    Checks if window coincides with active calendar events (festivals, holiday rushes).
    """
    events = db.query(CalendarEvent).filter(
        CalendarEvent.start_date <= window_end,
        CalendarEvent.end_date >= window_start
    ).all()
    
    active_multiplier = 1.0
    matched_events = []
    
    for event in events:
        matched_events.append({
            "name": event.name,
            "type": event.event_type,
            "multiplier": event.expected_volume_multiplier,
            "notes": event.notes
        })
        if event.expected_volume_multiplier > active_multiplier:
            active_multiplier = event.expected_volume_multiplier
            
    return {
        "has_calendar_event": len(matched_events) > 0,
        "events": matched_events,
        "effective_multiplier": active_multiplier,
        "context_note": f"Seasonality adjustment active: {', '.join(e['name'] for e in matched_events)}" if matched_events else "Normal business calendar period"
    }
