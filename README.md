# AEGIS-PAY — Merchant Behaviour Intelligence & Risk Platform
### Adaptive, Explainable, Graduated Intervention System for Payments
**Case Study Prototype:** *“Follow the Money: The Bakery That Takes Bets.”*

> **Disclaimer:** Independent Case Study Prototype — Synthetic Data Only. Not an official PayU application and not connected to live payment switches or external banking balances.

---

## 1. Executive Summary

A merchant is onboarded with genuine KYC documents as a legitimate neighbourhood bakery. Weeks later, the payment account is co-opted to collect round deposits for an illicit cricket-betting syndicate. Static onboarding checks miss this pivot because the original business profile was authentic.

**AEGIS-PAY** monitors how a merchant's payment behaviour evolves over time across **5 orthogonal behavioural dimensions**, comparing activity against the merchant's rolling baseline, peer cohorts, and holiday calendar context.

When anomalies occur, the platform provides **deterministic, explainable signals** and facilitates **graduated, human-governed workflows** (targeted queries, invoice verification, and senior reviewer containment recommendations) rather than crude automatic de-platforming.

---

## 2. Core Architecture & Behavioural Dimensions

```
                      ┌──────────────────────────────────────┐
                      │    1. OBSERVE (Payment Rails)        │
                      │  Raw timestamps, amounts, channels,  │
                      │  pseudonymous payer tokens           │
                      └──────────────────┬───────────────────┘
                                         ▼
                      ┌──────────────────────────────────────┐
                      │    2. BASELINE & CONTEXT             │
                      │  Merchant 30d baseline, category/city│
                      │  cohort benchmarks & festive calendar│
                      └──────────────────┬───────────────────┘
                                         ▼
                      ┌──────────────────────────────────────┐
                      │    3. DETERMINISTIC SCORING          │
                      │  10 signals across 5 dimensions      │
                      │  Correlation damper, 0-1000 scale    │
                      └──────────────────┬───────────────────┘
                                         ▼
                      ┌──────────────────────────────────────┐
                      │    4. GRADUATED INTERVENTION         │
                      │  Tiers 0–5, human triage queue,      │
                      │  inquiry requests & audit trail      │
                      └──────────────────────────────────────┘
```

### The 5 Behavioural Dimensions

| Dimension | Core Signal | Provenance | Analyst Explanation |
|---|---|---|---|
| **A. WHEN (Timing)** | `SIG_TIMING_OFFHOURS`<br>`SIG_TIMING_NIGHT_SPIKE` | Directly Observed / Derived | Payments concentrated between 23:30–03:30 outside declared daytime bakery hours. |
| **B. HOW MUCH (Amounts)** | `SIG_AMOUNT_ROUND_RATIO`<br>`SIG_AMOUNT_TICKET_DEVIATION` | Directly Observed / Derived | Disproportionate clustering of exact round sums (₹500, ₹1000, ₹2000) rather than fractional retail tickets. |
| **C. WHO (Payers)** | `SIG_PAYER_FANIN_VELOCITY`<br>`SIG_PAYER_REPEAT_DROP`<br>`SIG_PAYER_CLUSTER_VELOCITY` | Directly Observed (Pseudonymous Token) | Sudden influx of 400+ first-time payer tokens in tight synchronized time windows; regular customer share collapses from 65% to 5%. *(WHO correlation damper applied to prevent artificial multi-counting)*. |
| **D. HOW FAST (Settlement)** | `SIG_FLOW_SETTLEMENT_VELOCITY` | Derived (Provider-Visible Only) | Immediate on-demand payout sweeps requested within < 2 hours of collection bursts. |
| **E. CAPACITY (Plausibility)** | `SIG_CAPACITY_PEER_DIVERGENCE`<br>`SIG_CAPACITY_BASELINE_SURGE` | Derived | Collection volume exceeds peer bakery cohort 95th percentile by > 8x; baseline volume surge dampens automatically if calendar holiday is annotated. |

---

## 3. The 6-Tier Graduated Intervention Model

The platform strictly implements six tiers numbered **0 to 5** with exact quantitative boundaries:

