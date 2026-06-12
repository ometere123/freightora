// ─── Contract Data Types ───────────────────────────────────────────────────

export interface CaseData {
  case_id: string;
  claimant: string;
  respondent: string;
  shipment_summary: string;
  description?: string;           // alias / form field
  exception_type: string;
  claim_amount: number;
  cargo_value?: number;           // alias / form field
  currency: string;
  claimant_narrative: string;
  shipper?: string;
  carrier?: string;
  cargo_description?: string;
  shipment_id?: string;
  tracking_number?: string;
  route_origin?: string;
  route_destination?: string;
  shipment_date?: string;
  exception_date?: string;
  claimant_statement?: string;
  status: string;
  created_at: string;
  opened_by: string;
  review_count: number;
  reconsideration_count: number;
  liability_view?: string;
  case_outcome?: string;
  evidence_strength?: string;
  confidence?: number;
  last_response_id?: string;
  last_settlement_id?: string;
  last_reconsideration_id?: string;
  last_reviewed_at?: string;
  ready_for_review_at?: string;
  accepted_settlement_id?: string;
  review?: ReviewData;            // populated client-side for marketplace
}

export interface ReviewData {
  review_id: string;
  case_id: string;
  liability_view: string;
  case_outcome: string;
  outcome?: string;               // alias for case_outcome
  confidence: number;
  confidence_score?: number;      // alias for confidence
  evidence_strength: string;
  best_fit_explanation: string;
  liable_parties: string[];
  settlement_recommendation: {
    action: string;
    recommended_amount: number;
    currency: string;
    rationale: string;
  };
  recommended_settlement?: string; // simplified alias
  reasoning: string[];
  evidence_conflicts: string[];
  missing_records: string[];
  risk_flags: string[];
  recovery_actions: string[];
  reviewed_at: string;
}

export interface ResponseData {
  response_id: string;
  case_id: string;
  respondent: string;
  respondent_narrative: string;
  statement?: string;   // alias
  position?: string;
  submitted_at: string;
}

export interface EvidenceData {
  evidence_id: string;
  case_id: string;
  submitted_by: string;
  evidence_type: string;
  summary: string;
  description?: string;  // alias
  uri_or_hash: string;
  strength?: string;
  submitted_at: string;
}

export interface ExplanationData {
  explanation_id: string;
  case_id: string;
  submitted_by: string;
  explanation_type: string;
  narrative: string;
  explanation_text?: string;  // alias
  submitted_at: string;
}

export interface SettlementData {
  settlement_id: string;
  case_id: string;
  proposed_by: string;
  action: string;
  amount: number;
  currency: string;
  claimant_accepted: boolean;
  respondent_accepted: boolean;
  created_at: string;
  rationale?: string;
  terms?: string;   // alias
  status?: string;  // derived/alias
}

export interface ReconsiderationData {
  reconsideration_id: string;
  case_id: string;
  requested_by: string;
  reason: string;
  grounds?: string;   // alias
  new_evidence_summary: string;
  status: string;
  created_at: string;
  decision?: string;
}

export interface ReconsiderationReviewData {
  reconsideration_id: string;
  case_id: string;
  reconsideration_decision: string;
  new_liability_view: string;
  confidence: number;
  changed_fields: string[];
  reasoning: string[];
  required_next_records: string[];
  reviewed_at: string;
}

export interface ProtocolStats {
  cases: string;
  responses: string;
  evidence: string;
  explanations: string;
  reviews: string;
  settlements: string;
  reconsiderations: string;
}

// ─── Enum Constants ────────────────────────────────────────────────────────

export const EVIDENCE_TYPES = [
  "BILL_OF_LADING",
  "POD",
  "PHOTO",
  "TEMPERATURE_LOG",
  "GPS_LOG",
  "WAREHOUSE_SCAN",
  "CUSTOMS_RECORD",
  "CARRIER_NOTE",
  "INVOICE",
  "PACKAGING_RECORD",
  "INSPECTION_REPORT",
  "OTHER",
] as const;

export const EXCEPTION_TYPES = [
  "DAMAGE",
  "DELAY",
  "SHORTAGE",
  "LOST_CARGO",
  "TEMPERATURE_EXCURSION",
  "WRONG_DELIVERY",
  "MISROUTED_CARGO",
  "BROKEN_SEAL",
  "CUSTOMS_HOLD",
  "DOCUMENTATION_ERROR",
  "WAREHOUSE_HANDLING_ISSUE",
  "DELIVERY_DISPUTE",
  "OTHER",
] as const;

export const EXPLANATION_TYPES = [
  "CARRIER_HANDLING_FAILURE",
  "SHIPPER_PACKAGING_FAILURE",
  "WAREHOUSE_HANDOFF_FAILURE",
  "CUSTOMS_OR_REGULATORY_DELAY",
  "WEATHER_OR_FORCE_MAJEURE",
  "TEMPERATURE_EXCURSION",
  "SEAL_OR_TAMPER_EVENT",
  "DOCUMENTATION_ERROR",
  "UNEXPLAINED_SHORTAGE",
  "INSUFFICIENT_EVIDENCE",
  "MIXED_CAUSATION",
] as const;

export const SETTLEMENT_ACTIONS = [
  "FULL_COMPENSATION",
  "PARTIAL_COMPENSATION",
  "NO_COMPENSATION",
  "REQUEST_MORE_RECORDS",
  "MEDIATION_RECOMMENDED",
  "CARRIER_REVIEW",
  "WAREHOUSE_REVIEW",
  "INSURANCE_REVIEW",
] as const;

export const CASE_OUTCOMES = [
  "CLAIMANT_SUPPORTED",
  "RESPONDENT_SUPPORTED",
  "CARRIER_LIKELY_LIABLE",
  "SHIPPER_LIKELY_LIABLE",
  "WAREHOUSE_LIKELY_LIABLE",
  "SHARED_LIABILITY",
  "EXTERNAL_CAUSE",
  "INSUFFICIENT_EVIDENCE",
  "NEEDS_MORE_RECORDS",
  "SETTLEMENT_RECOMMENDED",
  "REJECT_CLAIM",
] as const;

export const LIABILITY_VIEWS = [
  "CLAIMANT_STRONG",
  "CLAIMANT_PARTIAL",
  "RESPONDENT_STRONG",
  "RESPONDENT_PARTIAL",
  "CARRIER_PRIMARY",
  "SHIPPER_PRIMARY",
  "WAREHOUSE_PRIMARY",
  "SHARED",
  "UNDETERMINED",
  "NO_LIABILITY_SHOWN",
] as const;

export const EVIDENCE_STRENGTH_VALUES = [
  "STRONG",
  "MODERATE",
  "WEAK",
  "CONFLICTING",
  "INSUFFICIENT",
] as const;
