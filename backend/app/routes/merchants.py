import csv
import io
import json
import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, desc, asc
from ..database import get_db
from ..models import (
    Merchant, MerchantProfile, MerchantCohort, Transaction, 
    Alert, Case, CaseNote, MerchantInformationRequest, MerchantResponse,
    EvidenceItem, AuditEvent, RiskScoreSnapshot, SettlementEvent
)
from ..auth import get_current_user
from ..risk_engine.scorer import evaluate_merchant_risk, TIER_DEFINITIONS
from ..risk_engine.baselines import get_merchant_baseline, get_cohort_baseline, get_active_calendar_context

router = APIRouter(prefix="/merchants", tags=["Merchant Monitoring"])

@router.get("")
def list_merchants(
    search: Optional[str] = None,
    tier: Optional[int] = None,
    category: Optional[str] = None,
    region: Optional[str] = None,
    status: Optional[str] = None,
    analyst_id: Optional[int] = None,
    sort_by: str = Query("score_desc"), # score_desc, score_asc, name_asc, volume_desc, date_desc
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    query = db.query(Merchant)
    
    if search:
        s = f"%{search}%"
        query = query.filter(or_(Merchant.name.ilike(s), Merchant.id.ilike(s), Merchant.legal_name.ilike(s), Merchant.city.ilike(s)))
        
    if tier is not None:
        query = query.filter(Merchant.current_risk_tier == tier)
        
    if category:
        query = query.filter(Merchant.business_category == category)
        
    if region:
        query = query.filter(Merchant.region.ilike(f"%{region}%"))
        
    if status:
        query = query.filter(Merchant.account_status == status)
        
    if analyst_id is not None:
        query = query.filter(Merchant.assigned_analyst_id == analyst_id)
        
    # Sorting
    if sort_by == "score_desc":
        query = query.order_by(desc(Merchant.current_risk_score))
    elif sort_by == "score_asc":
        query = query.order_by(asc(Merchant.current_risk_score))
    elif sort_by == "name_asc":
        query = query.order_by(asc(Merchant.name))
    elif sort_by == "date_desc":
        query = query.order_by(desc(Merchant.onboarding_date))
    else:
        query = query.order_by(desc(Merchant.current_risk_score))
        
    total_count = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    
    results = []
    for m in items:
        # tx stats
        stats = db.query(
            func.count(Transaction.id),
            func.coalesce(func.sum(Transaction.amount), 0.0),
            func.max(Transaction.timestamp)
        ).filter(Transaction.merchant_id == m.id, Transaction.status == "Success").first()
        
        tx_count = stats[0] or 0
        tx_volume = stats[1] or 0.0
        last_tx_time = stats[2]
        
        open_alerts_count = db.query(Alert).filter(
            Alert.merchant_id == m.id,
            Alert.status.in_(["New", "Assigned", "Under Review", "Merchant Information Requested", "Escalated"])
        ).count()
        
        results.append({
            "id": m.id,
            "name": m.name,
            "legal_name": m.legal_name,
            "business_category": m.business_category,
            "subcategory": m.subcategory,
            "city": m.city,
            "region": m.region,
            "onboarding_date": m.onboarding_date.isoformat(),
            "account_status": m.account_status,
            "current_risk_score": m.current_risk_score,
            "current_risk_tier": m.current_risk_tier,
            "tier_label": TIER_DEFINITIONS[m.current_risk_tier]["label"],
            "tier_action": TIER_DEFINITIONS[m.current_risk_tier]["action"],
            "tier_color": TIER_DEFINITIONS[m.current_risk_tier]["color"],
            "transaction_count": tx_count,
            "transaction_volume": round(float(tx_volume), 2),
            "last_activity": last_tx_time.isoformat() if last_tx_time else None,
            "open_alerts_count": open_alerts_count,
            "assigned_analyst_name": m.assigned_analyst_name or "Unassigned",
        })
        
    return {
        "items": results,
        "total": total_count,
        "page": page,
        "page_size": page_size,
        "total_pages": (total_count + page_size - 1) // page_size
    }

@router.get("/export")
def export_merchants_csv(
    search: Optional[str] = None,
    tier: Optional[int] = None,
    category: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    query = db.query(Merchant)
    if search:
        s = f"%{search}%"
        query = query.filter(or_(Merchant.name.ilike(s), Merchant.id.ilike(s)))
    if tier is not None:
        query = query.filter(Merchant.current_risk_tier == tier)
    if category:
        query = query.filter(Merchant.business_category == category)
        
    merchants = query.order_by(desc(Merchant.current_risk_score)).all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Merchant ID", "Name", "Legal Name", "Category", "City", "Region", 
        "Account Status", "Risk Score (0-1000)", "Risk Tier (0-5)", "Tier Label",
        "Declared Monthly Vol", "Assigned Analyst", "Onboarding Date"
    ])
    
    for m in merchants:
        writer.writerow([
            m.id, m.name, m.legal_name, m.business_category, m.city, m.region,
            m.account_status, m.current_risk_score, m.current_risk_tier,
            TIER_DEFINITIONS[m.current_risk_tier]["label"],
            m.declared_monthly_volume, m.assigned_analyst_name or "Unassigned",
            m.onboarding_date.strftime("%Y-%m-%d")
        ])
        
    csv_data = output.getvalue()
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=aegis_pay_merchants.csv"}
    )

