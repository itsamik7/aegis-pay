import datetime
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey, Index
)
from sqlalchemy.orm import relationship
from .database import Base

def utc_now():
    return datetime.datetime.now(datetime.timezone.utc)

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, index=True, nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default="Risk Analyst") # Admin, Risk Analyst, Compliance Reviewer, Read-only Viewer, Merchant
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)

class MerchantCohort(Base):
    __tablename__ = "merchant_cohorts"

    id = Column(String(50), primary_key=True) # e.g. COH-BAKERY-MUMBAI
    name = Column(String(255), nullable=False)
    category = Column(String(100), nullable=False)
    region = Column(String(100), nullable=False)
    avg_ticket = Column(Float, default=180.0)
    std_ticket = Column(Float, default=50.0)
    avg_daily_tx_count = Column(Float, default=65.0)
    avg_night_ratio = Column(Float, default=0.03) # 3% night tx typically
    p95_daily_volume = Column(Float, default=25000.0)
    active_merchants_count = Column(Integer, default=45)
    description = Column(Text, nullable=True)

class Merchant(Base):
    __tablename__ = "merchants"

    id = Column(String(50), primary_key=True) # e.g. MER-001
    name = Column(String(255), nullable=False, index=True)
    legal_name = Column(String(255), nullable=False)
    business_category = Column(String(100), nullable=False, index=True)
    subcategory = Column(String(100), nullable=True)
    city = Column(String(100), nullable=False, index=True)
    region = Column(String(100), nullable=False)
    cohort_id = Column(String(50), ForeignKey("merchant_cohorts.id"), nullable=True)
    onboarding_date = Column(DateTime, nullable=False)
    account_status = Column(String(50), default="Active", nullable=False) # Active, Under Review, Escalated, Closed
    declared_monthly_volume = Column(Float, default=150000.0)
    declared_avg_ticket = Column(Float, default=180.0)
    declared_operating_hours = Column(String(100), default="08:00 - 22:00")
    
    current_risk_score = Column(Integer, default=120, nullable=False) # 0 - 1000
    current_risk_tier = Column(Integer, default=0, nullable=False) # 0 - 5
    assigned_analyst_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    assigned_analyst_name = Column(String(255), nullable=True)
    
    last_scored_at = Column(DateTime, default=utc_now)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    # Ingestion & publication lifecycle
    publication_status = Column(String(50), default="published", nullable=False, index=True) # draft, published, unpublished
    data_source = Column(String(50), default="seed_demo", nullable=False) # manual, file_import, seed_demo
    import_batch_id = Column(String(50), nullable=True, index=True)
    created_by = Column(String(100), nullable=True, default="Admin")
    published_by = Column(String(100), nullable=True, default="Admin")
    published_at = Column(DateTime, default=utc_now)

    profile = relationship("MerchantProfile", back_populates="merchant", uselist=False, cascade="all, delete-orphan")
    cohort = relationship("MerchantCohort")
    transactions = relationship("Transaction", back_populates="merchant", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="merchant", cascade="all, delete-orphan")
    cases = relationship("Case", back_populates="merchant", cascade="all, delete-orphan")

class MerchantProfile(Base):
    __tablename__ = "merchant_profiles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    merchant_id = Column(String(50), ForeignKey("merchants.id", ondelete="CASCADE"), unique=True, nullable=False)
    pan_masked = Column(String(50), default="ABCDE****F")
    gst_number_masked = Column(String(50), default="27ABCDE****1Z5")
    registered_address = Column(String(255), default="Shop 4, Linking Road, Bandra West, Mumbai")
    physical_storefront = Column(Boolean, default=True)
    website_url = Column(String(255), nullable=True)
    mcc_code = Column(String(10), default="5462") # Bakeries
    settlement_bank_name = Column(String(100), default="HDFC Bank Ltd")
    settlement_account_masked = Column(String(50), default="50100******4821")
    corroboration_status = Column(String(50), default="Verified at Onboarding")
    notes = Column(Text, nullable=True)

    merchant = relationship("Merchant", back_populates="profile")

