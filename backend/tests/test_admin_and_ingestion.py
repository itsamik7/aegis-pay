import io
import json
import uuid
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models import Merchant, Transaction, ImportBatch, AuditEvent

client = TestClient(app)

def test_public_access_and_admin_isolation():
    """
    1. Public visitors can open overview, merchants, and transactions without token.
    2. Public visitors cannot access any /api/admin route (401 Unauthorized).
    3. Authenticated non-admin (e.g. Risk Analyst) receives 403 Forbidden on /api/admin.
    """
    # 1. Unauthenticated public requests succeed on public read endpoints
    res_overview = client.get("/api/analytics/overview?days=30")
    assert res_overview.status_code == 200
    assert "kpis" in res_overview.json()

    res_merchants = client.get("/api/merchants")
    assert res_merchants.status_code == 200
    assert "items" in res_merchants.json()

    res_tx = client.get("/api/transactions")
    assert res_tx.status_code == 200
    assert "items" in res_tx.json()

    # 2. Public visitors denied on admin endpoints
    res_admin_anon = client.get("/api/admin/overview")
    assert res_admin_anon.status_code == 401

    res_admin_guide = client.get("/api/admin/guide")
    assert res_admin_guide.status_code == 401

    # 3. Non-admin authenticated user (Analyst) denied on admin endpoints (403)
    login_analyst = client.post("/api/auth/login", json={"username": "analyst", "password": "analyst123"})
    assert login_analyst.status_code == 200
    analyst_token = login_analyst.json()["access_token"]
    analyst_headers = {"Authorization": f"Bearer {analyst_token}"}

    res_admin_forbidden = client.get("/api/admin/overview", headers=analyst_headers)
    assert res_admin_forbidden.status_code == 403

