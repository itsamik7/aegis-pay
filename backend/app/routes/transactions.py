import csv
import io
import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, desc, asc
from ..database import get_db
from ..models import Transaction, Merchant, Alert, Case, User
from ..auth import get_current_user, get_optional_current_user

router = APIRouter(prefix="/transactions", tags=["Transaction Explorer"])

@router.get("")
def list_transactions(
    merchant_id: Optional[str] = None,
    search: Optional[str] = None,
    payer_token: Optional[str] = None,
    payment_method: Optional[str] = None,
    channel: Optional[str] = None,
    status: Optional[str] = None,
    is_flagged: Optional[bool] = None,
    min_amount: Optional[float] = None,
    max_amount: Optional[float] = None,
    sort_by: str = Query("time_desc"), # time_desc, time_asc, amount_desc, amount_asc
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    query = db.query(Transaction)
    
    # Public isolation: non-admins only see published transactions
    is_admin = current_user is not None and getattr(current_user, "role", "") == "Admin"
    if not is_admin:
        query = query.filter(Transaction.publication_status == "published")
    
    if merchant_id:
        query = query.filter(Transaction.merchant_id == merchant_id)
        
    if search:
        s = f"%{search}%"
        query = query.filter(or_(
            Transaction.id.ilike(s),
            Transaction.payer_token.ilike(s),
            Transaction.risk_reason.ilike(s)
        ))
        
    if payer_token:
        query = query.filter(Transaction.payer_token == payer_token)
        
    if payment_method:
        query = query.filter(Transaction.payment_method == payment_method)
        
    if channel:
        query = query.filter(Transaction.channel == channel)
        
    if status:
        query = query.filter(Transaction.status == status)
        
    if is_flagged is not None:
        query = query.filter(Transaction.is_flagged == is_flagged)
        
    if min_amount is not None:
        query = query.filter(Transaction.amount >= min_amount)
    if max_amount is not None:
        query = query.filter(Transaction.amount <= max_amount)
        
    if sort_by == "time_desc":
        query = query.order_by(desc(Transaction.timestamp))
    elif sort_by == "time_asc":
        query = query.order_by(asc(Transaction.timestamp))
    elif sort_by == "amount_desc":
        query = query.order_by(desc(Transaction.amount))
    elif sort_by == "amount_asc":
        query = query.order_by(asc(Transaction.amount))
    else:
        query = query.order_by(desc(Transaction.timestamp))
        
    total_count = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    
    # Enrich with merchant name
    results = []
    merchant_cache = {}
    for t in items:
        if t.merchant_id not in merchant_cache:
            m = db.query(Merchant).filter(Merchant.id == t.merchant_id).first()
            merchant_cache[t.merchant_id] = m.name if m else t.merchant_id
            
        results.append({
            "id": t.id,
            "merchant_id": t.merchant_id,
            "merchant_name": merchant_cache[t.merchant_id],
            "timestamp": t.timestamp.isoformat(),
            "amount": t.amount,
            "currency": t.currency,
            "status": t.status,
            "payment_method": t.payment_method,
            "payer_token": t.payer_token,
            "channel": t.channel,
            "is_flagged": t.is_flagged,
            "risk_reason": t.risk_reason,
            "settlement_ref": t.settlement_ref,
        })
        
    return {
        "items": results,
        "total": total_count,
        "page": page,
        "page_size": page_size,
        "total_pages": (total_count + page_size - 1) // page_size
    }

@router.get("/export")
def export_transactions_csv(
    merchant_id: Optional[str] = None,
    is_flagged: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    query = db.query(Transaction)
    if merchant_id:
        query = query.filter(Transaction.merchant_id == merchant_id)
    if is_flagged is not None:
        query = query.filter(Transaction.is_flagged == is_flagged)
        
    txs = query.order_by(desc(Transaction.timestamp)).limit(5000).all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Transaction ID", "Merchant ID", "Timestamp", "Amount", "Currency",
        "Status", "Method", "Channel", "Pseudonymous Payer Token", "Flagged", "Risk Reason"
    ])
    
    for t in txs:
        writer.writerow([
            t.id, t.merchant_id, t.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            t.amount, t.currency, t.status, t.payment_method, t.channel,
            t.payer_token, "Yes" if t.is_flagged else "No", t.risk_reason or ""
        ])
        
    csv_data = output.getvalue()
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=aegis_pay_transactions.csv"}
    )

@router.get("/{tx_id}")
def get_transaction_detail(
    tx_id: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    tx = db.query(Transaction).filter(Transaction.id == tx_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found.")
        
    is_admin = current_user is not None and getattr(current_user, "role", "") == "Admin"
    if not is_admin and tx.publication_status != "published":
        raise HTTPException(status_code=404, detail="Transaction not found.")
        
    merchant = db.query(Merchant).filter(Merchant.id == tx.merchant_id).first()
    
    # Active alerts or cases on this merchant
    alerts = db.query(Alert).filter(Alert.merchant_id == tx.merchant_id).all()
    cases = db.query(Case).filter(Case.merchant_id == tx.merchant_id).all()
    
    # Check why flagged
    explanation = tx.risk_reason
    if not explanation and tx.is_flagged:
        explanation = "Included in alert cluster due to anomalous time-of-day concentration or round staking denomination."
    elif not tx.is_flagged:
        explanation = "Transaction conforms to standard retail ticket parameters and daylight operating schedule."

    return {
        "transaction": {
            "id": tx.id,
            "merchant_id": tx.merchant_id,
            "merchant_name": merchant.name if merchant else tx.merchant_id,
            "timestamp": tx.timestamp.isoformat(),
            "amount": tx.amount,
            "currency": tx.currency,
            "status": tx.status,
            "payment_method": tx.payment_method,
            "payer_token": tx.payer_token,
            "channel": tx.channel,
            "settlement_ref": tx.settlement_ref,
            "is_flagged": tx.is_flagged,
            "risk_reason": tx.risk_reason,
        },
        "signal_attribution": {
            "explanation": explanation,
            "provenance": "Directly Observed by Simulated Payment Gateway",
            "linked_alert_ids": [a.id for a in alerts],
            "linked_case_ids": [c.id for c in cases],
        }
    }