@router.get("/{merchant_id}")
def get_merchant_profile_full(
    merchant_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    merchant = db.query(Merchant).filter(Merchant.id == merchant_id).first()
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found.")
        
    # Evaluate current risk live for full signal explainability
    eval_data = evaluate_merchant_risk(merchant, db, window_hours=48, record_snapshot=False)
    
    # Baseline
    baseline = get_merchant_baseline(merchant, db)
    cohort = get_cohort_baseline(merchant, db)
    now = datetime.datetime.now(datetime.timezone.utc)
    calendar_ctx = get_active_calendar_context(now - datetime.timedelta(days=7), now, merchant.business_category, db)
    
    # Transactions overview
    txs = db.query(Transaction).filter(
        Transaction.merchant_id == merchant.id
    ).order_by(desc(Transaction.timestamp)).limit(100).all()
    
    # Hour of day distribution
    hours_dist = {h: 0 for h in range(24)}
    day_dist = {d: 0 for d in ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]}
    amount_buckets = {"< 200": 0, "200-500": 0, "500-1000": 0, "1000-2000": 0, "> 2000": 0}
    
    payer_token_counts = {}
    for t in txs:
        hours_dist[t.timestamp.hour] += 1
        day_name = t.timestamp.strftime("%a")
        if day_name in day_dist:
            day_dist[day_name] += 1
            
        amt = t.amount
        if amt < 200:
            amount_buckets["< 200"] += 1
        elif amt <= 500:
            amount_buckets["200-500"] += 1
        elif amt <= 1000:
            amount_buckets["500-1000"] += 1
        elif amt <= 2000:
            amount_buckets["1000-2000"] += 1
        else:
            amount_buckets["> 2000"] += 1
            
        payer_token_counts[t.payer_token] = payer_token_counts.get(t.payer_token, 0) + 1
        
    hour_chart_data = [{"hour": f"{h:02d}:00", "count": count} for h, count in hours_dist.items()]
    day_chart_data = [{"day": d, "count": count} for d, count in day_dist.items()]
    amount_bucket_data = [{"bucket": b, "count": count} for b, count in amount_buckets.items()]
    
    # Settlement events
    settlements = db.query(SettlementEvent).filter(
        SettlementEvent.merchant_id == merchant.id
    ).order_by(desc(SettlementEvent.timestamp)).limit(10).all()
    settle_list = [{
        "id": s.id,
        "amount": s.amount,
        "timestamp": s.timestamp.isoformat(),
        "payout_delay_hours": s.payout_delay_hours,
        "payout_ratio": s.provider_visible_payout_ratio,
        "status": s.status,
        "notes": s.notes
    } for s in settlements]
    
    # Alerts
    alerts = db.query(Alert).filter(
        Alert.merchant_id == merchant.id
    ).order_by(desc(Alert.latest_detected_at)).all()
    alerts_list = [{
        "id": a.id,
        "score": a.score,
        "tier": a.tier,
        "severity": a.severity,
        "status": a.status,
        "recommended_next_step": a.recommended_next_step,
        "first_detected_at": a.first_detected_at.isoformat(),
        "latest_detected_at": a.latest_detected_at.isoformat(),
        "cleared_reason": a.cleared_reason
    } for a in alerts]
    
    # Cases
    cases = db.query(Case).filter(
        Case.merchant_id == merchant.id
    ).order_by(desc(Case.updated_at)).all()
    cases_list = [{
        "id": c.id,
        "title": c.title,
        "status": c.status,
        "priority": c.priority,
        "assigned_to": c.assigned_to_name,
        "current_recommendation": c.current_recommendation,
        "recommendation_rationale": c.recommendation_rationale,
        "reviewer_decision": c.reviewer_decision,
        "updated_at": c.updated_at.isoformat()
    } for c in cases]
    
    # Merchant Information Requests
    requests = db.query(MerchantInformationRequest).filter(
        MerchantInformationRequest.merchant_id == merchant.id
    ).order_by(desc(MerchantInformationRequest.created_at)).all()
    req_list = []
    for r in requests:
        resps = db.query(MerchantResponse).filter(MerchantResponse.request_id == r.id).all()
        req_list.append({
            "id": r.id,
            "case_id": r.case_id,
            "request_type": r.request_type,
            "subject": r.subject,
            "message": r.message,
            "due_date": r.due_date.isoformat(),
            "status": r.status,
            "created_by": r.created_by_name,
            "created_at": r.created_at.isoformat(),
            "responses": [{
                "id": resp.id,
                "response_text": resp.response_text,
                "attachments": json.loads(resp.attachment_filenames) if resp.attachment_filenames else [],
                "submitted_at": resp.submitted_at.isoformat(),
                "reviewer_verified": resp.reviewer_verified
            } for resp in resps]
        })

    # Evidence Items
    evidence_items = db.query(EvidenceItem).filter(
        EvidenceItem.merchant_id == merchant.id
    ).order_by(desc(EvidenceItem.created_at)).all()
    evidence_list = [{
        "id": e.id,
        "title": e.title,
        "evidence_type": e.evidence_type,
        "description": e.description,
        "provenance_type": e.provenance_type,
        "raw_data": json.loads(e.raw_data_json) if e.raw_data_json else None,
        "created_at": e.created_at.isoformat()
    } for e in evidence_items]

    # Audit Events for this merchant
    audits = db.query(AuditEvent).filter(
        AuditEvent.entity_id == merchant.id
    ).order_by(desc(AuditEvent.timestamp)).limit(15).all()
    audit_list = [{
        "id": a.id,
        "actor_name": a.actor_name,
        "actor_role": a.actor_role,
        "action": a.action,
        "rationale": a.rationale,
        "timestamp": a.timestamp.isoformat()
    } for a in audits]

    # Score History snapshots
    snapshots = db.query(RiskScoreSnapshot).filter(
        RiskScoreSnapshot.merchant_id == merchant.id
    ).order_by(desc(RiskScoreSnapshot.timestamp)).limit(10).all()
    snapshot_list = [{
        "timestamp": s.timestamp.isoformat(),
        "score": s.score,
        "tier": s.tier,
        "reason_summary": s.reason_summary
    } for s in snapshots]

    return {
        "merchant": {
            "id": merchant.id,
            "name": merchant.name,
            "legal_name": merchant.legal_name,
            "business_category": merchant.business_category,
            "subcategory": merchant.subcategory,
            "city": merchant.city,
            "region": merchant.region,
            "onboarding_date": merchant.onboarding_date.isoformat(),
            "account_status": merchant.account_status,
            "current_risk_score": merchant.current_risk_score,
            "current_risk_tier": merchant.current_risk_tier,
            "tier_label": TIER_DEFINITIONS[merchant.current_risk_tier]["label"],
            "tier_action": TIER_DEFINITIONS[merchant.current_risk_tier]["action"],
            "tier_color": TIER_DEFINITIONS[merchant.current_risk_tier]["color"],
            "declared_monthly_volume": merchant.declared_monthly_volume,
            "declared_avg_ticket": merchant.declared_avg_ticket,
            "declared_operating_hours": merchant.declared_operating_hours,
            "assigned_analyst_name": merchant.assigned_analyst_name or "Unassigned",
        },
        "profile": {
            "pan_masked": merchant.profile.pan_masked if merchant.profile else "ABCDE****F",
            "gst_number_masked": merchant.profile.gst_number_masked if merchant.profile else "27ABCDE****1Z5",
            "registered_address": merchant.profile.registered_address if merchant.profile else "Not recorded",
            "physical_storefront": merchant.profile.physical_storefront if merchant.profile else True,
            "website_url": merchant.profile.website_url if merchant.profile else None,
            "mcc_code": merchant.profile.mcc_code if merchant.profile else "5462",
            "settlement_bank_name": merchant.profile.settlement_bank_name if merchant.profile else "HDFC Bank Ltd",
            "settlement_account_masked": merchant.profile.settlement_account_masked if merchant.profile else "50100******4821",
            "corroboration_status": merchant.profile.corroboration_status if merchant.profile else "Verified",
            "notes": merchant.profile.notes if merchant.profile else "",
        },
        "live_risk_evaluation": eval_data,
        "baseline": baseline,
        "cohort": cohort,
        "calendar_context": calendar_ctx,
        "behaviour_charts": {
            "hour_of_day": hour_chart_data,
            "day_of_week": day_chart_data,
            "amount_buckets": amount_bucket_data,
        },
        "settlement_events": settle_list,
        "alerts": alerts_list,
        "cases": cases_list,
        "requests": req_list,
        "evidence": evidence_list,
        "audit_trail": audit_list,
        "score_history": snapshot_list,
        "recent_transactions": [{
            "id": t.id,
            "timestamp": t.timestamp.isoformat(),
            "amount": t.amount,
            "status": t.status,
            "payment_method": t.payment_method,
            "payer_token": t.payer_token,
            "channel": t.channel,
            "is_flagged": t.is_flagged,
            "risk_reason": t.risk_reason
        } for t in txs[:25]]
    }