| Tier | Score Range | Operational Label | Demo Response & Policy |
|---|---:|---|---|
| **0** | 0–250 | Standard | Standard next-day settlement; normal automated monitoring. |
| **1** | 251–500 | Passive Monitoring | Continue monitoring; record velocity and trend. |
| **2** | 501–700 | Targeted Merchant Query | Request clarification and supporting order records via Merchant Portal. |
| **3** | 701–850 | Enhanced Review | Stronger verification; recommend policy review of incremental exposure. |
| **4** | 851–950 | Senior Review / Containment Recommendation | Escalate for senior human review; simulated containment recommendation only. |
| **5** | 951–1000 | Compliance Decision Required | Mandatory senior/compliance review; no automatic finding or real offboarding. |

> **Critical Policy:** A quantitative score alone **never terminates an account**. Tiers 4 and 5 require human reviewer authorization. Simulated containment recommendations require authorized compliance counsel determination.

---

## 4. Technology Stack

- **Backend:** Python 3.14 + FastAPI + SQLAlchemy ORM
- **Database:** SQLite with WAL Mode and foreign keys strictly enforced (`PRAGMA foreign_keys=ON;`)
- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS + Recharts + Lucide Icons
- **Design System:** PayU India-inspired fintech aesthetic (deep purple/violet accents `#7C3AED`, deep navy typography `#0F172A`, slate surfaces `#F8FAFC`, responsive desktop/tablet/mobile layouts)
- **Testing:** Pytest (15 automated tests covering RBAC, exact tier boundaries, determinism, E2E investigation workflow, and synthetic evaluation metrics)

---

## 5. Demo Accounts & Role-Based Access Control

The app provides a **1-click Role Switcher** in the top navigation bar. You can also log in directly using these safe local credentials:

| Role | Username | Password | Full Name | Capabilities |
|---|---|---|---|---|
| **Admin** | `admin` | `admin123` | Ananya Sharma | View all pages, calibrate signal weights & thresholds, manage configuration versions, run simulations, reset demo database. |
| **Risk Analyst** | `analyst` | `analyst123` | Rohan Varma | Triage alerts, create cases, record investigation notes, dispatch merchant clarification requests, propose recommendations. |
| **Compliance Reviewer** | `reviewer` | `reviewer123` | Dr. Kavita Menon | Senior review workspace, approve/reject simulated containment recommendations, review audit logs. |
| **Read-only Viewer** | `viewer` | `viewer123` | Aditya Roy | Read-only inspection of dashboards, merchants, transactions, and reports; mutation actions blocked with HTTP 403 Forbidden. |
| **Merchant Admin** | `merchant` | `merchant123` | Vikram Malhotra | Accesses the **Merchant Demo Portal** to view clarification inquiries sent by PayU analysts and submit written explanations and invoices. |

---

## 6. Setup and Running Instructions

### Prerequisites
- Node.js (v18+) and npm
- Python (v3.10+)

### 1. Clone & Enter Repository
```bash
git clone <repo-url> aegis-pay
cd aegis-pay
```

### 2. Configure Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Run database seed (creates demo users, 10 merchants, 1,200+ transactions, alerts, cases)
python -m app.seed
```

### 3. Run Backend Automated Tests
```bash
PYTHONPATH=. ./venv/bin/pytest -v
```
*(All 15 automated tests will execute and pass)*.

### 4. Start Backend Server
```bash
PYTHONPATH=. ./venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
*Backend runs at `http://127.0.0.1:8000` (API documentation at `http://127.0.0.1:8000/docs`).*

### 5. Start Frontend
In a second terminal window:
```bash
cd frontend
npm install
npm run build    # Verifies production bundle builds cleanly
npm run dev      # Starts Vite local dev server
```
*Frontend opens at `http://localhost:5173` with instant proxying to `http://127.0.0.1:8000/api`.*

---

## 7. Interactive Pages & Workflows

