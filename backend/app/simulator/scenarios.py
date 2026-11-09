"""
AEGIS-PAY Synthetic Merchant Scenario Generator
Implements the 5 core scenarios and 12 adversarial / false-positive tests.
Generates realistic synthetic transactions with pseudonymous payer tokens.
Never uses real card numbers, bank accounts, or PII.
"""

import datetime
import random
import uuid
from typing import Dict, Any, List, Tuple
from sqlalchemy.orm import Session
from ..models import Merchant, Transaction, PayerToken, SettlementEvent, CalendarEvent

SCENARIO_DEFINITIONS = [
    {
        "key": "SCENARIO_1_NORMAL_BAKERY",
        "title": "Scenario 1: Normal Neighbourhood Bakery",
        "merchant_name": "Golden Crust Artisan Bakery",
        "category": "Bakeries",
        "city": "Mumbai",
        "expected_tier": "Tier 0 / 1 (Standard)",
        "description": "Legitimate local bakery operating 07:30 to 21:30. Typical retail ticket sizes (₹80–₹350), 65% repeat neighbourhood customers, standard next-day batch settlement.",
        "typology": "Baseline Normal Retail",
        "target_merchant_id": "MER-001-GOLDEN"
    },
    {
        "key": "SCENARIO_2_FESTIVE_BAKERY",
        "title": "Scenario 2: Legitimate Festive Bakery (Diwali Rush)",
        "merchant_name": "Festive Treats & Confectionery",
        "category": "Bakeries",
        "city": "Delhi NCR",
        "expected_tier": "Tier 0 / 1 (Recognised Seasonality)",
        "description": "Legitimate bakery experiencing a 3.5x Diwali gift-box volume surge and corporate gifting orders (₹800–₹2,500). System recognises the active festival calendar event and avoids severe false-positive escalation.",
        "typology": "Seasonal Surge (Legitimate)",
        "target_merchant_id": "MER-002-FESTIVE"
    },
    {
        "key": "SCENARIO_3_HYBRID_BETTING_FRONT",
        "title": "Scenario 3: The Bakery That Takes Bets (Hybrid Front)",
        "merchant_name": "Sunrise Artisanal Bakes & Cafe",
        "category": "Bakeries",
        "city": "Bengaluru",
        "expected_tier": "Tier 4 / 5 (Senior Review / Mandatory Compliance Review)",
        "description": "Onboarded as a neighbourhood bakery. Account repurposed to collect deposits for illicit cricket-betting rounds. Massive late-night spikes (23:00–03:00), round betting stakes (₹500, ₹1000, ₹2000, ₹5000), 400+ new unique payer tokens within hours, and immediate provider-visible settlement payout requests.",
        "typology": "Transaction Laundering / Unlicensed Gambling Front",
        "target_merchant_id": "MER-003-SUNRISE"
    },
    {
        "key": "SCENARIO_4_SLEEPER_REACTIVATION",
        "title": "Scenario 4: Sleeper / Dormant Merchant Reactivation",
        "merchant_name": "Dormant Delights Pastry Shop",
        "category": "Bakeries",
        "city": "Pune",
        "expected_tier": "Tier 2 / 3 (Targeted Query / Cold-Start Flag)",
        "description": "Account registered 8 months ago with near-zero transaction volume (1-2 tx/month). Suddenly experiences rapid volume influx. Engine flags change for human review while correctly tagging the cold-start baseline condition.",
        "typology": "Dormant Shell Reactivation",
        "target_merchant_id": "MER-004-DORMANT"
    },
    {
        "key": "SCENARIO_5_ONLINE_PROXY",
        "title": "Scenario 5: Online Proxy / Digital Cloaked Merchant",
        "merchant_name": "Cloud Crust Digital Kitchen",
        "category": "Bakeries",
        "city": "Hyderabad",
        "expected_tier": "Tier 2 / 3 (Clarification Query)",
        "description": "Purely digital merchant with no storefront presence. Transaction distribution deviates from declared physical bakery capacity, with dispersed payers transacting across atypical digital channels.",
        "typology": "Digital Proxy / Business Mismatch",
        "target_merchant_id": "MER-005-ONLINE"
    }
]

