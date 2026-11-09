"""
AEGIS-PAY Comprehensive Synthetic Database Seed Script
Creates users, cohorts, calendar events, merchants, transactions, alerts, cases,
investigation evidence, merchant clarification requests/responses, and audit logs.
Synthetic demo data only - no real customer or merchant payment credentials.
"""

import datetime
import json
import random
from sqlalchemy.orm import Session
from .database import SessionLocal, engine, Base
from .models import (
    User, MerchantCohort, Merchant, MerchantProfile, Transaction, 
    PayerToken, SettlementEvent, RiskSignal, RiskConfiguration, 
    RiskConfigurationVersion, Alert, Case, CaseNote, 
    MerchantInformationRequest, MerchantResponse, EvidenceItem,
    SimulationScenario, CalendarEvent, AuditEvent, Notification
)
from .auth import hash_password
from .risk_engine.signals import SIGNALS_CATALOG
from .simulator.scenarios import SCENARIO_DEFINITIONS, generate_synthetic_transactions

def seed_database(force: bool = False):
    # Re-create tables if forced
    if force:
        Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    
    db: Session = SessionLocal()
    
    # Check if already seeded
    if db.query(User).first() and not force:
        print("Database already contains seed data. Skipping.")
        db.close()
        return

    print("Seeding AEGIS-PAY database with synthetic demo data...")
    now = datetime.datetime.now(datetime.timezone.utc)
    
    # 1. Users
    users_data = [
        {
            "username": "admin",
            "email": "admin@aegispay.demo",
            "full_name": "Ananya Sharma",
            "role": "Admin",
            "password": "admin123"
        },
        {
            "username": "analyst",
            "email": "analyst@aegispay.demo",
            "full_name": "Rohan Varma",
            "role": "Risk Analyst",
            "password": "analyst123"
        },
        {
            "username": "reviewer",
            "email": "reviewer@aegispay.demo",
            "full_name": "Dr. Kavita Menon",
            "role": "Compliance Reviewer",
            "password": "reviewer123"
        },
        {
            "username": "viewer",
            "email": "viewer@aegispay.demo",
            "full_name": "Aditya Roy",
            "role": "Read-only Viewer",
            "password": "viewer123"
        },
        {
            "username": "merchant",
            "email": "merchant@sunrisebakery.demo",
            "full_name": "Vikram Malhotra (Merchant Admin)",
            "role": "Merchant",
            "password": "merchant123"
        }
    ]
    
    created_users = {}
    for ud in users_data:
        u = User(
            username=ud["username"],
            email=ud["email"],
            full_name=ud["full_name"],
            role=ud["role"],
            hashed_password=hash_password(ud["password"]),
            is_active=True,
            created_at=now - datetime.timedelta(days=90)
        )
        db.add(u)
        created_users[ud["username"]] = u
    db.commit()
    
    # 2. Risk Signals Catalog
    for sig_id, meta in SIGNALS_CATALOG.items():
        sig = RiskSignal(
            id=meta["id"],
            name=meta["name"],
            dimension=meta["dimension"],
            formula_description=meta["formula_description"],
            weight=meta["weight"],
            threshold=meta["threshold"],
            severity=meta["severity"],
            confidence_label=meta["confidence_label"],
            analyst_explanation=meta["analyst_explanation"],
            false_positive_notes=meta["false_positive_notes"],
            is_active=True
        )
        db.add(sig)
        
    # 3. Risk Configurations
    weights_default = {sig_id: meta["weight"] for sig_id, meta in SIGNALS_CATALOG.items()}
    thresholds_default = {sig_id: meta["threshold"] for sig_id, meta in SIGNALS_CATALOG.items()}
    tier_boundaries_default = {
        "0": {"min": 0, "max": 250, "label": "Standard"},
        "1": {"min": 251, "max": 500, "label": "Passive Monitoring"},
        "2": {"min": 501, "max": 700, "label": "Targeted Merchant Query"},
        "3": {"min": 701, "max": 850, "label": "Enhanced Review"},
        "4": {"min": 851, "max": 950, "label": "Senior Review / Containment Recommendation"},
        "5": {"min": 951, "max": 1000, "label": "Compliance Decision Required"},
    }
    
    config_v1 = RiskConfiguration(
        version="v1.0.0",
        is_active=True,
        weights_json=json.dumps(weights_default),
        thresholds_json=json.dumps(thresholds_default),
        tier_boundaries_json=json.dumps(tier_boundaries_default),
        created_by="Ananya Sharma (Admin)",
        created_at=now - datetime.timedelta(days=60),
        notes="Production baseline version: Illustrative demo starting weights and thresholds."
    )
    db.add(config_v1)
    
    config_v_history = RiskConfigurationVersion(
        version="v1.0.0",
        weights_json=json.dumps(weights_default),
        thresholds_json=json.dumps(thresholds_default),
        tier_boundaries_json=json.dumps(tier_boundaries_default),
        change_rationale="Initial system deployment with illustrative starting weights calibrated for retail bakery typologies.",
        created_by="Ananya Sharma (Admin)",
        created_at=now - datetime.timedelta(days=60)
    )
    db.add(config_v_history)
    
    # 4. Cohorts
    cohorts_data = [
        {
            "id": "COH-BAKERY-MUMBAI",
            "name": "Bakeries & Confectionery - Mumbai Metropolitan",
            "category": "Bakeries",
            "region": "Mumbai",
            "avg_ticket": 185.0,
            "std_ticket": 48.0,
            "avg_daily_tx_count": 68.0,
            "avg_night_ratio": 0.025,
            "p95_daily_volume": 26000.0,
            "active_merchants_count": 84,
            "description": "Benchmark cohort for artisanal, neighbourhood, and high-street bakeries across Mumbai."
        },
        {
            "id": "COH-BAKERY-BLR",
            "name": "Bakeries & Dessert Cafes - Bengaluru Urban",
            "category": "Bakeries",
            "region": "Bengaluru",
            "avg_ticket": 195.0,
            "std_ticket": 52.0,
            "avg_daily_tx_count": 72.0,
            "avg_night_ratio": 0.035,
            "p95_daily_volume": 28500.0,
            "active_merchants_count": 62,
            "description": "Artisan bakeries, sourdough outlets, and patisseries across Indiranagar, Koramangala, and HSR."
        },
        {
            "id": "COH-BAKERY-DELHI",
            "name": "Bakeries & Sweet Houses - Delhi NCR",
            "category": "Bakeries",
            "region": "Delhi NCR",
            "avg_ticket": 220.0,
            "std_ticket": 65.0,
            "avg_daily_tx_count": 85.0,
            "avg_night_ratio": 0.040,
            "p95_daily_volume": 34000.0,
            "active_merchants_count": 95,
            "description": "Retail bakeries and confectionery shops across South Delhi, Gurgaon, and Noida."
        },
        {
            "id": "COH-REST-PUNE",
            "name": "Cafes & Quick Service Food - Pune Central",
            "category": "Restaurants",
            "region": "Pune",
            "avg_ticket": 240.0,
            "std_ticket": 75.0,
            "avg_daily_tx_count": 92.0,
            "avg_night_ratio": 0.065,
            "p95_daily_volume": 42000.0,
            "active_merchants_count": 48,
            "description": "Student-area and IT-park cafes with extended evening operating windows."
        }
    ]
    for cd in cohorts_data:
        db.add(MerchantCohort(**cd))
    db.commit()
    
    # 5. Calendar Events
    cal_events_data = [
        {
            "id": "EVT-DIWALI-2024",
            "name": "Diwali Festive Season & Corporate Gifting Rush",
            "event_type": "Festival",
            "start_date": now - datetime.timedelta(days=12),
            "end_date": now - datetime.timedelta(days=2),
            "expected_volume_multiplier": 3.5,
            "affected_categories": json.dumps(["Bakeries", "Confectionery", "Restaurants", "Retail"]),
            "notes": "Annual Diwali holiday. Significant surge in sweet hamper gift box purchases and round-amount corporate bulk orders."
        },
        {
            "id": "EVT-IPL-MATCHDAY",
            "name": "Major Cricket League Championship Finals",
            "event_type": "Sports Event",
            "start_date": now - datetime.timedelta(days=3),
            "end_date": now - datetime.timedelta(days=1),
            "expected_volume_multiplier": 1.6,
            "affected_categories": json.dumps(["Restaurants", "Bars", "Snack Outlets"]),
            "notes": "Evening sports viewing window (19:30 to 23:30). High dining demand, but watch for illicit gambling betting collection."
        },
        {
            "id": "EVT-NEWYEAR-EVE",
            "name": "New Year Holiday Celebration Window",
            "event_type": "National Holiday",
            "start_date": now + datetime.timedelta(days=40),
            "end_date": now + datetime.timedelta(days=44),
            "expected_volume_multiplier": 2.8,
            "affected_categories": json.dumps(["Bakeries", "Restaurants", "Hospitality"]),
            "notes": "Midnight cake deliveries and catering celebrations."
        }
    ]
    for ed in cal_events_data:
        db.add(CalendarEvent(**ed))
    db.commit()
    
    # 6. Monitored Merchants
    merchants_data = [
        {
            "id": "MER-001-GOLDEN",
            "name": "Golden Crust Artisan Bakery",
            "legal_name": "Golden Crust Baking Enterprises Pvt Ltd",
            "business_category": "Bakeries",
            "subcategory": "Artisanal Bread & Sourdough",
            "city": "Mumbai",
            "region": "Bandra West",
            "cohort_id": "COH-BAKERY-MUMBAI",
            "onboarding_date": now - datetime.timedelta(days=420),
            "account_status": "Active",
            "declared_monthly_volume": 180000.0,
            "declared_avg_ticket": 175.0,
            "declared_operating_hours": "07:30 - 21:30",
            "current_risk_score": 115,
            "current_risk_tier": 0,
            "assigned_analyst_id": created_users["analyst"].id,
            "assigned_analyst_name": "Rohan Varma",
            "profile": {
                "pan_masked": "AAACG****K",
                "gst_number_masked": "27AAACG****1Z4",
                "registered_address": "Shop 3, Shirley Rajan Road, Bandra West, Mumbai 400050",
                "physical_storefront": True,
                "website_url": "https://goldencrust.synthetic.example",
                "mcc_code": "5462",
                "settlement_bank_name": "HDFC Bank Ltd",
                "settlement_account_masked": "50100******8412",
                "corroboration_status": "Verified at Onboarding",
                "notes": "Established neighborhood bakery. Consistently normal daylight transaction patterns with high repeat customer ratio."
            }
        },
        {
            "id": "MER-002-FESTIVE",
            "name": "Festive Treats & Confectionery",
            "legal_name": "Festive Treats Bakers LLP",
            "business_category": "Bakeries",
            "subcategory": "Gifting & Sweet Boxes",
            "city": "Delhi NCR",
            "region": "South Extension",
            "cohort_id": "COH-BAKERY-DELHI",
            "onboarding_date": now - datetime.timedelta(days=260),
            "account_status": "Active",
            "declared_monthly_volume": 250000.0,
            "declared_avg_ticket": 220.0,
            "declared_operating_hours": "09:00 - 22:00",
            "current_risk_score": 285,
            "current_risk_tier": 1,
            "assigned_analyst_id": created_users["analyst"].id,
            "assigned_analyst_name": "Rohan Varma",
            "profile": {
                "pan_masked": "AABCF****M",
                "gst_number_masked": "07AABCF****1ZP",
                "registered_address": "G-14, Main Market, South Extension Part 1, New Delhi 110049",
                "physical_storefront": True,
                "website_url": "https://festivetreats.synthetic.example",
                "mcc_code": "5462",
                "settlement_bank_name": "ICICI Bank Ltd",
                "settlement_account_masked": "00120******9215",
                "corroboration_status": "Verified at Onboarding",
                "notes": "Diwali hamper seasonal volume surge. Active festive calendar multiplier properly damps false-positive escalation."
            }
        },
        {
            "id": "MER-003-SUNRISE",
            "name": "Sunrise Artisanal Bakes & Cafe",
            "legal_name": "Sunrise Hospitality Ventures LLP",
            "business_category": "Bakeries",
            "subcategory": "Pastry & Cafe",
            "city": "Bengaluru",
            "region": "Indiranagar",
            "cohort_id": "COH-BAKERY-BLR",
            "onboarding_date": now - datetime.timedelta(days=180),
            "account_status": "Under Review",
            "declared_monthly_volume": 160000.0,
            "declared_avg_ticket": 190.0,
            "declared_operating_hours": "08:00 - 21:00",
            "current_risk_score": 965,
            "current_risk_tier": 5,
            "assigned_analyst_id": created_users["analyst"].id,
            "assigned_analyst_name": "Rohan Varma",
            "profile": {
                "pan_masked": "AATCV****L",
                "gst_number_masked": "29AATCV****1ZX",
                "registered_address": "12th Main Road, 100 Feet Road, Indiranagar, Bengaluru 560038",
                "physical_storefront": True,
                "website_url": "https://sunrisebakes.synthetic.example",
                "mcc_code": "5462",
                "settlement_bank_name": "Axis Bank Ltd",
                "settlement_account_masked": "91802******3301",
                "corroboration_status": "Pending Investigation",
                "notes": "PRIMARY CASE STUDY SUBJECT: The Bakery That Takes Bets. Onboarded legitimately as a cafe; recently co-opted to collect cricket betting stakes at night."
            }
        },
        {
            "id": "MER-004-DORMANT",
            "name": "Dormant Delights Pastry Shop",
            "legal_name": "Delights Confectionery Services",
            "business_category": "Bakeries",
            "subcategory": "Custom Cakes",
            "city": "Pune",
            "region": "Kothrud",
            "cohort_id": "COH-REST-PUNE",
            "onboarding_date": now - datetime.timedelta(days=300),
            "account_status": "Under Review",
            "declared_monthly_volume": 120000.0,
            "declared_avg_ticket": 180.0,
            "declared_operating_hours": "10:00 - 21:00",
            "current_risk_score": 540,
            "current_risk_tier": 2,
            "assigned_analyst_id": created_users["analyst"].id,
            "assigned_analyst_name": "Rohan Varma",
            "profile": {
                "pan_masked": "AAEPD****Q",
                "gst_number_masked": "27AAEPD****1ZA",
                "registered_address": "Plot 18, Paud Road, Kothrud, Pune 411038",
                "physical_storefront": True,
                "website_url": None,
                "mcc_code": "5462",
                "settlement_bank_name": "Kotak Mahindra Bank",
                "settlement_account_masked": "28100******1049",
                "corroboration_status": "Verified at Onboarding",
                "notes": "Dormant merchant account reactivated with sudden spike in transactions. Cold start baseline flag applied."
            }
        },
        {
            "id": "MER-005-ONLINE",
            "name": "Cloud Crust Digital Kitchen",
            "legal_name": "Cloud Crust Foods Pvt Ltd",
            "business_category": "Bakeries",
            "subcategory": "Cloud Kitchen / Online Only",
            "city": "Hyderabad",
            "region": "Madhapur",
            "cohort_id": "COH-BAKERY-BLR",
            "onboarding_date": now - datetime.timedelta(days=90),
            "account_status": "Active",
            "declared_monthly_volume": 220000.0,
            "declared_avg_ticket": 210.0,
            "declared_operating_hours": "09:00 - 23:00",
            "current_risk_score": 580,
            "current_risk_tier": 2,
            "assigned_analyst_id": created_users["analyst"].id,
            "assigned_analyst_name": "Rohan Varma",
            "profile": {
                "pan_masked": "AAKCC****R",
                "gst_number_masked": "36AAKCC****1Z2",
                "registered_address": "Flat 204, Silicon Towers, Madhapur, Hyderabad 500081",
                "physical_storefront": False,
                "website_url": "https://cloudcrust.synthetic.example",
                "mcc_code": "5814",
                "settlement_bank_name": "State Bank of India",
                "settlement_account_masked": "30491******7722",
                "corroboration_status": "Virtual Address Only",
                "notes": "Digital kitchen with no physical storefront. Transaction profile deviates from traditional bakery counter."
            }
        },
        {
            "id": "MER-006-BLUEOAK",
            "name": "Blue Oak Cafe & Bakehouse",
            "legal_name": "Blue Oak Hospitality LLP",
            "business_category": "Bakeries",
            "subcategory": "Artisan Bakery",
            "city": "Mumbai",
            "region": "Colaba",
            "cohort_id": "COH-BAKERY-MUMBAI",
            "onboarding_date": now - datetime.timedelta(days=210),
            "account_status": "Active",
            "declared_monthly_volume": 190000.0,
            "declared_avg_ticket": 195.0,
            "declared_operating_hours": "08:00 - 22:00",
            "current_risk_score": 140,
            "current_risk_tier": 0,
            "assigned_analyst_id": created_users["analyst"].id,
            "assigned_analyst_name": "Rohan Varma",
            "profile": {
                "pan_masked": "AABOB****N",
                "gst_number_masked": "27AABOB****1ZD",
                "registered_address": "8, Walton Road, Colaba Causeway, Mumbai 400001",
                "physical_storefront": True,
                "website_url": "https://blueoakcafe.synthetic.example",
                "mcc_code": "5462",
                "settlement_bank_name": "HDFC Bank Ltd",
                "settlement_account_masked": "50100******9910",
                "corroboration_status": "Verified at Onboarding",
                "notes": "Steady tourist and local clientele in South Mumbai."
            }
        },
        {
            "id": "MER-007-SWEETTOOTH",
            "name": "Sweet Tooth Cupcake Studio",
            "legal_name": "Sweet Tooth Confections",
            "business_category": "Bakeries",
            "subcategory": "Cupcakes & Desserts",
            "city": "Bengaluru",
            "region": "Koramangala",
            "cohort_id": "COH-BAKERY-BLR",
            "onboarding_date": now - datetime.timedelta(days=150),
            "account_status": "Active",
            "declared_monthly_volume": 130000.0,
            "declared_avg_ticket": 160.0,
            "declared_operating_hours": "11:00 - 21:00",
            "current_risk_score": 105,
            "current_risk_tier": 0,
            "assigned_analyst_id": created_users["analyst"].id,
            "assigned_analyst_name": "Rohan Varma",
            "profile": {
                "pan_masked": "AAJST****T",
                "gst_number_masked": "29AAJST****1ZY",
                "registered_address": "5th Block, Koramangala, Bengaluru 560095",
                "physical_storefront": True,
                "website_url": "https://sweettooth.synthetic.example",
                "mcc_code": "5462",
                "settlement_bank_name": "Axis Bank Ltd",
                "settlement_account_masked": "91802******4419",
                "corroboration_status": "Verified at Onboarding",
                "notes": "Healthy retail shop with steady daytime cupcake purchases."
            }
        },
        {
            "id": "MER-008-ROYALPATISSERIE",
            "name": "Royal Patisserie & Macarons",
            "legal_name": "Royal French Bakes India Pvt Ltd",
            "business_category": "Bakeries",
            "subcategory": "High-End Confectionery",
            "city": "Delhi NCR",
            "region": "Khan Market",
            "cohort_id": "COH-BAKERY-DELHI",
            "onboarding_date": now - datetime.timedelta(days=500),
            "account_status": "Active",
            "declared_monthly_volume": 450000.0,
            "declared_avg_ticket": 480.0,
            "declared_operating_hours": "10:00 - 22:00",
            "current_risk_score": 310,
            "current_risk_tier": 1,
            "assigned_analyst_id": created_users["analyst"].id,
            "assigned_analyst_name": "Rohan Varma",
            "profile": {
                "pan_masked": "AABRP****X",
                "gst_number_masked": "07AABRP****1ZJ",
                "registered_address": "Shop 42-A, Khan Market, New Delhi 110003",
                "physical_storefront": True,
                "website_url": "https://royalpatisserie.synthetic.example",
                "mcc_code": "5462",
                "settlement_bank_name": "Standard Chartered Bank",
                "settlement_account_masked": "42200******8831",
                "corroboration_status": "Verified at Onboarding",
                "notes": "Premium bakery with high average ticket size due to luxury macaron boxes."
            }
        },
        {
            "id": "MER-009-MIDNIGHTBREAD",
            "name": "The Midnight Oven Bakehouse",
            "legal_name": "Midnight Food Ventures LLP",
            "business_category": "Bakeries",
            "subcategory": "Late-Night Dessert Counter",
            "city": "Pune",
            "region": "Viman Nagar",
            "cohort_id": "COH-REST-PUNE",
            "onboarding_date": now - datetime.timedelta(days=120),
            "account_status": "Active",
            "declared_monthly_volume": 170000.0,
            "declared_avg_ticket": 210.0,
            "declared_operating_hours": "18:00 - 03:00",
            "current_risk_score": 240,
            "current_risk_tier": 0,
            "assigned_analyst_id": created_users["analyst"].id,
            "assigned_analyst_name": "Rohan Varma",
            "profile": {
                "pan_masked": "AANMO****S",
                "gst_number_masked": "27AANMO****1ZH",
                "registered_address": "Shop 9, Clover Park, Viman Nagar, Pune 411014",
                "physical_storefront": True,
                "website_url": None,
                "mcc_code": "5462",
                "settlement_bank_name": "HDFC Bank Ltd",
                "settlement_account_masked": "50100******1182",
                "corroboration_status": "Verified at Onboarding",
                "notes": "Late-night bakery by design (declared 18:00 - 03:00). Engine does not flag off-hours since schedule matches declared profile."
            }
        },
        {
            "id": "MER-010-HERITAGEBAKES",
            "name": "Heritage Parsi Bakery",
            "legal_name": "Heritage Parsi Confectioners",
            "business_category": "Bakeries",
            "subcategory": "Traditional Bakery",
            "city": "Mumbai",
            "region": "Fort",
            "cohort_id": "COH-BAKERY-MUMBAI",
            "onboarding_date": now - datetime.timedelta(days=700),
            "account_status": "Active",
            "declared_monthly_volume": 140000.0,
            "declared_avg_ticket": 130.0,
            "declared_operating_hours": "07:00 - 20:00",
            "current_risk_score": 90,
            "current_risk_tier": 0,
            "assigned_analyst_id": created_users["analyst"].id,
            "assigned_analyst_name": "Rohan Varma",
            "profile": {
                "pan_masked": "AAHPB****P",
                "gst_number_masked": "27AAHPB****1ZU",
                "registered_address": "22, Sir P.M. Road, Fort, Mumbai 400001",
                "physical_storefront": True,
                "website_url": None,
                "mcc_code": "5462",
                "settlement_bank_name": "Bank of Baroda",
                "settlement_account_masked": "04120******5512",
                "corroboration_status": "Verified at Onboarding",
                "notes": "Legacy bakery with multi-decade operating history and 75% repeat local customers."
            }
        }
    ]
    
    for md in merchants_data:
        prof_data = md.pop("profile")
        m = Merchant(**md)
        db.add(m)
        db.flush()
        
        prof = MerchantProfile(merchant_id=m.id, **prof_data)
        db.add(prof)
    db.commit()
    
    # 7. Generate Synthetic Transactions for the Scenarios
    print("Generating baseline transactions across merchants...")
    # Baseline transactions for all merchants over past 30 days
    all_merchants = db.query(Merchant).all()
    for m in all_merchants:
        if m.id == "MER-003-SUNRISE":
            # 1. 25 days of normal bakery history
            generate_synthetic_transactions(
                merchant_id=m.id,
                scenario_key="SCENARIO_1_NORMAL_BAKERY",
                db=db,
                start_time=now - datetime.timedelta(days=28),
                duration_hours=24 * 25,
                tx_count_override=140
            )
            # 2. Sudden illicit betting front spike over the past 40 hours
            generate_synthetic_transactions(
                merchant_id=m.id,
                scenario_key="SCENARIO_3_HYBRID_BETTING_FRONT",
                db=db,
                start_time=now - datetime.timedelta(hours=40),
                duration_hours=40,
                tx_count_override=280
            )
        elif m.id == "MER-002-FESTIVE":
            # Festive hamper rush
            generate_synthetic_transactions(
                merchant_id=m.id,
                scenario_key="SCENARIO_2_FESTIVE_BAKERY",
                db=db,
                start_time=now - datetime.timedelta(days=8),
                duration_hours=24 * 7,
                tx_count_override=210
            )
        elif m.id == "MER-004-DORMANT":
            # Long dormant period + sudden reactivation
            generate_synthetic_transactions(
                merchant_id=m.id,
                scenario_key="SCENARIO_4_SLEEPER_REACTIVATION",
                db=db,
                start_time=now - datetime.timedelta(hours=36),
                duration_hours=36,
                tx_count_override=55
            )
        elif m.id == "MER-005-ONLINE":
            generate_synthetic_transactions(
                merchant_id=m.id,
                scenario_key="SCENARIO_5_ONLINE_PROXY",
                db=db,
                start_time=now - datetime.timedelta(days=14),
                duration_hours=24 * 14,
                tx_count_override=95
            )
        else:
            # Normal baseline bakery
            generate_synthetic_transactions(
                merchant_id=m.id,
                scenario_key="SCENARIO_1_NORMAL_BAKERY",
                db=db,
                start_time=now - datetime.timedelta(days=20),
                duration_hours=24 * 20,
                tx_count_override=random.randint(65, 110)
            )
            
    # 8. Alerts
    alerts_data = [
        {
            "id": "ALT-2024-001",
            "merchant_id": "MER-003-SUNRISE",
            "score": 965,
            "tier": 5,
            "severity": "Critical",
            "status": "Escalated",
            "assigned_analyst_id": created_users["analyst"].id,
            "assigned_analyst_name": "Rohan Varma",
            "triggered_signals": json.dumps([
                "SIG_TIMING_OFFHOURS",
                "SIG_TIMING_NIGHT_SPIKE",
                "SIG_AMOUNT_ROUND_RATIO",
                "SIG_PAYER_FANIN_VELOCITY",
                "SIG_PAYER_REPEAT_DROP",
                "SIG_PAYER_CLUSTER_VELOCITY",
                "SIG_FLOW_SETTLEMENT_VELOCITY",
                "SIG_CAPACITY_PEER_DIVERGENCE"
            ]),
            "recommended_next_step": "Mandatory Senior Compliance Review & Information Clarification (Form R-2)",
            "review_due_date": now + datetime.timedelta(days=1),
            "first_detected_at": now - datetime.timedelta(hours=36),
            "latest_detected_at": now - datetime.timedelta(hours=2),
            "configuration_version": "v1.0.0"
        },
        {
            "id": "ALT-2024-002",
            "merchant_id": "MER-004-DORMANT",
            "score": 540,
            "tier": 2,
            "severity": "Medium",
            "status": "Merchant Information Requested",
            "assigned_analyst_id": created_users["analyst"].id,
            "assigned_analyst_name": "Rohan Varma",
            "triggered_signals": json.dumps([
                "SIG_CAPACITY_BASELINE_SURGE",
                "SIG_AMOUNT_ROUND_RATIO"
            ]),
            "recommended_next_step": "Awaiting Merchant Clarification on Account Reactivation",
            "review_due_date": now + datetime.timedelta(days=3),
            "first_detected_at": now - datetime.timedelta(hours=24),
            "latest_detected_at": now - datetime.timedelta(hours=10),
            "configuration_version": "v1.0.0"
        },
        {
            "id": "ALT-2024-003",
            "merchant_id": "MER-005-ONLINE",
            "score": 580,
            "tier": 2,
            "severity": "Medium",
            "status": "Under Review",
            "assigned_analyst_id": created_users["analyst"].id,
            "assigned_analyst_name": "Rohan Varma",
            "triggered_signals": json.dumps([
                "SIG_AMOUNT_TICKET_DEVIATION",
                "SIG_PAYER_REPEAT_DROP"
            ]),
            "recommended_next_step": "Verify Cloud Kitchen Operating License & Delivery Presence",
            "review_due_date": now + datetime.timedelta(days=2),
            "first_detected_at": now - datetime.timedelta(hours=48),
            "latest_detected_at": now - datetime.timedelta(hours=16),
            "configuration_version": "v1.0.0"
        },
        {
            "id": "ALT-2024-004",
            "merchant_id": "MER-008-ROYALPATISSERIE",
            "score": 310,
            "tier": 1,
            "severity": "Low",
            "status": "Cleared",
            "assigned_analyst_id": created_users["analyst"].id,
            "assigned_analyst_name": "Rohan Varma",
            "triggered_signals": json.dumps(["SIG_AMOUNT_TICKET_DEVIATION"]),
            "recommended_next_step": "No action required; legitimate luxury pricing structure",
            "review_due_date": now - datetime.timedelta(days=2),
            "first_detected_at": now - datetime.timedelta(days=6),
            "latest_detected_at": now - datetime.timedelta(days=5),
            "cleared_reason": "Analyst reviewed menu items and previous invoices; high ticket sizes (₹480–₹1200) match luxury French macaron gift boxes.",
            "configuration_version": "v1.0.0"
        }
    ]
    for ad in alerts_data:
        db.add(Alert(**ad))
    db.commit()
    
    # 9. Cases
    case_1 = Case(
        id="CASE-2024-001",
        title="Investigation: Suspected Transaction Laundering via Retail Bakery ID",
        merchant_id="MER-003-SUNRISE",
        alert_ids=json.dumps(["ALT-2024-001"]),
        status="Senior Review Pending",
        priority="Critical",
        assigned_to_id=created_users["reviewer"].id,
        assigned_to_name="Dr. Kavita Menon",
        current_recommendation="Simulated Recommendation: Place temporary policy containment on incremental daily settlement and conduct physical storefront inspection.",
        recommendation_rationale="Severe divergence across 5 orthogonal behavioural dimensions: 68% late-night volume, 420+ distinct transient payer tokens depositing round betting sums (₹1,000 / ₹2,000), immediate on-demand payout requests, and 8.4x volume excess over cohort p95.",
        reviewer_decision=None,
        created_at=now - datetime.timedelta(hours=30)
    )
    db.add(case_1)
    db.flush()
    
    # Case Notes
    notes_data = [
        {
            "case_id": case_1.id,
            "author_id": created_users["analyst"].id,
            "author_name": "Rohan Varma",
            "note_type": "Investigation Note",
            "content": "Initial review completed. The merchant was onboarded 6 months ago as a daytime artisan bakery with declared hours 08:00–21:00. However, over the past 48 hours, 72% of total collection occurred between 23:30 and 03:15. Payer analysis indicates over 350 single-visit payer tokens submitting repeated identical amounts (₹1,000 and ₹2,000). This pattern strongly correlates with suspected online sports wagering collection rounds.",
            "created_at": now - datetime.timedelta(hours=28)
        },
        {
            "case_id": case_1.id,
            "author_id": created_users["analyst"].id,
            "author_name": "Rohan Varma",
            "note_type": "Investigation Note",
            "content": "Issued formal Merchant Information Clarification Request (Form R-2) requesting batch sales invoices and clarification for midnight operation. Escalating to Dr. Kavita Menon (Senior Reviewer).",
            "created_at": now - datetime.timedelta(hours=18)
        },
        {
            "case_id": case_1.id,
            "author_id": created_users["reviewer"].id,
            "author_name": "Dr. Kavita Menon",
            "note_type": "Review Note",
            "content": "Case received for senior review. Noted that provider-visible payout events demonstrate 92% of funds swept via rapid payout requests within 2 hours of midnight spikes. We must not initiate real account freezes without compliance authorization, but simulated containment recommendation is recorded pending merchant reply.",
            "created_at": now - datetime.timedelta(hours=8)
        }
    ]
    for nd in notes_data:
        db.add(CaseNote(**nd))
        
    # Merchant Information Request
    req_1 = MerchantInformationRequest(
        id="REQ-2024-001",
        case_id=case_1.id,
        merchant_id="MER-003-SUNRISE",
        request_type="unusual_timing",
        subject="Clarification Required: Recent Midnight Transaction Volume and Payer Patterns",
        message="Dear Vikram Malhotra, our continuous monitoring systems noted a substantial volume of transactions processed between 23:30 and 03:30 over the past 48 hours, which differs from your declared retail store hours (08:00 - 21:00). Please provide order receipts, POS register logs, or a business explanation for these late-night transactions within 48 hours to ensure uninterrupted processing.",
        due_date=now + datetime.timedelta(days=2),
        status="Responded",
        created_by_id=created_users["analyst"].id,
        created_by_name="Rohan Varma",
        created_at=now - datetime.timedelta(hours=24)
    )
    db.add(req_1)
    db.flush()
    
    # Merchant Response
    resp_1 = MerchantResponse(
        request_id=req_1.id,
        merchant_id="MER-003-SUNRISE",
        response_text="We recently partnered with a late-night corporate event organizer in Indiranagar who hosted an overnight hackathon and music festival. They placed large bulk orders for midnight snacks, croissants, and coffee. We set up an express QR checkout stall at their venue, which is why individual attendees were scanning to pay for combo meal vouchers.",
        attachment_filenames=json.dumps(["invoice_hackathon_event_nov2024.pdf", "stall_permission_letter.pdf"]),
        submitted_at=now - datetime.timedelta(hours=12),
        reviewer_verified=False
    )
    db.add(resp_1)
    
    # Evidence Items
    evidence_data = [
        {
            "case_id": case_1.id,
            "merchant_id": "MER-003-SUNRISE",
            "evidence_type": "Timing Spike & Night Concentration",
            "title": "Off-Hours Transaction Spike (23:30 - 03:30)",
            "description": "Observed 280+ transactions between 23:30 and 03:30. In contrast, historical 30-day baseline displays zero transactions past 21:30.",
            "provenance_type": "Directly Observed",
            "raw_data_json": json.dumps({"night_volume_inr": 348000.0, "night_tx_count": 280, "percentage_total": 72.4}),
            "created_at": now - datetime.timedelta(hours=26)
        },
        {
            "case_id": case_1.id,
            "merchant_id": "MER-003-SUNRISE",
            "evidence_type": "Payer Fan-in & Dispersion Shift",
            "title": "Sudden Surge in 400+ First-Time Pseudonymous Payer Tokens",
            "description": "Unique payer fan-in velocity reached 8.2x cohort average. 96.5% of payers had never transacted with this merchant before.",
            "provenance_type": "Directly Observed (Pseudonymous Token)",
            "raw_data_json": json.dumps({"unique_payers_48h": 412, "repeat_customer_rate": 0.035, "baseline_repeat_rate": 0.62}),
            "created_at": now - datetime.timedelta(hours=25)
        },
        {
            "case_id": case_1.id,
            "merchant_id": "MER-003-SUNRISE",
            "evidence_type": "Round Denomination Clustering",
            "title": "Exact Staking Sums (₹500, ₹1000, ₹2000, ₹5000)",
            "description": "88% of incoming volume concentrated in exact round stakes rather than standard bakery menu pricing.",
            "provenance_type": "Directly Observed",
            "raw_data_json": json.dumps({"round_amount_percentage": 88.2, "top_amounts": [1000, 2000, 500, 5000]}),
            "created_at": now - datetime.timedelta(hours=24)
        },
        {
            "case_id": case_1.id,
            "merchant_id": "MER-003-SUNRISE",
            "evidence_type": "Flow & Settlement Acceleration",
            "title": "Immediate Provider-Visible Settlement Outflow",
            "description": "Merchant requested on-demand settlement payout of ₹320,000 within 90 minutes of night collection peak.",
            "provenance_type": "Derived (Provider-Visible Only)",
            "raw_data_json": json.dumps({"payout_requested_inr": 320160.0, "delay_hours": 1.5, "payout_ratio": 0.92}),
            "created_at": now - datetime.timedelta(hours=20)
        },
        {
            "case_id": case_1.id,
            "merchant_id": "MER-003-SUNRISE",
            "evidence_type": "Merchant Clarification Response",
            "title": "Merchant Response: Claim of Overnight Hackathon Catering Stall",
            "description": "Vikram Malhotra submitted written claim of event catering at tech hackathon; submitted unverified invoice PDF.",
            "provenance_type": "Merchant-declared",
            "raw_data_json": json.dumps({"claim": "Hackathon catering stall", "status": "Under Reviewer Verification"}),
            "created_at": now - datetime.timedelta(hours=12)
        }
    ]
    for ed in evidence_data:
        db.add(EvidenceItem(**ed))
        
    # Second Case: Dormant Delights
    case_2 = Case(
        id="CASE-2024-002",
        title="Investigation: Sudden Dormant Account Reactivation (Cold-Start)",
        merchant_id="MER-004-DORMANT",
        alert_ids=json.dumps(["ALT-2024-002"]),
        status="Pending Merchant Clarification",
        priority="Medium",
        assigned_to_id=created_users["analyst"].id,
        assigned_to_name="Rohan Varma",
        current_recommendation="Request updated business registration and store photos.",
        recommendation_rationale="Account dormant for 8 months with under ₹2,000 monthly volume suddenly processed ₹42,000 over 36 hours.",
        created_at=now - datetime.timedelta(hours=20)
    )
    db.add(case_2)
    db.commit()
    
    # 10. Audit Trail
    audit_records = [
        {
            "actor_id": created_users["admin"].id,
            "actor_name": "Ananya Sharma",
            "actor_role": "Admin",
            "action": "POLICY_CONFIGURATION_DEPLOY",
            "entity_type": "RiskConfiguration",
            "entity_id": "v1.0.0",
            "before_state": None,
            "after_state": json.dumps({"version": "v1.0.0", "active_signals": 10}),
            "rationale": "Initial deployment of illustrative starting weights and 6-tier risk threshold boundaries.",
            "timestamp": now - datetime.timedelta(days=60)
        },
        {
            "actor_id": created_users["analyst"].id,
            "actor_name": "Rohan Varma",
            "actor_role": "Risk Analyst",
            "action": "ALERT_ASSIGN",
            "entity_type": "Alert",
            "entity_id": "ALT-2024-001",
            "before_state": json.dumps({"status": "New", "assigned": None}),
            "after_state": json.dumps({"status": "Assigned", "assigned": "Rohan Varma"}),
            "rationale": "Assigned high-priority Tier 5 alert for immediate triage.",
            "timestamp": now - datetime.timedelta(hours=34)
        },
        {
            "actor_id": created_users["analyst"].id,
            "actor_name": "Rohan Varma",
            "actor_role": "Risk Analyst",
            "action": "CASE_CREATE",
            "entity_type": "Case",
            "entity_id": "CASE-2024-001",
            "before_state": None,
            "after_state": json.dumps({"id": "CASE-2024-001", "merchant": "MER-003-SUNRISE"}),
            "rationale": "Opened formal case due to persistent anomalous night transactions and round denomination clustering.",
            "timestamp": now - datetime.timedelta(hours=30)
        },
        {
            "actor_id": created_users["analyst"].id,
            "actor_name": "Rohan Varma",
            "actor_role": "Risk Analyst",
            "action": "MERCHANT_REQUEST_SUBMIT",
            "entity_type": "MerchantInformationRequest",
            "entity_id": "REQ-2024-001",
            "before_state": None,
            "after_state": json.dumps({"type": "unusual_timing", "merchant": "MER-003-SUNRISE"}),
            "rationale": "Dispatched formal inquiry request to merchant regarding off-hours volume.",
            "timestamp": now - datetime.timedelta(hours=24)
        },
        {
            "actor_id": created_users["analyst"].id,
            "actor_name": "Rohan Varma",
            "actor_role": "Risk Analyst",
            "action": "CASE_ESCALATE",
            "entity_type": "Case",
            "entity_id": "CASE-2024-001",
            "before_state": json.dumps({"status": "Under Investigation"}),
            "after_state": json.dumps({"status": "Senior Review Pending"}),
            "rationale": "Escalated to Compliance Reviewer due to severe volume divergence and rapid payout sweeps.",
            "timestamp": now - datetime.timedelta(hours=18)
        },
        {
            "actor_id": created_users["merchant"].id,
            "actor_name": "Vikram Malhotra",
            "actor_role": "Merchant",
            "action": "MERCHANT_RESPONSE_SUBMIT",
            "entity_type": "MerchantResponse",
            "entity_id": "RESP-2024-001",
            "before_state": None,
            "after_state": json.dumps({"request_id": "REQ-2024-001", "claim": "Hackathon catering stall"}),
            "rationale": "Merchant submitted formal explanation and supporting invoice documentation via Merchant Portal.",
            "timestamp": now - datetime.timedelta(hours=12)
        },
        {
            "actor_id": created_users["analyst"].id,
            "actor_name": "Rohan Varma",
            "actor_role": "Risk Analyst",
            "action": "ALERT_CLEAR",
            "entity_type": "Alert",
            "entity_id": "ALT-2024-004",
            "before_state": json.dumps({"status": "Under Review"}),
            "after_state": json.dumps({"status": "Cleared"}),
            "rationale": "Verified legitimate French macaron luxury menu pricing structure.",
            "timestamp": now - datetime.timedelta(days=2)
        }
    ]
    for ar in audit_records:
        db.add(AuditEvent(**ar))
        
    # 11. Notifications
    notifs = [
        {
            "user_id": created_users["analyst"].id,
            "title": "Critical Alert: Sunrise Artisanal Bakes & Cafe",
            "message": "Tier 5 risk indicator triggered: Multi-signal night concentration and round-amount surge detected.",
            "type": "alert",
            "link": "/alerts/ALT-2024-001"
        },
        {
            "user_id": created_users["reviewer"].id,
            "title": "Case Escalated for Senior Review",
            "message": "Case CASE-2024-001 has been escalated by Rohan Varma for senior policy containment review.",
            "type": "case",
            "link": "/cases/CASE-2024-001"
        },
        {
            "user_id": created_users["analyst"].id,
            "title": "Merchant Clarification Received",
            "message": "Vikram Malhotra (Sunrise Artisanal Bakes) submitted a response to request REQ-2024-001.",
            "type": "case",
            "link": "/cases/CASE-2024-001"
        }
    ]
    for nf in notifs:
        db.add(Notification(**nf))
        
    # 12. Simulation Scenarios table records
    for sc in SCENARIO_DEFINITIONS:
        db.add(SimulationScenario(
            key=sc["key"],
            title=sc["title"],
            description=sc["description"],
            typology=sc["typology"],
            expected_tier=sc["expected_tier"]
        ))
        
    db.commit()
    db.close()
    print("Seed complete! Synthetic dataset generated successfully.")

if __name__ == "__main__":
    seed_database(force=True)