class PayerToken(Base):
    __tablename__ = "payer_tokens"

    token_id = Column(String(100), primary_key=True) # pseudonymous synthetic token e.g. payer_004128
    first_seen_at = Column(DateTime, default=utc_now)
    last_seen_at = Column(DateTime, default=utc_now)
    total_tx_count = Column(Integer, default=1)
    merchants_transacted_count = Column(Integer, default=1)

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(String(50), primary_key=True) # e.g. TXN-100234
    merchant_id = Column(String(50), ForeignKey("merchants.id", ondelete="CASCADE"), nullable=False, index=True)
    timestamp = Column(DateTime, nullable=False, index=True)
    amount = Column(Float, nullable=False)
    currency = Column(String(10), default="INR")
    status = Column(String(50), default="Success", nullable=False) # Success, Failed, Refunded
    payment_method = Column(String(50), default="UPI", nullable=False) # UPI, Card, NetBanking, Wallet
    payer_token = Column(String(100), ForeignKey("payer_tokens.token_id"), nullable=False, index=True)
    channel = Column(String(50), default="QR", nullable=False) # QR, Web Checkout, POS
    settlement_ref = Column(String(100), nullable=True)
    is_flagged = Column(Boolean, default=False)
    risk_signal_ids = Column(Text, nullable=True) # JSON array or comma separated
    risk_reason = Column(Text, nullable=True)

    # Ingestion & publication lifecycle
    publication_status = Column(String(50), default="published", nullable=False, index=True) # draft, published, unpublished
    data_source = Column(String(50), default="seed_demo", nullable=False) # manual, file_import, seed_demo
    import_batch_id = Column(String(50), nullable=True, index=True)
    created_by = Column(String(100), nullable=True, default="Admin")
    published_by = Column(String(100), nullable=True, default="Admin")
    published_at = Column(DateTime, default=utc_now)

    merchant = relationship("Merchant", back_populates="transactions")
    payer = relationship("PayerToken")

class SettlementEvent(Base):
    __tablename__ = "settlement_events"

    id = Column(String(50), primary_key=True)
    merchant_id = Column(String(50), ForeignKey("merchants.id", ondelete="CASCADE"), nullable=False, index=True)
    timestamp = Column(DateTime, nullable=False)
    amount = Column(Float, nullable=False)
    status = Column(String(50), default="Completed")
    payout_delay_hours = Column(Float, default=24.0)
    provider_visible_payout_ratio = Column(Float, default=1.0) # ratio of collection quickly requested out
    notes = Column(String(255), nullable=True)

    # Ingestion & publication lifecycle
    publication_status = Column(String(50), default="published", nullable=False)
    data_source = Column(String(50), default="seed_demo", nullable=False)
    import_batch_id = Column(String(50), nullable=True)
    created_by = Column(String(100), nullable=True, default="Admin")
    published_by = Column(String(100), nullable=True, default="Admin")
    published_at = Column(DateTime, default=utc_now)

class RiskSignal(Base):
    __tablename__ = "risk_signals"

    id = Column(String(50), primary_key=True) # e.g. SIG_TIMING_OFFHOURS
    name = Column(String(255), nullable=False)
    dimension = Column(String(50), nullable=False) # WHEN, HOW MUCH, WHO, HOW FAST, CAPACITY
    formula_description = Column(Text, nullable=False)
    weight = Column(Float, default=100.0)
    threshold = Column(Float, default=0.5)
    severity = Column(String(50), default="Medium")
    confidence_label = Column(String(50), default="Directly Observed") # Directly Observed, Derived, Corroborated, Inferred
    analyst_explanation = Column(Text, nullable=False)
    false_positive_notes = Column(Text, nullable=False)
    is_active = Column(Boolean, default=True)