ADVERSARIAL_TEST_CASES = [
    {
        "id": "ADV-01",
        "name": "Viral Food-Influencer Video",
        "type": "False-Positive Stress Test",
        "description": "Viral Instagram reel drives 8x sudden daytime footfall and 500 new unique payers within 6 hours during standard opening hours.",
        "expected_outcome": "Engine flags payer fan-in but dampens night/offhours score; remains Tier 1/2 without inappropriate Tier 4/5 containment.",
        "synthetic_ground_truth": "Legitimate"
    },
    {
        "id": "ADV-02",
        "name": "Fixed-Price Gourmet Buffet Menu",
        "type": "False-Positive Stress Test",
        "description": "Bakery cafe introduces flat ₹500 all-you-can-eat high tea combo, producing 85% round-amount transactions.",
        "expected_outcome": "Round amount signal fires, but absence of night spikes and presence of steady repeat locals keeps tier graduated at Tier 1/2 query level.",
        "synthetic_ground_truth": "Legitimate"
    },
    {
        "id": "ADV-03",
        "name": "High-Value Wedding Catering Order",
        "type": "False-Positive Stress Test",
        "description": "Bakery receives three large wedding cake split payments of ₹45,000 each during daytime.",
        "expected_outcome": "Ticket deviation fires; engine prompts for standard order invoice verification (Tier 2) rather than punitive freeze.",
        "synthetic_ground_truth": "Legitimate"
    },
    {
        "id": "ADV-04",
        "name": "Payment Gateway Retry & Network Glitch",
        "type": "False-Positive Stress Test",
        "description": "UPI bank switch timeout causes 30 customers to retry payments within 90 seconds.",
        "expected_outcome": "Cluster velocity filter distinguishes identical customer retries (same payer token) from coordinated multi-payer betting pools.",
        "synthetic_ground_truth": "Legitimate"
    },
    {
        "id": "ADV-05",
        "name": "Late-Night Midnight Dessert Kiosk",
        "type": "False-Positive Stress Test",
        "description": "Merchant declared operating hours 18:00 to 03:00. High midnight transactions are consistent with declared business profile.",
        "expected_outcome": "Offhours signal does NOT fire because transactions align with merchant's declared schedule.",
        "synthetic_ground_truth": "Legitimate"
    },
    {
        "id": "ADV-06",
        "name": "Attacker Mimicking Normal Bakery Ticket Sizes",
        "type": "Adversarial Evasion Test",
        "description": "Gambling syndicate splits stakes into irregular small retail sums (e.g. ₹185, ₹240, ₹310) to defeat round-amount filters.",
        "expected_outcome": "Engine catches the syndicate through orthogonal dimensions: late-night timing concentration, payer fan-in velocity, and rapid settlement outflow.",
        "synthetic_ground_truth": "Suspicious"
    },
    {
        "id": "ADV-07",
        "name": "Attacker Smurfing Stakes Across Multiple Accounts",
        "type": "Adversarial Evasion Test",
        "description": "Syndicate distributes betting deposits across 10 low-volume merchant accounts, keeping each merchant under ₹50,000 daily volume.",
        "expected_outcome": "Engine detects anomalous night-ratio and payer fan-in acceleration even at low overall absolute volume.",
        "synthetic_ground_truth": "Suspicious"
    },
    {
        "id": "ADV-08",
        "name": "Tourist Destination Seasonal Surge",
        "type": "False-Positive Stress Test",
        "description": "Bakery in Goa during peak December tourist season experiences 90% non-repeat, out-of-state payer tokens.",
        "expected_outcome": "Repeat-drop signal damped by regional tourist cohort baselines and calendar event tagging.",
        "synthetic_ground_truth": "Legitimate"
    },
]

