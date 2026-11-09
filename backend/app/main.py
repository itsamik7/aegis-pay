from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import or_
from .config import settings
from .database import engine, Base, get_db
from .models import Merchant, Alert, Case, Transaction
from .auth import get_current_user
from .seed import seed_database

# Routers
from .routes.auth import router as auth_router
from .routes.analytics import router as analytics_router
from .routes.merchants import router as merchants_router
from .routes.transactions import router as transactions_router
from .routes.alerts import router as alerts_router
from .routes.cases import router as cases_router
from .routes.merchant_requests import router as merchant_requests_router
from .routes.risk import router as risk_router
from .routes.simulation import router as simulation_router
from .routes.audit import router as audit_router
from .routes.reports import router as reports_router
from .routes.notifications import router as notifications_router

# Ensure tables are created
Base.metadata.create_all(bind=engine)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Automatically seed database if empty
    seed_database(force=False)
    yield

app = FastAPI(
    title="AEGIS-PAY API",
    description="Merchant Behaviour Monitoring & Transaction-Laundering Risk Platform. Independent Case Study Prototype — Synthetic Data Only.",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes with /api prefix
app.include_router(auth_router, prefix="/api")
app.include_router(analytics_router, prefix="/api")
app.include_router(merchants_router, prefix="/api")
app.include_router(transactions_router, prefix="/api")
app.include_router(alerts_router, prefix="/api")
app.include_router(cases_router, prefix="/api")
app.include_router(merchant_requests_router, prefix="/api")
app.include_router(risk_router, prefix="/api")
app.include_router(simulation_router, prefix="/api")
app.include_router(audit_router, prefix="/api")
app.include_router(reports_router, prefix="/api")
app.include_router(notifications_router, prefix="/api")

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "descriptor": settings.APP_DESCRIPTOR,
        "environment": settings.APP_ENV,
        "demo_mode": settings.DEMO_MODE,
        "synthetic_notice": "Independent Case Study Prototype — Synthetic Data Only"
    }

@app.get("/api/search")
def global_search(
    q: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Global search returning real matching merchants, alerts, cases, and transactions.
    """
    search_str = f"%{q}%"
    
    # Merchants
    merchants = db.query(Merchant).filter(
        or_(
            Merchant.name.ilike(search_str),
            Merchant.id.ilike(search_str),
            Merchant.city.ilike(search_str),
            Merchant.business_category.ilike(search_str)
        )
    ).limit(5).all()
    
    # Alerts
    alerts = db.query(Alert).filter(
        or_(
            Alert.id.ilike(search_str),
            Alert.merchant_id.ilike(search_str),
            Alert.recommended_next_step.ilike(search_str)
        )
    ).limit(5).all()
    
    # Cases
    cases = db.query(Case).filter(
        or_(
            Case.id.ilike(search_str),
            Case.title.ilike(search_str),
            Case.merchant_id.ilike(search_str)
        )
    ).limit(5).all()
    
    # Transactions
    transactions = db.query(Transaction).filter(
        or_(
            Transaction.id.ilike(search_str),
            Transaction.payer_token.ilike(search_str),
            Transaction.merchant_id.ilike(search_str)
        )
    ).limit(5).all()
    
    return {
        "query": q,
        "merchants": [{
            "id": m.id,
            "name": m.name,
            "category": m.business_category,
            "city": m.city,
            "tier": m.current_risk_tier,
            "score": m.current_risk_score,
            "link": f"/merchants/{m.id}"
        } for m in merchants],
        "alerts": [{
            "id": a.id,
            "merchant_id": a.merchant_id,
            "score": a.score,
            "tier": a.tier,
            "status": a.status,
            "link": f"/alerts/{a.id}"
        } for a in alerts],
        "cases": [{
            "id": c.id,
            "title": c.title,
            "merchant_id": c.merchant_id,
            "status": c.status,
            "link": f"/cases/{c.id}"
        } for c in cases],
        "transactions": [{
            "id": t.id,
            "merchant_id": t.merchant_id,
            "amount": t.amount,
            "payer_token": t.payer_token,
            "timestamp": t.timestamp.isoformat(),
            "link": f"/transactions?search={t.id}"
        } for t in transactions]
    }