class RiskConfiguration(Base):
    __tablename__ = "risk_configurations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    version = Column(String(50), unique=True, nullable=False) # e.g. v1.0.0
    is_active = Column(Boolean, default=True)
    weights_json = Column(Text, nullable=False) # JSON
    thresholds_json = Column(Text, nullable=False) # JSON
    tier_boundaries_json = Column(Text, nullable=False) # JSON
    created_by = Column(String(100), default="Admin")
    created_at = Column(DateTime, default=utc_now)
    notes = Column(Text, nullable=True)

class RiskConfigurationVersion(Base):
    __tablename__ = "risk_configuration_versions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    version = Column(String(50), nullable=False)
    weights_json = Column(Text, nullable=False)
    thresholds_json = Column(Text, nullable=False)
    tier_boundaries_json = Column(Text, nullable=False)
    change_rationale = Column(Text, nullable=False)
    created_by = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=utc_now)

class RiskScoreSnapshot(Base):
    __tablename__ = "risk_score_snapshots"

    id = Column(Integer, primary_key=True, autoincrement=True)
    merchant_id = Column(String(50), ForeignKey("merchants.id", ondelete="CASCADE"), nullable=False, index=True)
    timestamp = Column(DateTime, default=utc_now, nullable=False)
    score = Column(Integer, nullable=False)
    tier = Column(Integer, nullable=False)
    configuration_version = Column(String(50), default="v1.0.0")
    signal_contributions = Column(Text, nullable=False) # JSON details
    triggered_signals = Column(Text, nullable=False) # JSON array of signal IDs
    reason_summary = Column(Text, nullable=False)

class Alert(Base):
    __tablename__ = "alerts"

    id = Column(String(50), primary_key=True) # e.g. ALT-2024-001
    merchant_id = Column(String(50), ForeignKey("merchants.id", ondelete="CASCADE"), nullable=False, index=True)
    score = Column(Integer, nullable=False)
    tier = Column(Integer, nullable=False)
    severity = Column(String(50), default="Medium") # Low, Medium, High, Critical
    status = Column(String(100), default="New", nullable=False) 
    # Statuses: New, Assigned, Under Review, Merchant Information Requested, Escalated, Cleared, Confirmed Policy Breach, Closed — Insufficient Evidence
    assigned_analyst_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    assigned_analyst_name = Column(String(255), nullable=True)
    triggered_signals = Column(Text, nullable=False) # JSON
    recommended_next_step = Column(String(255), nullable=True)
    review_due_date = Column(DateTime, nullable=True)
    first_detected_at = Column(DateTime, default=utc_now)
    latest_detected_at = Column(DateTime, default=utc_now)
    cleared_reason = Column(Text, nullable=True)
    configuration_version = Column(String(50), default="v1.0.0")
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    merchant = relationship("Merchant", back_populates="alerts")

class Case(Base):
    __tablename__ = "cases"

    id = Column(String(50), primary_key=True) # e.g. CASE-2024-001
    title = Column(String(255), nullable=False)
    merchant_id = Column(String(50), ForeignKey("merchants.id", ondelete="CASCADE"), nullable=False, index=True)
    alert_ids = Column(Text, nullable=False) # JSON array
    status = Column(String(100), default="Open", nullable=False)
    # Open, Under Investigation, Pending Merchant Clarification, Senior Review Pending, Closed — Cleared, Closed — Simulated Containment, Closed — Insufficient Evidence
    priority = Column(String(50), default="Medium") # Low, Medium, High, Critical
    assigned_to_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    assigned_to_name = Column(String(255), nullable=True)
    current_recommendation = Column(String(255), nullable=True)
    recommendation_rationale = Column(Text, nullable=True)
    reviewer_decision = Column(String(50), nullable=True) # Approved, Rejected, Modification Requested
    reviewer_rationale = Column(Text, nullable=True)
    closed_reason = Column(Text, nullable=True)
    reopen_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    merchant = relationship("Merchant", back_populates="cases")
    notes = relationship("CaseNote", back_populates="case", cascade="all, delete-orphan")
    requests = relationship("MerchantInformationRequest", back_populates="case", cascade="all, delete-orphan")
    evidence = relationship("EvidenceItem", back_populates="case", cascade="all, delete-orphan")