1. **Overview Dashboard (`/`):** Real-time KPIs computed from database records, transaction inflow trend charts, tier distribution pie chart, and recent triage actions.
2. **Merchant Monitoring (`/merchants`):** Search, sort, and filter merchants by risk tier, category, or city. Click any merchant to open the **14-section merchant profile drawer** with explicit data provenance labels.
3. **Alerts & Risk Queue (`/alerts`):** Triage queue supporting status transitions (`New` &rarr; `Assigned` &rarr; `Under Review` &rarr; `Cleared` &rarr; `Escalated`). Clearing an alert requires a mandatory justification rationale.
4. **Investigation Cases (`/cases`):** Multi-analyst case workspace with assembled evidence timeline, case notes, merchant clarification inquiries, and senior reviewer approval workflows.
5. **Transaction Explorer (`/transactions`):** Live payment query tool with pseudonymous payer tokens, anomaly flags, and signal attribution drawer.
6. **Risk Intelligence (`/risk-intel`):** Complete formula definitions, weights, and known false-positive scenarios for all 10 signals across the 5 dimensions.
7. **Simulation Lab (`/simulation`):**
   - **5 Synthetic Scenarios:** Inject normal, festive, hybrid betting, sleeper reactivation, and online proxy patterns.
   - **12 Adversarial Stress Tests:** Evaluates viral marketing, fixed-price menus, caterers, retry glitches, and sub-₹300 smurfing.
   - **Evaluation Workbench:** Confusion matrix, precision, recall, F1-score, and signal ablation comparison.
   - **Bayes Prevalence Calculator:** Interactive simulator demonstrating why sparse-crime environments demand human review over automated de-platforming.
8. **Rules & Policy (`/rules`):** Admin-only calibrator to adjust signal weights (0–250 pts), thresholds, deploy versioned policies, and rollback prior configurations.
9. **Reports (`/reports`):** Export filtered merchant, alert, and case datasets to CSV.
10. **Audit Trail (`/audit`):** Append-only log of every triage action, recommendation, policy revision, and inquiry dispatch.
11. **Settings & Compliance (`/compliance`):** Demo credential quick-switch table, system health, and statutory boundary documentation.
12. **Merchant Demo Portal (`/merchant-portal`):** Dedicated portal allowing merchant Vikram Malhotra to respond to inquiries and upload mock invoices.

---

## 8. Acceptance Test Checklist

- [x] New `aegis-pay` repository created cleanly.
- [x] Backend FastAPI with SQLite WAL mode and enforced foreign keys.
- [x] Database migrations and synthetic seed script with 1,200+ realistic transactions.
- [x] Safe local demo accounts documented for all roles (Admin, Analyst, Reviewer, Viewer, Merchant).
- [x] Role-Based Access Control enforced on backend (403 Forbidden on unauthorized mutations).
- [x] All 11 navigation pages fully functional with no dead buttons or mock placeholders.
- [x] Exact 6-tier quantitative risk model (0–5) tested at boundaries: 250/251, 500/501, 700/701, 850/851, 950/951.
- [x] 5 behavioural dimensions implemented and reproducible.
- [x] Correlated WHO payer signals damped to prevent multi-counting.
- [x] Calendar holiday context dampening active to protect legitimate festive merchants.
- [x] Merchant Information Request and Merchant Response demo workflow fully connected.
- [x] Senior reviewer recommendation approval workflow audited.
- [x] Mandatory justification rationale enforced for clearing alerts and closing cases.
- [x] Simulation Lab with 5 scenarios and 12 adversarial test cases.
- [x] Synthetic evaluation workbench with confusion matrix, precision/recall, and signal ablation.
- [x] Bayes rare-event prevalence calculator with adjustable sliders.
- [x] Data provenance badges (`Directly Observed`, `Derived`, `Merchant-declared`) on every profile and evidence item.
- [x] PayU-inspired visual design system, responsive across desktop, tablet, and mobile.
- [x] 100% test pass rate across 15 automated pytest test cases.

---

## 9. Statutory Limitations & Regulatory Notice

This application is an independent case study prototype for educational and evaluative purposes. It does not initiate real payouts, account freezes, settlement holds, or Suspicious Transaction Reports (STRs). All metrics regarding payout speed reflect provider-visible flow requests and make no claim of visibility into external bank balances. Production AML/CFT deployment requires legal compliance review under applicable RBI Master Directions, PMLA regulations, and the DPDP Act 2023.