def generate_synthetic_transactions(
    merchant_id: str,
    scenario_key: str,
    db: Session,
    start_time: datetime.datetime,
    duration_hours: int = 48,
    tx_count_override: Optional[int] = None
) -> List[Transaction]:
    """
    Generates realistic synthetic transactions according to scenario characteristics.
    """
    created_txs = []
    
    # Cache known payer tokens to avoid duplicate queries
    known_payer_tokens = set(r[0] for r in db.query(PayerToken.token_id).all())

    def ensure_payer(token: str):
        if token not in known_payer_tokens:
            db.add(PayerToken(token_id=token, total_tx_count=1))
            known_payer_tokens.add(token)

    # Pre-fetch or generate payer pool
    payer_pool = [f"payer_{merchant_id[:3].lower()}_{random.randint(1000, 9999)}" for _ in range(50)]
    for pt in payer_pool:
        ensure_payer(pt)
    db.commit()
    
    if scenario_key == "SCENARIO_1_NORMAL_BAKERY":
        count = tx_count_override or random.randint(70, 110)
        for i in range(count):
            offset_seconds = random.randint(0, duration_hours * 3600)
            tx_time = start_time + datetime.timedelta(seconds=offset_seconds)
            # Normal hours: 08:00 - 21:00
            hour = random.choice([8, 9, 10, 11, 12, 16, 17, 18, 19, 20])
            tx_time = tx_time.replace(hour=hour, minute=random.randint(0, 59), second=random.randint(0, 59))
            
            amount = round(random.choice([85.0, 120.0, 150.0, 180.0, 220.0, 260.0, 310.0, 450.0]) + random.choice([0, 5, 8]), 2)
            # 65% repeat customers
            payer = random.choice(payer_pool[:12]) if random.random() < 0.65 else f"payer_guest_{random.randint(1000, 9999)}"
            ensure_payer(payer)
            
            tx_id = f"TXN-{merchant_id[-4:]}-{int(tx_time.timestamp())}-{i}-{uuid.uuid4().hex[:4].upper()}"
            tx = Transaction(
                id=tx_id,
                merchant_id=merchant_id,
                timestamp=tx_time,
                amount=amount,
                currency="INR",
                status="Success",
                payment_method=random.choice(["UPI", "UPI", "UPI", "Card", "POS"]),
                payer_token=payer,
                channel="QR" if random.random() < 0.8 else "POS"
            )
            created_txs.append(tx)
            
    elif scenario_key == "SCENARIO_2_FESTIVE_BAKERY":
        count = tx_count_override or random.randint(180, 260)
        for i in range(count):
            offset_seconds = random.randint(0, duration_hours * 3600)
            tx_time = start_time + datetime.timedelta(seconds=offset_seconds)
            hour = random.choice([9, 10, 11, 13, 14, 15, 17, 18, 19, 20, 21])
            tx_time = tx_time.replace(hour=hour, minute=random.randint(0, 59), second=random.randint(0, 59))
            
            # Festive hamper pricing
            amount = round(random.choice([450.0, 750.0, 1200.0, 1500.0, 2100.0, 2500.0, 3200.0]), 2)
            payer = f"payer_festive_{random.randint(1000, 9999)}"
            ensure_payer(payer)
            
            tx_id = f"TXN-{merchant_id[-4:]}-{int(tx_time.timestamp())}-{i}-{uuid.uuid4().hex[:4].upper()}"
            tx = Transaction(
                id=tx_id,
                merchant_id=merchant_id,
                timestamp=tx_time,
                amount=amount,
                currency="INR",
                status="Success",
                payment_method=random.choice(["UPI", "Card", "NetBanking"]),
                payer_token=payer,
                channel="QR"
            )
            created_txs.append(tx)
            
    elif scenario_key == "SCENARIO_3_HYBRID_BETTING_FRONT":
        # "The Bakery That Takes Bets"
        count = tx_count_override or random.randint(220, 350)
        # 1. A few daytime normal bakery orders (cover transactions)
        for i in range(25):
            tx_time = start_time + datetime.timedelta(hours=random.randint(4, 18), minutes=random.randint(0, 59))
            tx_id = f"TXN-{merchant_id[-4:]}-{int(tx_time.timestamp())}-day-{i}"
            day_payer = random.choice(payer_pool[:5])
            ensure_payer(day_payer)
            created_txs.append(Transaction(
                id=tx_id,
                merchant_id=merchant_id,
                timestamp=tx_time,
                amount=round(random.uniform(90, 280), 2),
                currency="INR",
                status="Success",
                payment_method="UPI",
                payer_token=day_payer,
                channel="QR"
            ))
            
        # 2. Avalanche of illicit betting round deposits strictly during late night (23:00 - 03:30)
        night_payers = [f"payer_bet_{random.randint(10000, 99999)}" for _ in range(count - 25)]
        for i, np_token in enumerate(night_payers):
            # Target the two nights within the observation window
            # Night 1: ~14h into the window
            # Night 2: ~38h into the window
            offset_h = random.choice([14, 38])
            base_dt = start_time + datetime.timedelta(hours=offset_h)
            
            night_hour = random.choice([23, 0, 1, 2, 3])
            minute = random.choice([15, 16, 17, 30, 31, 45, 46, 50]) # clustered around match innings/overs
            second = random.randint(0, 59)
            
            tx_time = base_dt.replace(hour=night_hour, minute=minute, second=second)
            if tx_time < start_time:
                tx_time = start_time + datetime.timedelta(hours=random.randint(2, 6), minutes=minute, seconds=second)
            
            # Betting stakes: exact round sums
            stake_amount = float(random.choice([500, 1000, 1000, 2000, 2000, 5000]))
            
            # Register payer token
            ensure_payer(np_token)
                
            tx_id = f"TXN-BET-{merchant_id[-4:]}-{int(tx_time.timestamp())}-{i}-{uuid.uuid4().hex[:4].upper()}"
            created_txs.append(Transaction(
                id=tx_id,
                merchant_id=merchant_id,
                timestamp=tx_time,
                amount=stake_amount,
                currency="INR",
                status="Success",
                payment_method="UPI",
                payer_token=np_token,
                channel="QR",
                is_flagged=True,
                risk_reason="Late-night round denomination deposit aligned with suspected betting window"
            ))
            
        # Add rapid provider-visible payout/settlement request
        settle_id = f"SETTLE-{merchant_id[-4:]}-{int(start_time.timestamp())}-{uuid.uuid4().hex[:4].upper()}"
        settle_amount = sum(t.amount for t in created_txs) * 0.92
        db.add(SettlementEvent(
            id=settle_id,
            merchant_id=merchant_id,
            timestamp=start_time + datetime.timedelta(hours=28),
            amount=round(settle_amount, 2),
            status="Completed",
            payout_delay_hours=1.5,
            provider_visible_payout_ratio=0.92,
            notes="Automated on-demand payout request triggered immediately post night collection burst"
        ))
        
    elif scenario_key == "SCENARIO_4_SLEEPER_REACTIVATION":
        # Dormant reactivation
        count = tx_count_override or random.randint(45, 80)
        for i in range(count):
            tx_time = start_time + datetime.timedelta(hours=random.randint(10, 22), minutes=random.randint(0, 59))
            tx_id = f"TXN-DORM-{merchant_id[-4:]}-{int(tx_time.timestamp())}-{i}-{uuid.uuid4().hex[:4].upper()}"
            pt = f"payer_dorm_{random.randint(1000, 9999)}"
            ensure_payer(pt)
            created_txs.append(Transaction(
                id=tx_id,
                merchant_id=merchant_id,
                timestamp=tx_time,
                amount=round(random.choice([400, 500, 1000, 1500]), 2),
                currency="INR",
                status="Success",
                payment_method="UPI",
                payer_token=pt,
                channel="QR"
            ))
            
    else: # SCENARIO_5_ONLINE_PROXY or default
        count = tx_count_override or random.randint(60, 90)
        for i in range(count):
            tx_time = start_time + datetime.timedelta(hours=random.randint(8, 23), minutes=random.randint(0, 59))
            tx_id = f"TXN-ONL-{merchant_id[-4:]}-{int(tx_time.timestamp())}-{i}-{uuid.uuid4().hex[:4].upper()}"
            pt = f"payer_onl_{random.randint(1000, 9999)}"
            ensure_payer(pt)
            created_txs.append(Transaction(
                id=tx_id,
                merchant_id=merchant_id,
                timestamp=tx_time,
                amount=round(random.choice([199, 299, 499, 999]), 2),
                currency="INR",
                status="Success",
                payment_method=random.choice(["UPI", "Card"]),
                payer_token=pt,
                channel="Web Checkout"
            ))

    for tx in created_txs:
        db.add(tx)
    db.commit()
    
    return created_txs