class CaseNote(Base):
    __tablename__ = "case_notes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    case_id = Column(String(50), ForeignKey("cases.id", ondelete="CASCADE"), nullable=False, index=True)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    author_name = Column(String(255), nullable=False)
    note_type = Column(String(50), default="Investigation Note") # Investigation Note, Review Note, System Audit
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=utc_now)

    case = relationship("Case", back_populates="notes")

class MerchantInformationRequest(Base):
    __tablename__ = "merchant_information_requests"

    id = Column(String(50), primary_key=True) # e.g. REQ-2024-001
    case_id = Column(String(50), ForeignKey("cases.id", ondelete="CASCADE"), nullable=False, index=True)
    merchant_id = Column(String(50), ForeignKey("merchants.id", ondelete="CASCADE"), nullable=False, index=True)
    request_type = Column(String(100), nullable=False)
    # unusual_timing, volume_spike, invoice_records, business_clarification, payer_patterns, updated_details
    subject = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    due_date = Column(DateTime, nullable=False)
    status = Column(String(50), default="Sent") # Sent, Viewed, Responded, Overdue, Cancelled
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_by_name = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=utc_now)

    case = relationship("Case", back_populates="requests")
    responses = relationship("MerchantResponse", back_populates="request", cascade="all, delete-orphan")

class MerchantResponse(Base):
    __tablename__ = "merchant_responses"

    id = Column(Integer, primary_key=True, autoincrement=True)
    request_id = Column(String(50), ForeignKey("merchant_information_requests.id", ondelete="CASCADE"), nullable=False, index=True)
    merchant_id = Column(String(50), ForeignKey("merchants.id", ondelete="CASCADE"), nullable=False)
    response_text = Column(Text, nullable=False)
    attachment_filenames = Column(Text, nullable=True) # JSON array of mock file names
    submitted_at = Column(DateTime, default=utc_now)
    reviewer_verified = Column(Boolean, default=False)

    request = relationship("MerchantInformationRequest", back_populates="responses")

class EvidenceItem(Base):
    __tablename__ = "evidence_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    case_id = Column(String(50), ForeignKey("cases.id", ondelete="CASCADE"), nullable=False, index=True)
    merchant_id = Column(String(50), ForeignKey("merchants.id", ondelete="CASCADE"), nullable=False)
    evidence_type = Column(String(100), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    raw_data_json = Column(Text, nullable=True)
    provenance_type = Column(String(100), nullable=False)
    # Directly Observed, Derived, Merchant-declared, Optional Third-party Corroboration, Model Inference
    created_at = Column(DateTime, default=utc_now)

    case = relationship("Case", back_populates="evidence")

class SimulationScenario(Base):
    __tablename__ = "simulation_scenarios"

    id = Column(Integer, primary_key=True, autoincrement=True)
    key = Column(String(100), unique=True, nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    typology = Column(String(100), nullable=False)
    expected_tier = Column(String(50), nullable=False)
    expected_signals = Column(Text, nullable=True)

class SimulationRun(Base):
    __tablename__ = "simulation_runs"

    id = Column(String(50), primary_key=True)
    scenario_key = Column(String(100), nullable=False)
    merchant_id = Column(String(50), nullable=False)
    timestamp = Column(DateTime, default=utc_now)
    configuration_version = Column(String(50), default="v1.0.0")
    generated_tx_count = Column(Integer, default=0)
    before_score = Column(Integer, default=0)
    before_tier = Column(Integer, default=0)
    after_score = Column(Integer, default=0)
    after_tier = Column(Integer, default=0)
    generated_alerts_count = Column(Integer, default=0)
    status = Column(String(50), default="Completed")
    notes = Column(Text, nullable=True)

class CalendarEvent(Base):
    __tablename__ = "calendar_events"

    id = Column(String(50), primary_key=True)
    name = Column(String(255), nullable=False)
    event_type = Column(String(100), nullable=False) # Festival, National Holiday, Sports Event, Weekend Spike
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=False)
    expected_volume_multiplier = Column(Float, default=2.5)
    affected_categories = Column(Text, default='["Bakeries", "Restaurants", "Confectionery"]')
    notes = Column(Text, nullable=True)

    # Ingestion & publication lifecycle
    publication_status = Column(String(50), default="published", nullable=False)
    data_source = Column(String(50), default="seed_demo", nullable=False)
    import_batch_id = Column(String(50), nullable=True)
    created_by = Column(String(100), nullable=True, default="Admin")
    published_by = Column(String(100), nullable=True, default="Admin")
    published_at = Column(DateTime, default=utc_now)

class AuditEvent(Base):
    __tablename__ = "audit_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime, default=utc_now, index=True)
    actor_id = Column(Integer, nullable=True)
    actor_name = Column(String(255), nullable=False)
    actor_role = Column(String(50), nullable=False)
    action = Column(String(100), nullable=False, index=True)
    entity_type = Column(String(100), nullable=False, index=True)
    entity_id = Column(String(100), nullable=False, index=True)
    before_state = Column(Text, nullable=True) # JSON
    after_state = Column(Text, nullable=True) # JSON
    rationale = Column(Text, nullable=True)
    ip_address = Column(String(50), default="127.0.0.1")

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    type = Column(String(50), default="alert") # alert, case, system
    link = Column(String(255), nullable=True)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utc_now)

