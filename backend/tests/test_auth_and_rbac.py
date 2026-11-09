import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.auth import hash_password, verify_password

client = TestClient(app)

def test_password_hashing():
    pwd = "securepassword123"
    hashed = hash_password(pwd)
    assert hashed != pwd
    assert verify_password(pwd, hashed) is True
    assert verify_password("wrongpassword", hashed) is False

def test_login_flow():
    # Valid login
    res = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["user"]["role"] == "Admin"
    
    # Invalid password
    res_bad = client.post("/api/auth/login", json={"username": "admin", "password": "wrong"})
    assert res_bad.status_code == 401

def test_rbac_admin_vs_analyst_vs_readonly():
    # Login as Admin
    admin_tok = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"}).json()["access_token"]
    # Login as Analyst
    analyst_tok = client.post("/api/auth/login", json={"username": "analyst", "password": "analyst123"}).json()["access_token"]
    # Login as Read-only Viewer
    viewer_tok = client.post("/api/auth/login", json={"username": "viewer", "password": "viewer123"}).json()["access_token"]
    
    # 1. Admin can access policy config update
    cfg_res = client.get("/api/risk/config", headers={"Authorization": f"Bearer {admin_tok}"})
    assert cfg_res.status_code == 200
    
    # 2. Analyst CANNOT update policy configuration (Admin only)
    analyst_put = client.put(
        "/api/risk/config",
        headers={"Authorization": f"Bearer {analyst_tok}"},
        json={
            "version": "v1.99.0",
            "weights": {"SIG_TIMING_OFFHOURS": 90.0},
            "thresholds": {"SIG_TIMING_OFFHOURS": 0.25},
            "change_rationale": "Analyst attempting unauthorized policy change."
        }
    )
    assert analyst_put.status_code == 403 # Forbidden!
    
    # 3. Read-only Viewer cannot mutate data (e.g. cannot update alerts)
    viewer_patch = client.patch(
        "/api/alerts/ALT-2024-001",
        headers={"Authorization": f"Bearer {viewer_tok}"},
        json={"status": "Under Review"}
    )
    assert viewer_patch.status_code == 403 # Read-only blocked!
