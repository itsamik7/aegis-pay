import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_full_end_to_end_investigation_and_simulation_cycle():
    """
    Comprehensive End-to-End Acceptance Test:
    1. Authenticate as Risk Analyst (Rohan Varma)
    2. Query Overview Dashboard KPIs & charts
    3. Query Merchant Directory & retrieve "The Bakery That Takes Bets" (Sunrise Artisanal Bakes)
    4. Verify live 5-dimensional risk score explanation
    5. Check active alerts for Sunrise Artisanal Bakes
    6. Open Investigation Case
    7. Post analyst note
    8. Issue formal Merchant Information Request (Form R-2)
    9. Switch authentication to Merchant (Vikram Malhotra)
    10. View inquiry in Merchant Demo Portal and submit written response with invoice attachment
    11. Switch back to Compliance Reviewer (Dr. Kavita Menon)
    12. Verify merchant response is visible in case
    13. Submit simulated containment approval recommendation
    14. Execute Simulation Lab scenario run
    15. Verify append-only audit trail logs every step
    """
    # 1. Login Analyst
    login_analyst = client.post("/api/auth/login", json={"username": "analyst", "password": "analyst123"})
    assert login_analyst.status_code == 200
    analyst_token = login_analyst.json()["access_token"]
    analyst_headers = {"Authorization": f"Bearer {analyst_token}"}
    
    # 2. Overview KPIs
    overview = client.get("/api/analytics/overview?days=30", headers=analyst_headers)
    assert overview.status_code == 200
    ov_data = overview.json()
    assert ov_data["kpis"]["total_monitored_merchants"] >= 10
    assert ov_data["kpis"]["merchants_elevated_risk"] >= 1
    assert len(ov_data["charts"]["tier_distribution"]) == 6
    
    # 3. Query Merchants
    merchants_res = client.get("/api/merchants?search=Sunrise", headers=analyst_headers)
    assert merchants_res.status_code == 200
    sunrise_summary = merchants_res.json()["items"][0]
    assert sunrise_summary["id"] == "MER-003-SUNRISE"
    assert sunrise_summary["current_risk_tier"] >= 4
    
    # 4. Fetch Sunrise Full Profile (14 sections)
    sunrise_profile = client.get(f"/api/merchants/{sunrise_summary['id']}", headers=analyst_headers)
    assert sunrise_profile.status_code == 200
    prof = sunrise_profile.json()
    assert "live_risk_evaluation" in prof
    assert "baseline" in prof
    assert "cohort" in prof
    assert "behaviour_charts" in prof
    assert len(prof["live_risk_evaluation"]["signals"]) >= 10
    
    # 5. Check Alerts
    alerts_res = client.get("/api/alerts?merchant_id=MER-003-SUNRISE", headers=analyst_headers)
    assert alerts_res.status_code == 200
    alerts = alerts_res.json()["items"]
    assert len(alerts) >= 1
    target_alert = alerts[0]
    
    # 6. Create Case
    new_case = client.post(
        "/api/cases",
        headers=analyst_headers,
        json={
            "title": "E2E Investigation: Sunrise Artisanal Bakes Betting Pool Review",
            "merchant_id": "MER-003-SUNRISE",
            "alert_ids": [target_alert["id"]],
            "priority": "Critical",
            "initial_note": "Initiating high-priority E2E triage."
        }
    )
    assert new_case.status_code == 200
    case_id = new_case.json()["case_id"]
    
    # 7. Add Note
    note_res = client.post(
        f"/api/cases/{case_id}/notes",
        headers=analyst_headers,
        json={
            "note_type": "Investigation Note",
            "content": "Observed round stakes and night avalanche. Requesting event sales invoice."
        }
    )
    assert note_res.status_code == 200
    
    # 8. Issue Merchant Clarification Request
    req_res = client.post(
        "/api/merchant-requests",
        headers=analyst_headers,
        json={
            "case_id": case_id,
            "merchant_id": "MER-003-SUNRISE",
            "request_type": "unusual_timing",
            "subject": "Explanation Required: Midnight Order Avalanche",
            "message": "Please provide proof of business activity between 23:00 and 03:00.",
            "due_days": 2
        }
    )
    assert req_res.status_code == 200
    req_id = req_res.json()["request_id"]
    
    # 9. Login Merchant
    login_merchant = client.post("/api/auth/login", json={"username": "merchant", "password": "merchant123"})
    assert login_merchant.status_code == 200
    merchant_token = login_merchant.json()["access_token"]
    merchant_headers = {"Authorization": f"Bearer {merchant_token}"}
    
    # 10. Merchant responds
    resp_res = client.post(
        f"/api/merchant-requests/{req_id}/respond",
        headers=merchant_headers,
        json={
            "response_text": "We operated an overnight pop-up counter at a 48h gaming hackathon.",
            "attachment_filenames": ["hackathon_event_contract_2024.pdf"]
        }
    )
    assert resp_res.status_code == 200
    
    # 11. Login Compliance Reviewer
    login_reviewer = client.post("/api/auth/login", json={"username": "reviewer", "password": "reviewer123"})
    assert login_reviewer.status_code == 200
    reviewer_token = login_reviewer.json()["access_token"]
    reviewer_headers = {"Authorization": f"Bearer {reviewer_token}"}
    
    # 12. Review case
    case_inspect = client.get(f"/api/cases/{case_id}", headers=reviewer_headers)
    assert case_inspect.status_code == 200
    
    # 13. Propose and approve recommendation
    rec_res = client.post(
        f"/api/cases/{case_id}/recommendation",
        headers=analyst_headers,
        json={
            "recommendation": "Simulated Recommendation: Implement rolling reserve and on-site physical inspection.",
            "rationale": "High volume divergence and uncorroborated third-party claim."
        }
    )
    assert rec_res.status_code == 200
    
    dec_res = client.post(
        f"/api/cases/{case_id}/review-decision",
        headers=reviewer_headers,
        json={
            "decision": "Approved",
            "rationale": "Senior Compliance concurs with simulated containment policy recommendation."
        }
    )
    assert dec_res.status_code == 200
    
    # 14. Execute Simulation Lab Run
    sim_res = client.post(
        "/api/simulation/run",
        headers=analyst_headers,
        json={
            "scenario_key": "SCENARIO_3_HYBRID_BETTING_FRONT",
            "target_merchant_id": "MER-003-SUNRISE",
            "transaction_count": 80,
            "observation_hours": 48
        }
    )
    assert sim_res.status_code == 200
    sim_data = sim_res.json()
    assert sim_data["after"]["tier"] >= 4
    
    # 15. Verify Audit Trail
    audit_res = client.get("/api/audit?page=1&page_size=20", headers=analyst_headers)
    assert audit_res.status_code == 200
    audit_events = audit_res.json()["items"]
    assert len(audit_events) >= 5
    actions = [a["action"] for a in audit_events]
    assert "CASE_CREATE" in actions
    assert "MERCHANT_REQUEST_SUBMIT" in actions
    assert "MERCHANT_RESPONSE_SUBMIT" in actions