class ImportBatch(Base):
    __tablename__ = "import_batches"

    id = Column(String(50), primary_key=True) # e.g. BATCH-2026-0001
    dataset_type = Column(String(50), nullable=False) # merchants, transactions, settlements, calendar_events
    source_filename = Column(String(255), nullable=False)
    storage_key = Column(String(255), nullable=False)
    file_size_bytes = Column(Integer, default=0)
    mime_type = Column(String(100), default="text/csv")
    import_mode = Column(String(50), default="strict") # strict, valid_only
    status = Column(String(50), default="uploaded") # uploaded, parsed, validated, staged, published, rejected, rolled_back
    total_rows = Column(Integer, default=0)
    valid_rows = Column(Integer, default=0)
    invalid_rows = Column(Integer, default=0)
    staged_rows = Column(Integer, default=0)
    published_rows = Column(Integer, default=0)
    error_summary = Column(Text, nullable=True) # JSON array of error objects
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_by_name = Column(String(255), nullable=False, default="Admin")
    created_at = Column(DateTime, default=utc_now)
    published_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    published_by_name = Column(String(255), nullable=True)
    published_at = Column(DateTime, nullable=True)
    rolled_back_at = Column(DateTime, nullable=True)
    rolled_back_by = Column(String(255), nullable=True)
    rollback_rationale = Column(Text, nullable=True)

    rows = relationship("ImportRowRecord", back_populates="batch", cascade="all, delete-orphan")

class ImportRowRecord(Base):
    __tablename__ = "import_row_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    batch_id = Column(String(50), ForeignKey("import_batches.id", ondelete="CASCADE"), nullable=False, index=True)
    row_number = Column(Integer, nullable=False)
    entity_id = Column(String(100), nullable=True)
    status = Column(String(50), default="valid") # valid, invalid, duplicate, staged, published
    raw_data_json = Column(Text, nullable=False)
    errors_json = Column(Text, nullable=True) # JSON list of {field, message, expected, received}

    batch = relationship("ImportBatch", back_populates="rows")

class DatasetVersion(Base):
    __tablename__ = "dataset_versions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    version_tag = Column(String(50), unique=True, nullable=False) # e.g. DATASET-v1.0.1
    dataset_type = Column(String(50), nullable=False)
    batch_id = Column(String(50), nullable=True)
    action = Column(String(50), nullable=False) # publish, rollback, manual_entry
    records_count = Column(Integer, default=0)
    published_by = Column(String(255), nullable=False)
    published_at = Column(DateTime, default=utc_now)
    notes = Column(Text, nullable=True)
