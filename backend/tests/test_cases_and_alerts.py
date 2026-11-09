import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_alert_lifecycle_and_mandatory_rationale():
    analyst_tok = client.post("/api/auth/login", json={"username": "analyst", "password": "analyst123"}).json()["access_token"]
    headers = {"Authorization": f"Bearer {analyst_tok}"}
    
    # Fetch alerts
    res = client.get("/api/alerts", headers=headers)
    assert res.status_code == 200
    alerts = res.json()["items"]
    assert len(alerts) > 0
    target_alert_id = alerts[0]["id"]
    
    # Attempt to clear alert WITHOUT rationale -> Must fail with 400
    bad_clear = client.patch(f"/api/alerts/{target_alert_id}", headers=headers, json={"status": "Cleared"})
    assert bad_clear.status_code == 400
    
    # Clear alert with mandatory rationale -> Must succeed
    good_clear = client.patch(
        f"/api/alerts/{target_alert_id}",
        headers=headers,
        json={"status": "Cleared", "cleared_reason": "Verified legitimate seasonal bulk purchase order."}
    )
    assert good_clear.status_code == 200

def test_case_creation_and_notes():
    analyst_tok = client.post("/api/auth/login", json={"username": "analyst", "password": "analyst123"}).json()["access_token"]
    headers = {"Authorization": f"Bearer {analyst_tok}"}
    
    # Create case
    res = client.post(
        "/api/cases",
        headers=headers,
        json={
            "title": "Automated Test Case: Bakery Off-Hours Monitoring",
            "merchant_id": "MER-001-GOLDEN",
            "alert_ids": [],
            "priority": "Medium",
            "initial_note": "Initiating exploratory review."
        }
    )
    assert res.status_code == 200
    case_id = res.json()["case_id"]
    
    # Add note
    note_res = client.post(
        f"/api/cases/{case_id}/notes",
        headers=headers,
        json={"note_type": "Investigation Note", "content": "Examined transaction distribution; all parameters normal."}
    )
    assert note_res.status_code == 200
    
    # Fetch case detail
    case_detail = client.get(f"/api/cases/{case_id}", headers=headers).json()
    assert case_detail["case"]["id"] == case_id
    assert len(case_detail["notes"]) >= 2
    
    # Close case requires reason
    bad_close = client.patch(f"/api/cases/{case_id}/close", headers=headers, json={"status": "Closed — Cleared", "reason": ""})
    assert bad_close.status_code == 400
    
    good_close = client.patch(
        f"/api/cases/{case_id}/close",
        headers=headers,
        json={"status": "Closed — Cleared", "reason": "No anomalies detected during audit."}
    )
    assert good_close.status_code == 200

def test_merchant_information_request_and_response_flow():
    analyst_tok = client.post("/api/auth/login", json={"username": "analyst", "password": "analyst123"}).json()["access_token"]
    headers = {"Authorization": f"Bearer {analyst_tok}"}
    
    # Analyst creates request
    req_res = client.post(
        "/api/merchant-requests",
        headers=headers,
        json={
            "case_id": "CASE-2024-001",
            "merchant_id": "MER-003-SUNRISE",
            "request_type": "business_clarification",
            "subject": "Inquiry on Recent Transaction Spikes",
            "message": "Please clarify recent night activity.",
            "due_days": 2
        }
    )
    assert req_res.status_code == 200
    req_id = req_res.json()["request_id"]
    
    # Merchant submits response via demo portal
    merchant_tok = client.post("/api/auth/login", json={"username": "merchant", "password": "merchant123"}).json()["access_token"]
    merchant_headers = {"Authorization": f"Bearer {merchant_tok}"}
    
    resp_res = client.post(
        f"/api/merchant-requests/{req_id}/respond",
        headers=merchant_headers,
        json={
            "response_text": "We hosted an exclusive midnight tasting pop-up.",
            "attachment_filenames": ["event_flyer.pdf"]
        }
    )
    assert resp_res.status_code == 200