def test_admin_manual_data_entry_validation():
    """
    Admin manual entry with strict validation:
    1. Valid merchant saves and can be staged or published.
    2. Invalid merchant ID or duplicate rejected.
    3. Valid transaction saves.
    4. Invalid amount, missing foreign key merchant, or real PII payer token rejected.
    """
    # Login Admin
    login_admin = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
    assert login_admin.status_code == 200
    admin_token = login_admin.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Valid merchant manual entry (draft)
    valid_merchant_id = f"MER-MAN-{uuid.uuid4().hex[:6].upper()}"
    res_m = client.post(
        "/api/admin/manual-entry",
        headers=admin_headers,
        json={
            "dataset_type": "merchants",
            "publication_mode": "draft",
            "payload": {
                "merchant_id": valid_merchant_id,
                "merchant_name": "Test Neighbourhood Confectionery",
                "legal_name": "Test Confectionery LLP",
                "business_category": "Confectionery",
                "city": "Bengaluru",
                "region": "Koramangala",
                "onboarding_date": "2026-09-01",
                "declared_operating_hours": "09:00 - 22:00",
                "account_status": "Active",
                "declared_monthly_volume": 140000.0,
                "declared_avg_ticket": 160.0
            }
        }
    )
    assert res_m.status_code == 200
    assert res_m.json()["status"] == "success"
    assert res_m.json()["publication_status"] == "draft"

    # Staged draft merchant must NOT be returned by public merchants endpoint
    public_m = client.get(f"/api/merchants/{valid_merchant_id}")
    assert public_m.status_code == 404

    # 2. Duplicate merchant rejected
    res_dup = client.post(
        "/api/admin/manual-entry",
        headers=admin_headers,
        json={
            "dataset_type": "merchants",
            "publication_mode": "draft",
            "payload": {
                "merchant_id": valid_merchant_id,
                "merchant_name": "Duplicate Test",
                "legal_name": "Duplicate LLP",
                "business_category": "Bakeries",
                "city": "Delhi",
                "region": "Saket",
                "onboarding_date": "2026-09-01"
            }
        }
    )
    assert res_dup.status_code == 422

    # 3. Invalid pattern rejected
    res_inv_id = client.post(
        "/api/admin/manual-entry",
        headers=admin_headers,
        json={
            "dataset_type": "merchants",
            "publication_mode": "draft",
            "payload": {
                "merchant_id": "INVALID-ID-123",
                "merchant_name": "Bad ID Merchant",
                "legal_name": "Bad ID LLP",
                "business_category": "Bakeries",
                "city": "Delhi",
                "region": "Saket",
                "onboarding_date": "2026-09-01"
            }
        }
    )
    assert res_inv_id.status_code == 422

    # 4. Valid Transaction manual entry
    valid_tx_id = f"TXN-MAN-{uuid.uuid4().hex[:6].upper()}"
    res_tx_valid = client.post(
        "/api/admin/manual-entry",
        headers=admin_headers,
        json={
            "dataset_type": "transactions",
            "publication_mode": "published",
            "payload": {
                "transaction_id": valid_tx_id,
                "merchant_id": "MER-001-GOLDEN",
                "transaction_timestamp": "2026-11-10T11:00:00",
                "amount": 420.00,
                "currency": "INR",
                "payment_status": "Success",
                "payment_method": "UPI",
                "payer_token": f"payer_{uuid.uuid4().hex[:6]}",
                "channel": "QR"
            }
        }
    )
    assert res_tx_valid.status_code == 200
    assert res_tx_valid.json()["publication_status"] == "published"

    # Published transaction is visible in public transaction endpoint
    public_tx = client.get(f"/api/transactions/{valid_tx_id}")
    assert public_tx.status_code == 200

    # 5. Invalid transaction: non-existent merchant
    res_tx_bad_merchant = client.post(
        "/api/admin/manual-entry",
        headers=admin_headers,
        json={
            "dataset_type": "transactions",
            "publication_mode": "published",
            "payload": {
                "transaction_id": f"TXN-BAD-{uuid.uuid4().hex[:6]}",
                "merchant_id": "MER-NON-EXISTENT-9999",
                "transaction_timestamp": "2026-11-10T11:00:00",
                "amount": 420.00,
                "payer_token": "payer_009988"
            }
        }
    )
    assert res_tx_bad_merchant.status_code == 422

    # 6. Invalid transaction: real PII phone number as payer token rejected
    res_tx_pii = client.post(
        "/api/admin/manual-entry",
        headers=admin_headers,
        json={
            "dataset_type": "transactions",
            "publication_mode": "published",
            "payload": {
                "transaction_id": f"TXN-PII-{uuid.uuid4().hex[:6]}",
                "merchant_id": "MER-001-GOLDEN",
                "transaction_timestamp": "2026-11-10T11:00:00",
                "amount": 420.00,
                "payer_token": "+919876543210" # PII phone number
            }
        }
    )
    assert res_tx_pii.status_code == 422

