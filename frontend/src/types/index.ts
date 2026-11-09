export type Role = 'Admin' | 'Risk Analyst' | 'Compliance Reviewer' | 'Read-only Viewer' | 'Merchant';

export interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role: Role;
}

export interface DemoUser extends User {
  token: string;
  demo_password: string;
  description: string;
}

export interface RiskTierInfo {
  tier: number;
  label: string;
  action: string;
  color: string;
}

export interface Merchant {
  id: string;
  name: string;
  legal_name: string;
  business_category: string;
  subcategory?: string;
  city: string;
  region: string;
  onboarding_date: string;
  account_status: string;
  current_risk_score: number;
  current_risk_tier: number;
  tier_label: string;
  tier_action: string;
  tier_color: string;
  transaction_count?: number;
  transaction_volume?: number;
  last_activity?: string;
  open_alerts_count?: number;
  assigned_analyst_name?: string;
  declared_monthly_volume?: number;
  declared_avg_ticket?: number;
  declared_operating_hours?: string;
}

export interface Transaction {
  id: string;
  merchant_id: string;
  merchant_name?: string;
  timestamp: string;
  amount: number;
  currency: string;
  status: string;
  payment_method: string;
  payer_token: string;
  channel: string;
  settlement_ref?: string;
  is_flagged: boolean;
  risk_reason?: string;
}

export interface Alert {
  id: string;
  merchant_id: string;
  merchant_name?: string;
  merchant_category?: string;
  merchant_city?: string;
  score: number;
  tier: number;
  tier_label?: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  status: string;
  assigned_analyst_id?: number;
  assigned_analyst_name?: string;
  triggered_signals: string[];
  recommended_next_step?: string;
  review_due_date?: string;
  first_detected_at: string;
  latest_detected_at: string;
  cleared_reason?: string;
  configuration_version?: string;
}

export interface Case {
  id: string;
  title: string;
  merchant_id: string;
  merchant_name?: string;
  merchant_category?: string;
  merchant_risk_score?: number;
  merchant_risk_tier?: number;
  status: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  assigned_to_id?: number;
  assigned_to_name?: string;
  current_recommendation?: string;
  recommendation_rationale?: string;
  reviewer_decision?: string;
  reviewer_rationale?: string;
  closed_reason?: string;
  reopen_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface CaseNote {
  id: number;
  author_id: number;
  author_name: string;
  note_type: string;
  content: string;
  created_at: string;
}

export interface EvidenceItem {
  id: number;
  title: string;
  evidence_type: string;
  description: string;
  provenance_type: 'Directly Observed' | 'Derived' | 'Merchant-declared' | 'Optional Third-party Corroboration' | 'Model Inference' | string;
  raw_data?: any;
  created_at: string;
}

export interface MerchantInformationRequest {
  id: string;
  case_id: string;
  merchant_id: string;
  merchant_name?: string;
  request_type: string;
  subject: string;
  message: string;
  due_date: string;
  status: string;
  created_by_name: string;
  created_at: string;
  responses: Array<{
    id: number;
    response_text: string;
    attachments: string[];
    submitted_at: string;
    reviewer_verified: boolean;
  }>;
}

export interface RiskSignal {
  id: string;
  name: string;
  dimension: 'WHEN' | 'HOW MUCH' | 'WHO' | 'HOW FAST' | 'CAPACITY / PLAUSIBILITY' | string;
  weight: number;
  threshold: number;
  severity: string;
  confidence_label: string;
  formula_description: string;
  analyst_explanation: string;
  false_positive_notes: string;
  is_active: boolean;
}

export interface RiskSignalEvaluation {
  id: string;
  name: string;
  dimension: string;
  weight: number;
  threshold: number;
  observed_value: number;
  observed_display: string;
  baseline_value: number;
  baseline_display: string;
  triggered: boolean;
  severity: string;
  contribution: number;
  confidence_label: string;
  analyst_explanation: string;
  false_positive_notes: string;
  reason_code?: string;
}

export interface AuditEvent {
  id: number;
  timestamp: string;
  actor_id?: number;
  actor_name: string;
  actor_role: string;
  action: string;
  entity_type: string;
  entity_id: string;
  before_state?: any;
  after_state?: any;
  rationale?: string;
  ip_address?: string;
}

export interface SimulationScenario {
  key: string;
  title: string;
  merchant_name: string;
  category: string;
  city: string;
  expected_tier: string;
  description: string;
  typology: string;
  target_merchant_id: string;
}

export interface AdversarialTest {
  id: string;
  name: string;
  type: string;
  description: string;
  expected_outcome: string;
  synthetic_ground_truth: 'Legitimate' | 'Suspicious';
}
