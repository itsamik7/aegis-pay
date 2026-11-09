import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_simulation_scenarios_and_execution():
    admin_tok = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"}).json()["access_token"]
    headers = {"Authorization": f"Bearer {admin_tok}"}
    
    # 1. Fetch scenarios
    scenarios_res = client.get("/api/simulation/scenarios", headers=headers)
    assert scenarios_res.status_code == 200
    scenarios = scenarios_res.json()
    assert len(scenarios) == 5
    
    # 2. Run Scenario 3 (The Bakery That Takes Bets)
    run_res = client.post(
        "/api/simulation/run",
        headers=headers,
        json={
            "scenario_key": "SCENARIO_3_HYBRID_BETTING_FRONT",
            "target_merchant_id": "MER-003-SUNRISE",
            "transaction_count": 80,
            "observation_hours": 48
        }
    )
    assert run_res.status_code == 200
    run_data = run_res.json()
    assert run_data["status"] == "success"
    assert run_data["after"]["tier"] >= 4 # Should elevate
    assert len(run_data["after"]["signals"]) >= 10

def test_synthetic_evaluation_metrics():
    analyst_tok = client.post("/api/auth/login", json={"username": "analyst", "password": "analyst123"}).json()["access_token"]
    headers = {"Authorization": f"Bearer {analyst_tok}"}
    
    eval_res = client.get("/api/simulation/evaluate", headers=headers)
    assert eval_res.status_code == 200
    eval_data = eval_res.json()
    assert eval_data["disclaimer"] == "Synthetic simulation results — not validated real-world performance."
    assert "confusion_matrix" in eval_data
    assert "performance_rates" in eval_data
    assert "ablation_comparison" in eval_data
    assert eval_data["confusion_matrix"]["true_positives"] >= 1

def test_prevalence_calculator():
    analyst_tok = client.post("/api/auth/login", json={"username": "analyst", "password": "analyst123"}).json()["access_token"]
    headers = {"Authorization": f"Bearer {analyst_tok}"}
    
    res = client.post(
        "/api/simulation/prevalence",
        headers=headers,
        json={
            "total_merchants": 100000,
            "prevalence_rate": 0.002,
            "sensitivity": 0.85,
            "false_positive_rate": 0.02
        }
    )
    assert res.status_code == 200
    data = res.json()
    assert data["outcomes"]["actual_suspicious_merchants"] == 200
    assert data["outcomes"]["true_positives"] == 170
    assert data["outcomes"]["false_positives"] == 1996
    assert "precision_ppv" in data["outcomes"]