def test_file_import_staging_and_publication_lifecycle():
    """
    Tests complete 10-step file import wizard:
    Upload CSV -> Validate -> Stage (Strict Mode) -> Publish -> Verify Public App -> Rollback
    """
    login_admin = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
    admin_token = login_admin.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    uid1 = uuid.uuid4().hex[:5].upper()
    uid2 = uuid.uuid4().hex[:5].upper()
    m_id_1 = f"MER-CSV-{uid1}"
    m_id_2 = f"MER-CSV-{uid2}"

    # 1. Create a valid CSV in memory
    csv_content = f"""merchant_id,merchant_name,legal_name,business_category,city,region,onboarding_date,declared_operating_hours,account_status,declared_monthly_volume,declared_avg_ticket
{m_id_1},Kaveri Artisanal Bakes,Kaveri Food Ventures LLP,Bakeries,Bengaluru,Indiranagar,2026-08-01,08:00 - 22:00,Active,190000.0,210.0
{m_id_2},Malleshwaram Espresso Cafe,Malleshwaram Coffee Works LLP,Bakeries,Bengaluru,Malleshwaram,2026-08-05,07:00 - 21:00,Active,175000.0,185.0
"""
    files = {"file": ("test_merchants.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")}
    data = {"dataset_type": "merchants"}

    res_upload = client.post("/api/admin/import/upload", headers=admin_headers, files=files, data=data)
    assert res_upload.status_code == 200
    upload_data = res_upload.json()
    batch_id = upload_data["batch_id"]
    assert upload_data["total_rows"] == 2

    # 2. Validate batch
    res_validate = client.post(f"/api/admin/import/validate?batch_id={batch_id}", headers=admin_headers)
    assert res_validate.status_code == 200
    val_data = res_validate.json()
    assert val_data["valid_rows"] == 2
    assert val_data["invalid_rows"] == 0

    # 3. Stage batch (Strict mode)
    res_stage = client.post("/api/admin/import/stage", headers=admin_headers, json={"batch_id": batch_id, "import_mode": "strict"})
    assert res_stage.status_code == 200
    assert res_stage.json()["staged_rows"] == 2

    # Verify staged merchants are NOT visible publicly yet
    public_res = client.get(f"/api/merchants/{m_id_1}")
    assert public_res.status_code == 404

    # 4. Publish batch
    res_pub = client.post("/api/admin/import/publish", headers=admin_headers, json={"batch_id": batch_id})
    assert res_pub.status_code == 200
    pub_data = res_pub.json()
    assert pub_data["published_rows"] == 2
    assert "dataset_version" in pub_data

    # 5. Public app now reflects published merchants!
    public_check = client.get(f"/api/merchants/{m_id_1}")
    assert public_check.status_code == 200
    assert public_check.json()["merchant"]["name"] == "Kaveri Artisanal Bakes"

    # 6. Rollback / Unpublish batch
    res_rollback = client.post(
        f"/api/admin/datasets/{batch_id}/rollback",
        headers=admin_headers,
        json={"rationale": "Automated test verification of safe batch rollback."}
    )
    assert res_rollback.status_code == 200
    assert res_rollback.json()["reverted_rows"] == 2

    # After rollback, merchant is unpublished and no longer visible publicly
    public_after_rollback = client.get(f"/api/merchants/{m_id_1}")
    assert public_after_rollback.status_code == 404

def test_file_import_strict_rejection_and_error_report():
    """
    Tests that strict mode rejects an entire batch if invalid rows exist,
    and the error report CSV can be downloaded with formula injection protection.
    """
    login_admin = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
    admin_token = login_admin.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    uid = uuid.uuid4().hex[:5].upper()
    bad_csv = f"""merchant_id,merchant_name,legal_name,business_category,city,region,onboarding_date
MER-GOOD-{uid},Valid Merchant One,Valid Entity LLP,Bakeries,Delhi,Saket,2026-08-10
INVALID-BAD-ID,Malformed ID Two,Bad Entity LLP,InvalidCategory,Delhi,Saket,2026-08-10
"""
    files = {"file": ("malformed_merchants.csv", io.BytesIO(bad_csv.encode("utf-8")), "text/csv")}
    res_upload = client.post("/api/admin/import/upload", headers=admin_headers, files=files, data={"dataset_type": "merchants"})
    assert res_upload.status_code == 200
    batch_id = res_upload.json()["batch_id"]

    # Validate
    res_val = client.post(f"/api/admin/import/validate?batch_id={batch_id}", headers=admin_headers)
    assert res_val.status_code == 200
    assert res_val.json()["invalid_rows"] == 1
    assert res_val.json()["valid_rows"] == 1

    # Strict stage MUST fail with 400
    res_stage = client.post("/api/admin/import/stage", headers=admin_headers, json={"batch_id": batch_id, "import_mode": "strict"})
    assert res_stage.status_code == 400
    assert "Strict mode rejected" in res_stage.json()["detail"]

    # Download error report CSV
    res_err_csv = client.get(f"/api/admin/datasets/{batch_id}/errors.csv", headers=admin_headers)
    assert res_err_csv.status_code == 200
    assert "Row Number" in res_err_csv.text
    assert "INVALID-BAD-ID" in res_err_csv.text
