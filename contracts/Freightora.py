# v0.2.18
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
import json


CASE_STATUSES = (
    "OPENED",
    "CLAIM_EVIDENCE_SUBMITTED",
    "RESPONDED",
    "EXPLANATIONS_SUBMITTED",
    "READY_FOR_REVIEW",
    "UNDER_REVIEW",
    "REVIEWED",
    "SETTLEMENT_PROPOSED",
    "SETTLEMENT_ACCEPTED",
    "RECONSIDERATION_REQUESTED",
    "READY_FOR_RECONSIDERATION_REVIEW",
    "RECONSIDERATION_REVIEWED",
    "FINALIZED",
    "CANCELLED",
)

EVIDENCE_TYPES = (
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
)

EXPLANATION_TYPES = (
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
)

LIABILITY_VIEWS = (
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
)

CASE_OUTCOMES = (
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
)

EVIDENCE_STRENGTH = (
    "STRONG",
    "MODERATE",
    "WEAK",
    "CONFLICTING",
    "INSUFFICIENT",
)

SETTLEMENT_ACTIONS = (
    "FULL_COMPENSATION",
    "PARTIAL_COMPENSATION",
    "NO_COMPENSATION",
    "REQUEST_MORE_RECORDS",
    "MEDIATION_RECOMMENDED",
    "CARRIER_REVIEW",
    "WAREHOUSE_REVIEW",
    "INSURANCE_REVIEW",
)

RECONSIDERATION_DECISIONS = (
    "UPHOLD_ORIGINAL",
    "IMPROVE_CLAIMANT_POSITION",
    "IMPROVE_RESPONDENT_POSITION",
    "REQUEST_MORE_EVIDENCE",
    "RECLASSIFY_CAUSATION",
)


class Freightora(gl.Contract):
    owner: Address
    paused: bool
    review_fee: u256

    case_count: u256
    response_count: u256
    evidence_count: u256
    explanation_count: u256
    review_count: u256
    settlement_count: u256
    reconsideration_count: u256

    cases: TreeMap[str, str]
    responses: TreeMap[str, str]
    evidence: TreeMap[str, str]
    explanations: TreeMap[str, str]
    reviews: TreeMap[str, str]
    settlements: TreeMap[str, str]
    reconsiderations: TreeMap[str, str]
    reconsideration_reviews: TreeMap[str, str]

    case_index: TreeMap[str, str]
    party_cases: TreeMap[str, str]
    responses_by_case: TreeMap[str, str]
    evidence_by_case: TreeMap[str, str]
    explanations_by_case: TreeMap[str, str]
    settlements_by_case: TreeMap[str, str]
    reconsiderations_by_case: TreeMap[str, str]

    resolvers: TreeMap[str, str]
    protocol_stats: TreeMap[str, str]

    def __init__(self) -> None:
        self.owner = gl.message.sender_address
        self.paused = False
        self.review_fee = u256(10000000000000000)

        self.case_count = u256(0)
        self.response_count = u256(0)
        self.evidence_count = u256(0)
        self.explanation_count = u256(0)
        self.review_count = u256(0)
        self.settlement_count = u256(0)
        self.reconsideration_count = u256(0)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _fail(self, message: str) -> None:
        raise gl.vm.UserError(message)

    def _sender(self) -> str:
        return str(gl.message.sender_address)

    def _marker(self) -> str:
        total = (
            self.case_count
            + self.response_count
            + self.evidence_count
            + self.explanation_count
            + self.review_count
            + self.settlement_count
            + self.reconsideration_count
        )
        return str(total)

    def _json_obj(self, raw: str, error: str) -> dict:
        try:
            data = json.loads(str(raw or "{}"))
        except Exception:
            self._fail(error)
            return {}
        if not isinstance(data, dict):
            self._fail(error)
            return {}
        return data

    def _safe_obj(self, raw: str) -> dict:
        try:
            data = json.loads(str(raw or "{}"))
            if isinstance(data, dict):
                return data
            return {}
        except Exception:
            return {}

    def _safe_list(self, raw: str) -> list:
        try:
            data = json.loads(str(raw or "[]"))
            if isinstance(data, list):
                return data
            return []
        except Exception:
            return []

    def _dumps(self, data: dict) -> str:
        return json.dumps(data, separators=(",", ":"), sort_keys=True)

    def _append_index(self, store: TreeMap[str, str], key: str, value: str) -> None:
        items = self._safe_list(store.get(key, "[]"))
        exists = False
        for item in items:
            if str(item) == value:
                exists = True
        if not exists:
            items.append(value)
        store[key] = json.dumps(items, separators=(",", ":"))

    def _clamp_int(self, value, low: int, high: int) -> int:
        try:
            n = int(value)
        except Exception:
            n = 0
        if n < low:
            return low
        if n > high:
            return high
        return n

    def _clean_list(self, raw, max_items: int, max_len: int) -> list:
        if not isinstance(raw, list):
            raw = [str(raw)]
        clean = []
        for item in raw:
            text = str(item or "").strip()
            if text and len(clean) < max_items:
                clean.append(text[:max_len])
        return clean

    def _extract_json(self, raw) -> dict:
        if isinstance(raw, dict):
            return raw
        text = str(raw or "").strip()
        if text.startswith("```"):
            text = text.strip("`").strip()
            if text.lower().startswith("json"):
                text = text[4:].strip()
        start = text.find("{")
        end = text.rfind("}")
        if start == -1 or end == -1 or end <= start:
            return {}
        try:
            data = json.loads(text[start : end + 1])
            if isinstance(data, dict):
                return data
            return {}
        except Exception:
            return {}

    def _require_not_paused(self) -> None:
        if self.paused:
            self._fail("protocol paused")

    def _require_owner(self) -> None:
        if self._sender() != str(self.owner):
            self._fail("owner only")

    def _is_resolver(self, address: str) -> bool:
        raw = self.resolvers.get(str(address), "")
        if not raw:
            return False
        data = self._safe_obj(raw)
        return bool(data.get("active", False))

    def _require_resolver_or_owner(self) -> None:
        sender = self._sender()
        if sender != str(self.owner) and not self._is_resolver(sender):
            self._fail("resolver or owner only")

    def _require_case(self, case_id: str) -> dict:
        raw = self.cases.get(str(case_id), "")
        if not raw:
            self._fail("unknown case")
        return self._safe_obj(raw)

    def _is_case_party(self, case_data: dict, address: str) -> bool:
        sender = str(address)
        return sender == str(case_data.get("claimant", "")) or sender == str(case_data.get("respondent", ""))

    def _require_case_party_or_resolver(self, case_data: dict) -> None:
        sender = self._sender()
        if not self._is_case_party(case_data, sender) and sender != str(self.owner) and not self._is_resolver(sender):
            self._fail("case party, resolver, or owner only")

    def _require_claimant(self, case_data: dict) -> None:
        if self._sender() != str(case_data.get("claimant", "")):
            self._fail("claimant only")

    def _require_respondent(self, case_data: dict) -> None:
        if self._sender() != str(case_data.get("respondent", "")):
            self._fail("respondent only")

    def _require_status_not_final(self, case_data: dict) -> None:
        status = str(case_data.get("status", ""))
        if status in ("UNDER_REVIEW", "FINALIZED", "CANCELLED"):
            self._fail("case cannot be changed in current status")

    def _bounded_str(self, value, max_len: int) -> str:
        return str(value or "").strip()[:max_len]

    def _to_int_nonnegative(self, value) -> int:
        try:
            n = int(value)
        except Exception:
            n = 0
        if n < 0:
            n = 0
        return n

    # ------------------------------------------------------------------
    # Admin / resolver controls
    # ------------------------------------------------------------------

    @gl.public.write
    def admin_pause(self) -> str:
        self._require_owner()
        self.paused = True
        return "paused"

    @gl.public.write
    def admin_unpause(self) -> str:
        self._require_owner()
        self.paused = False
        return "unpaused"

    @gl.public.write
    def pause_protocol(self) -> str:
        self._require_owner()
        self.paused = True
        return "paused"

    @gl.public.write
    def unpause_protocol(self) -> str:
        self._require_owner()
        self.paused = False
        return "unpaused"

    @gl.public.write
    def set_review_fee(self, fee_wei: u256) -> str:
        self._require_owner()
        self.review_fee = fee_wei
        return str(fee_wei)

    @gl.public.write
    def add_resolver(self, resolver: Address) -> str:
        self._require_owner()
        resolver_s = str(resolver).strip()
        if not resolver_s:
            self._fail("resolver required")
        self.resolvers[resolver_s] = self._dumps({"active": True, "added_at": self._marker()})
        return resolver_s

    @gl.public.write
    def remove_resolver(self, resolver: Address) -> str:
        self._require_owner()
        resolver_s = str(resolver).strip()
        self.resolvers[resolver_s] = self._dumps({"active": False, "removed_at": self._marker()})
        return resolver_s

    @gl.public.write
    def transfer_ownership(self, new_owner: Address) -> str:
        self._require_owner()
        new_owner_s = str(new_owner).strip()
        if not new_owner_s:
            self._fail("new owner required")
        self.owner = Address(new_owner_s)
        return new_owner_s

    # ------------------------------------------------------------------
    # Case lifecycle
    # ------------------------------------------------------------------

    @gl.public.write
    def open_case(self, case_id: str, case_json: str) -> str:
        self._require_not_paused()
        case_id = str(case_id).strip()
        if not case_id:
            self._fail("case_id required")
        if self.cases.get(case_id, ""):
            self._fail("case already exists")

        data = self._json_obj(case_json, "case_json must be a JSON object")
        required = (
            "claimant",
            "respondent",
            "shipment_summary",
            "exception_type",
            "claim_amount",
            "currency",
            "claimant_narrative",
        )
        for key in required:
            if data.get(key) is None or str(data.get(key, "")).strip() == "":
                self._fail("missing required field: " + key)

        claimant = str(data.get("claimant", "")).strip()
        respondent = str(data.get("respondent", "")).strip()
        if claimant != self._sender():
            self._fail("claimant must be transaction sender")
        if claimant == respondent:
            self._fail("claimant and respondent cannot be same")

        data["case_id"] = case_id
        data["claimant"] = claimant
        data["respondent"] = respondent
        data["shipment_summary"] = self._bounded_str(data.get("shipment_summary", ""), 1600)
        data["exception_type"] = self._bounded_str(data.get("exception_type", ""), 120)
        data["claim_amount"] = self._to_int_nonnegative(data.get("claim_amount", 0))
        data["currency"] = self._bounded_str(data.get("currency", "USD"), 24)
        data["claimant_narrative"] = self._bounded_str(data.get("claimant_narrative", ""), 4000)
        data["status"] = "OPENED"
        data["created_at"] = self._marker()
        data["opened_by"] = self._sender()
        data["review_count"] = 0
        data["reconsideration_count"] = 0

        self.cases[case_id] = self._dumps(data)
        self.case_count = self.case_count + u256(1)

        self._append_index(self.case_index, "all", case_id)
        self._append_index(self.party_cases, claimant, case_id)
        self._append_index(self.party_cases, respondent, case_id)

        return case_id

    @gl.public.write
    def submit_response(self, response_id: str, case_id: str, response_json: str) -> str:
        self._require_not_paused()
        response_id = str(response_id).strip()
        case_id = str(case_id).strip()
        if not response_id:
            self._fail("response_id required")
        if self.responses.get(response_id, ""):
            self._fail("response already exists")

        case_data = self._require_case(case_id)
        self._require_respondent(case_data)
        self._require_status_not_final(case_data)

        data = self._json_obj(response_json, "response_json must be a JSON object")
        if not data.get("respondent_narrative"):
            self._fail("respondent_narrative required")

        data["response_id"] = response_id
        data["case_id"] = case_id
        data["respondent"] = self._sender()
        data["respondent_narrative"] = self._bounded_str(data.get("respondent_narrative", ""), 4000)
        data["submitted_at"] = self._marker()

        self.responses[response_id] = self._dumps(data)
        self.response_count = self.response_count + u256(1)
        self._append_index(self.responses_by_case, case_id, response_id)

        case_data["status"] = "RESPONDED"
        case_data["last_response_id"] = response_id
        self.cases[case_id] = self._dumps(case_data)

        return response_id

    @gl.public.write
    def add_evidence(self, evidence_id: str, case_id: str, evidence_json: str) -> str:
        self._require_not_paused()
        evidence_id = str(evidence_id).strip()
        case_id = str(case_id).strip()
        if not evidence_id:
            self._fail("evidence_id required")
        if self.evidence.get(evidence_id, ""):
            self._fail("evidence already exists")

        case_data = self._require_case(case_id)
        self._require_case_party_or_resolver(case_data)
        self._require_status_not_final(case_data)

        data = self._json_obj(evidence_json, "evidence_json must be a JSON object")
        evidence_type = str(data.get("evidence_type", "OTHER")).upper()
        if evidence_type not in EVIDENCE_TYPES:
            evidence_type = "OTHER"

        data["evidence_id"] = evidence_id
        data["case_id"] = case_id
        data["submitted_by"] = self._sender()
        data["evidence_type"] = evidence_type
        data["summary"] = self._bounded_str(data.get("summary", ""), 2000)
        data["uri_or_hash"] = self._bounded_str(data.get("uri_or_hash", ""), 500)
        data["submitted_at"] = self._marker()

        self.evidence[evidence_id] = self._dumps(data)
        self.evidence_count = self.evidence_count + u256(1)
        self._append_index(self.evidence_by_case, case_id, evidence_id)

        if str(case_data.get("status", "")) in ("OPENED", "RESPONDED", "CLAIM_EVIDENCE_SUBMITTED"):
            case_data["status"] = "CLAIM_EVIDENCE_SUBMITTED"
            self.cases[case_id] = self._dumps(case_data)

        return evidence_id

    @gl.public.write
    def submit_explanation(self, explanation_id: str, case_id: str, explanation_json: str) -> str:
        self._require_not_paused()
        explanation_id = str(explanation_id).strip()
        case_id = str(case_id).strip()
        if not explanation_id:
            self._fail("explanation_id required")
        if self.explanations.get(explanation_id, ""):
            self._fail("explanation already exists")

        case_data = self._require_case(case_id)
        self._require_case_party_or_resolver(case_data)
        self._require_status_not_final(case_data)

        data = self._json_obj(explanation_json, "explanation_json must be a JSON object")
        explanation_type = str(data.get("explanation_type", "INSUFFICIENT_EVIDENCE")).upper()
        if explanation_type not in EXPLANATION_TYPES:
            explanation_type = "INSUFFICIENT_EVIDENCE"

        if not data.get("narrative"):
            self._fail("narrative required")

        data["explanation_id"] = explanation_id
        data["case_id"] = case_id
        data["submitted_by"] = self._sender()
        data["explanation_type"] = explanation_type
        data["narrative"] = self._bounded_str(data.get("narrative", ""), 3000)
        data["submitted_at"] = self._marker()

        self.explanations[explanation_id] = self._dumps(data)
        self.explanation_count = self.explanation_count + u256(1)
        self._append_index(self.explanations_by_case, case_id, explanation_id)

        cur_status = str(case_data.get("status", ""))
        if cur_status in ("RESPONDED", "CLAIM_EVIDENCE_SUBMITTED"):
            case_data["status"] = "EXPLANATIONS_SUBMITTED"
            self.cases[case_id] = self._dumps(case_data)

        return explanation_id

    @gl.public.write
    def mark_ready_for_review(self, case_id: str) -> str:
        self._require_not_paused()
        case_id = str(case_id).strip()
        case_data = self._require_case(case_id)
        self._require_case_party_or_resolver(case_data)

        status = str(case_data.get("status", ""))
        if status in ("UNDER_REVIEW", "REVIEWED", "FINALIZED", "CANCELLED"):
            self._fail("case cannot be marked ready in current status")

        evidence_ids = self._safe_list(self.evidence_by_case.get(case_id, "[]"))
        if len(evidence_ids) == 0:
            self._fail("at least one evidence item required")

        case_data["status"] = "READY_FOR_REVIEW"
        case_data["ready_for_review_at"] = self._marker()
        self.cases[case_id] = self._dumps(case_data)
        return case_id

    @gl.public.write
    def cancel_case(self, case_id: str, reason: str) -> str:
        self._require_not_paused()
        case_id = str(case_id).strip()
        case_data = self._require_case(case_id)
        self._require_claimant(case_data)
        status = str(case_data.get("status", ""))
        if status in ("UNDER_REVIEW", "REVIEWED", "FINALIZED", "SETTLEMENT_ACCEPTED", "RECONSIDERATION_REVIEWED"):
            self._fail("cannot cancel after review starts")
        case_data["status"] = "CANCELLED"
        case_data["cancelled_at"] = self._marker()
        case_data["cancel_reason"] = self._bounded_str(reason, 500)
        self.cases[case_id] = self._dumps(case_data)
        return case_id

    # ------------------------------------------------------------------
    # GenLayer exception review
    # ------------------------------------------------------------------

    @gl.public.write.payable
    def review_exception(self, case_id: str) -> str:
        self._require_not_paused()
        if int(gl.message.value) < int(self.review_fee):
            self._fail("review fee required: " + str(self.review_fee))
        case_id = str(case_id).strip()
        case_data = self._require_case(case_id)
        self._require_case_party_or_resolver(case_data)

        if str(case_data.get("status", "")) != "READY_FOR_REVIEW":
            self._fail("case must be READY_FOR_REVIEW")

        manifest = self._build_case_manifest(case_id)

        case_data["status"] = "UNDER_REVIEW"
        case_data["under_review_at"] = self._marker()
        self.cases[case_id] = self._dumps(case_data)

        def leader_review() -> str:
            prompt = self._exception_review_prompt(manifest)
            raw = gl.nondet.exec_prompt(prompt, response_format="json")
            parsed = self._extract_json(raw)
            final = self._normalise_exception_review(parsed, case_data)
            return self._dumps(final)

        review_json = gl.eq_principle.prompt_non_comparative(
            leader_review,
            task=(
                "Resolve a cargo exception case by comparing claimant narrative, respondent narrative, "
                "shipment records, evidence summaries, proposed explanations, and settlement context."
            ),
            criteria=(
                "The output must be strict JSON. It must choose one allowed liability_view and one allowed case_outcome. "
                "It must explain evidence conflicts, missing records, best-fit explanation, evidence strength, "
                "settlement reasonableness, and recovery actions. It must not provide legal advice or invent facts."
            ),
        )

        parsed = self._extract_json(review_json)
        final_review = self._normalise_exception_review(parsed, case_data)

        review_id = "REV-" + str(self.review_count + u256(1))
        final_review["review_id"] = review_id
        final_review["case_id"] = case_id
        final_review["reviewed_at"] = self._marker()
        final_json = self._dumps(final_review)

        self.reviews[case_id] = final_json
        self.review_count = self.review_count + u256(1)

        self._apply_exception_review(case_id, final_review)
        return final_json

    def _build_case_manifest(self, case_id: str) -> str:
        case_data = self._require_case(case_id)

        response_ids = self._safe_list(self.responses_by_case.get(case_id, "[]"))
        evidence_ids = self._safe_list(self.evidence_by_case.get(case_id, "[]"))
        explanation_ids = self._safe_list(self.explanations_by_case.get(case_id, "[]"))
        settlement_ids = self._safe_list(self.settlements_by_case.get(case_id, "[]"))

        responses = []
        for rid in response_ids:
            raw = self.responses.get(str(rid), "")
            if raw:
                responses.append(self._safe_obj(raw))

        evidence_items = []
        for eid in evidence_ids:
            raw = self.evidence.get(str(eid), "")
            if raw:
                evidence_items.append(self._safe_obj(raw))

        explanations = []
        for xid in explanation_ids:
            raw = self.explanations.get(str(xid), "")
            if raw:
                explanations.append(self._safe_obj(raw))

        settlements = []
        for sid in settlement_ids:
            raw = self.settlements.get(str(sid), "")
            if raw:
                settlements.append(self._safe_obj(raw))

        manifest = {
            "case": case_data,
            "responses": responses,
            "evidence": evidence_items,
            "proposed_explanations": explanations,
            "settlement_paths": settlements,
        }
        return self._dumps(manifest)

    def _exception_review_prompt(self, manifest_json: str) -> str:
        return (
            "You are a GenLayer validator for Freightora, a cargo exception resolution network.\n"
            "You are not a court and you must not give legal advice. Your job is to evaluate logistics evidence and produce a reasoned operational resolution view.\n\n"
            "CASE MANIFEST JSON:\n"
            + manifest_json
            + "\n\n"
            "Review the cargo exception holistically. Compare claimant narrative, respondent narrative, shipment timeline, evidence summaries, carrier records, warehouse scans, photos, temperature logs, POD/BOL records, invoices, proposed explanations, and settlement context.\n\n"
            "Assess:\n"
            "- which explanation best fits the submitted records\n"
            "- whether claimant's exception is supported\n"
            "- likely liability view without making legal conclusions\n"
            "- evidence strength and evidence conflicts\n"
            "- missing records needed for a stronger conclusion\n"
            "- settlement reasonableness\n"
            "- recovery / operational next steps\n\n"
            "Rules:\n"
            "- Do not invent missing facts.\n"
            "- If evidence is missing, list it as missing.\n"
            "- Distinguish weak records from bad faith.\n"
            "- Do not declare fraud unless strong direct evidence supports it.\n"
            "- If evidence conflicts, explain which records are stronger and why.\n"
            "- Return strict JSON only. No markdown.\n\n"
            "Allowed liability_view values: CLAIMANT_STRONG, CLAIMANT_PARTIAL, RESPONDENT_STRONG, RESPONDENT_PARTIAL, CARRIER_PRIMARY, SHIPPER_PRIMARY, WAREHOUSE_PRIMARY, SHARED, UNDETERMINED, NO_LIABILITY_SHOWN.\n"
            "Allowed case_outcome values: CLAIMANT_SUPPORTED, RESPONDENT_SUPPORTED, CARRIER_LIKELY_LIABLE, SHIPPER_LIKELY_LIABLE, WAREHOUSE_LIKELY_LIABLE, SHARED_LIABILITY, EXTERNAL_CAUSE, INSUFFICIENT_EVIDENCE, NEEDS_MORE_RECORDS, SETTLEMENT_RECOMMENDED, REJECT_CLAIM.\n"
            "Allowed evidence_strength values: STRONG, MODERATE, WEAK, CONFLICTING, INSUFFICIENT.\n"
            "Allowed settlement action values: FULL_COMPENSATION, PARTIAL_COMPENSATION, NO_COMPENSATION, REQUEST_MORE_RECORDS, MEDIATION_RECOMMENDED, CARRIER_REVIEW, WAREHOUSE_REVIEW, INSURANCE_REVIEW.\n\n"
            "Return this JSON shape:\n"
            "{\n"
            '  "liability_view": "CARRIER_PRIMARY",\n'
            '  "case_outcome": "CARRIER_LIKELY_LIABLE",\n'
            '  "confidence": 72,\n'
            '  "evidence_strength": "MODERATE",\n'
            '  "best_fit_explanation": "Short explanation of the most likely cause.",\n'
            '  "liable_parties": ["carrier", "warehouse"],\n'
            '  "settlement_recommendation": {"action": "PARTIAL_COMPENSATION", "recommended_amount": 1200, "currency": "USD", "rationale": "Short rationale."},\n'
            '  "reasoning": ["reason 1", "reason 2"],\n'
            '  "evidence_conflicts": ["conflict 1"],\n'
            '  "missing_records": ["missing record 1"],\n'
            '  "risk_flags": ["risk flag 1"],\n'
            '  "recovery_actions": ["action 1"]\n'
            "}\n"
        )

    def _normalise_exception_review(self, parsed: dict, case_data: dict) -> dict:
        liability = str(parsed.get("liability_view", "UNDETERMINED")).upper()
        if liability not in LIABILITY_VIEWS:
            liability = "UNDETERMINED"

        outcome = str(parsed.get("case_outcome", "NEEDS_MORE_RECORDS")).upper()
        if outcome not in CASE_OUTCOMES:
            outcome = "NEEDS_MORE_RECORDS"

        strength = str(parsed.get("evidence_strength", "INSUFFICIENT")).upper()
        if strength not in EVIDENCE_STRENGTH:
            strength = "INSUFFICIENT"

        settlement_raw = parsed.get("settlement_recommendation", {})
        if not isinstance(settlement_raw, dict):
            settlement_raw = {}

        action = str(settlement_raw.get("action", "REQUEST_MORE_RECORDS")).upper()
        if action not in SETTLEMENT_ACTIONS:
            action = "REQUEST_MORE_RECORDS"

        amount = self._to_int_nonnegative(settlement_raw.get("recommended_amount", 0))
        claim_amount = self._to_int_nonnegative(case_data.get("claim_amount", 0))
        if claim_amount > 0 and amount > claim_amount:
            amount = claim_amount

        currency = str(settlement_raw.get("currency", case_data.get("currency", "USD")))[:24]

        return {
            "liability_view": liability,
            "case_outcome": outcome,
            "confidence": self._clamp_int(parsed.get("confidence", 0), 0, 100),
            "evidence_strength": strength,
            "best_fit_explanation": str(parsed.get("best_fit_explanation", ""))[:1200],
            "liable_parties": self._clean_list(parsed.get("liable_parties", []), 6, 80),
            "settlement_recommendation": {
                "action": action,
                "recommended_amount": amount,
                "currency": currency,
                "rationale": str(settlement_raw.get("rationale", ""))[:800],
            },
            "reasoning": self._clean_list(parsed.get("reasoning", []), 8, 400),
            "evidence_conflicts": self._clean_list(parsed.get("evidence_conflicts", []), 8, 300),
            "missing_records": self._clean_list(parsed.get("missing_records", []), 8, 300),
            "risk_flags": self._clean_list(parsed.get("risk_flags", []), 8, 240),
            "recovery_actions": self._clean_list(parsed.get("recovery_actions", []), 8, 300),
        }

    def _apply_exception_review(self, case_id: str, review: dict) -> None:
        case_data = self._require_case(case_id)
        case_data["status"] = "REVIEWED"
        case_data["liability_view"] = review.get("liability_view", "UNDETERMINED")
        case_data["case_outcome"] = review.get("case_outcome", "NEEDS_MORE_RECORDS")
        case_data["evidence_strength"] = review.get("evidence_strength", "INSUFFICIENT")
        case_data["confidence"] = review.get("confidence", 0)
        case_data["last_reviewed_at"] = self._marker()
        case_data["review_count"] = int(case_data.get("review_count", 0)) + 1
        self.cases[case_id] = self._dumps(case_data)

    # ------------------------------------------------------------------
    # Settlement paths
    # ------------------------------------------------------------------

    @gl.public.write
    def open_settlement_path(self, settlement_id: str, case_id: str, settlement_json: str) -> str:
        self._require_not_paused()
        settlement_id = str(settlement_id).strip()
        case_id = str(case_id).strip()
        if not settlement_id:
            self._fail("settlement_id required")
        if self.settlements.get(settlement_id, ""):
            self._fail("settlement already exists")

        case_data = self._require_case(case_id)
        self._require_case_party_or_resolver(case_data)
        if str(case_data.get("status", "")) not in ("REVIEWED", "RECONSIDERATION_REVIEWED"):
            self._fail("settlement can be opened only after review")

        data = self._json_obj(settlement_json, "settlement_json must be a JSON object")
        action = str(data.get("action", "MEDIATION_RECOMMENDED")).upper()
        if action not in SETTLEMENT_ACTIONS:
            action = "MEDIATION_RECOMMENDED"

        data["settlement_id"] = settlement_id
        data["case_id"] = case_id
        data["proposed_by"] = self._sender()
        data["action"] = action
        data["amount"] = self._to_int_nonnegative(data.get("amount", 0))
        data["currency"] = self._bounded_str(data.get("currency", case_data.get("currency", "USD")), 24)
        data["claimant_accepted"] = False
        data["respondent_accepted"] = False
        data["created_at"] = self._marker()

        self.settlements[settlement_id] = self._dumps(data)
        self.settlement_count = self.settlement_count + u256(1)
        self._append_index(self.settlements_by_case, case_id, settlement_id)

        case_data["status"] = "SETTLEMENT_PROPOSED"
        case_data["last_settlement_id"] = settlement_id
        self.cases[case_id] = self._dumps(case_data)

        return settlement_id

    @gl.public.write
    def accept_settlement(self, settlement_id: str, acceptance_json: str) -> str:
        self._require_not_paused()
        settlement_id = str(settlement_id).strip()
        raw = self.settlements.get(settlement_id, "")
        if not raw:
            self._fail("unknown settlement")
        settlement = self._safe_obj(raw)
        case_id = str(settlement.get("case_id", ""))
        case_data = self._require_case(case_id)

        sender = self._sender()
        if sender == str(case_data.get("claimant", "")):
            settlement["claimant_accepted"] = True
            settlement["claimant_acceptance"] = self._bounded_str(acceptance_json, 2000)
        elif sender == str(case_data.get("respondent", "")):
            settlement["respondent_accepted"] = True
            settlement["respondent_acceptance"] = self._bounded_str(acceptance_json, 2000)
        else:
            self._fail("case party only")

        settlement["last_accepted_at"] = self._marker()
        self.settlements[settlement_id] = self._dumps(settlement)

        if bool(settlement.get("claimant_accepted", False)) and bool(settlement.get("respondent_accepted", False)):
            case_data["status"] = "SETTLEMENT_ACCEPTED"
            case_data["accepted_settlement_id"] = settlement_id
            case_data["settlement_accepted_at"] = self._marker()
            self.cases[case_id] = self._dumps(case_data)

        return settlement_id

    # ------------------------------------------------------------------
    # Reconsideration
    # ------------------------------------------------------------------

    @gl.public.write
    def open_reconsideration(self, reconsideration_id: str, case_id: str, reconsideration_json: str) -> str:
        self._require_not_paused()
        reconsideration_id = str(reconsideration_id).strip()
        case_id = str(case_id).strip()
        if not reconsideration_id:
            self._fail("reconsideration_id required")
        if self.reconsiderations.get(reconsideration_id, ""):
            self._fail("reconsideration already exists")

        case_data = self._require_case(case_id)
        self._require_case_party_or_resolver(case_data)
        if str(case_data.get("status", "")) not in ("REVIEWED", "SETTLEMENT_PROPOSED"):
            self._fail("case must be reviewed before reconsideration")

        data = self._json_obj(reconsideration_json, "reconsideration_json must be a JSON object")
        if not data.get("reason"):
            self._fail("reason required")

        data["reconsideration_id"] = reconsideration_id
        data["case_id"] = case_id
        data["requested_by"] = self._sender()
        data["reason"] = self._bounded_str(data.get("reason", ""), 2000)
        data["new_evidence_summary"] = self._bounded_str(data.get("new_evidence_summary", ""), 3000)
        data["status"] = "READY_FOR_RECONSIDERATION_REVIEW"
        data["created_at"] = self._marker()

        self.reconsiderations[reconsideration_id] = self._dumps(data)
        self.reconsideration_count = self.reconsideration_count + u256(1)
        self._append_index(self.reconsiderations_by_case, case_id, reconsideration_id)

        case_data["status"] = "READY_FOR_RECONSIDERATION_REVIEW"
        case_data["last_reconsideration_id"] = reconsideration_id
        case_data["reconsideration_count"] = int(case_data.get("reconsideration_count", 0)) + 1
        self.cases[case_id] = self._dumps(case_data)

        return reconsideration_id

    @gl.public.write.payable
    def review_reconsideration(self, reconsideration_id: str) -> str:
        self._require_not_paused()
        if int(gl.message.value) < int(self.review_fee):
            self._fail("review fee required: " + str(self.review_fee))
        reconsideration_id = str(reconsideration_id).strip()
        rec_raw = self.reconsiderations.get(reconsideration_id, "")
        if not rec_raw:
            self._fail("unknown reconsideration")
        rec = self._safe_obj(rec_raw)
        if str(rec.get("status", "")) == "REVIEWED":
            self._fail("reconsideration already reviewed")

        case_id = str(rec.get("case_id", ""))
        case_data = self._require_case(case_id)
        self._require_case_party_or_resolver(case_data)

        manifest = self._build_case_manifest(case_id)
        previous_review = self.reviews.get(case_id, "{}")

        def leader_review() -> str:
            prompt = self._reconsideration_prompt(manifest, previous_review, rec_raw)
            raw = gl.nondet.exec_prompt(prompt, response_format="json")
            parsed = self._extract_json(raw)
            final = self._normalise_reconsideration_review(parsed)
            return self._dumps(final)

        review_json = gl.eq_principle.prompt_non_comparative(
            leader_review,
            task="Review a cargo exception reconsideration using new evidence against the prior consensus review.",
            criteria=(
                "The output must be strict JSON. The reconsideration_decision must be one allowed enum. "
                "It must explain whether new evidence justifies changing liability view, outcome, or settlement recommendation."
            ),
        )

        parsed = self._extract_json(review_json)
        final = self._normalise_reconsideration_review(parsed)
        final["reconsideration_id"] = reconsideration_id
        final["case_id"] = case_id
        final["reviewed_at"] = self._marker()
        final_json = self._dumps(final)

        self.reconsideration_reviews[reconsideration_id] = final_json

        rec["status"] = "REVIEWED"
        rec["decision"] = final.get("reconsideration_decision", "UPHOLD_ORIGINAL")
        self.reconsiderations[reconsideration_id] = self._dumps(rec)

        case_data["status"] = "RECONSIDERATION_REVIEWED"
        case_data["last_reconsideration_decision"] = final.get("reconsideration_decision", "UPHOLD_ORIGINAL")
        case_data["last_reconsideration_reviewed_at"] = self._marker()
        self.cases[case_id] = self._dumps(case_data)

        return final_json

    def _reconsideration_prompt(self, manifest_json: str, previous_review_json: str, reconsideration_json: str) -> str:
        return (
            "You are a GenLayer validator reviewing a Freightora reconsideration request.\n"
            "Compare the original case, the prior consensus review, and the new reconsideration evidence.\n"
            "Do not provide legal advice. Do not invent facts. Return strict JSON only.\n\n"
            "CASE MANIFEST JSON:\n"
            + manifest_json
            + "\n\nPRIOR REVIEW JSON:\n"
            + previous_review_json
            + "\n\nRECONSIDERATION JSON:\n"
            + reconsideration_json
            + "\n\n"
            "Allowed reconsideration_decision values: UPHOLD_ORIGINAL, IMPROVE_CLAIMANT_POSITION, IMPROVE_RESPONDENT_POSITION, REQUEST_MORE_EVIDENCE, RECLASSIFY_CAUSATION.\n"
            "Allowed liability_view values: CLAIMANT_STRONG, CLAIMANT_PARTIAL, RESPONDENT_STRONG, RESPONDENT_PARTIAL, CARRIER_PRIMARY, SHIPPER_PRIMARY, WAREHOUSE_PRIMARY, SHARED, UNDETERMINED, NO_LIABILITY_SHOWN.\n"
            "Return this JSON shape:\n"
            "{\n"
            '  "reconsideration_decision": "UPHOLD_ORIGINAL",\n'
            '  "new_liability_view": "CARRIER_PRIMARY",\n'
            '  "confidence": 70,\n'
            '  "changed_fields": ["field changed"],\n'
            '  "reasoning": ["reason 1"],\n'
            '  "required_next_records": ["record 1"]\n'
            "}\n"
        )

    def _normalise_reconsideration_review(self, parsed: dict) -> dict:
        decision = str(parsed.get("reconsideration_decision", "UPHOLD_ORIGINAL")).upper()
        if decision not in RECONSIDERATION_DECISIONS:
            decision = "UPHOLD_ORIGINAL"

        liability = str(parsed.get("new_liability_view", "UNDETERMINED")).upper()
        if liability not in LIABILITY_VIEWS:
            liability = "UNDETERMINED"

        return {
            "reconsideration_decision": decision,
            "new_liability_view": liability,
            "confidence": self._clamp_int(parsed.get("confidence", 0), 0, 100),
            "changed_fields": self._clean_list(parsed.get("changed_fields", []), 8, 120),
            "reasoning": self._clean_list(parsed.get("reasoning", []), 8, 400),
            "required_next_records": self._clean_list(parsed.get("required_next_records", []), 8, 300),
        }

    # ------------------------------------------------------------------
    # Finalisation
    # ------------------------------------------------------------------

    @gl.public.write
    def finalize_case(self, case_id: str, note: str) -> str:
        self._require_not_paused()
        case_id = str(case_id).strip()
        case_data = self._require_case(case_id)
        self._require_case_party_or_resolver(case_data)
        status = str(case_data.get("status", ""))
        if status not in ("REVIEWED", "SETTLEMENT_ACCEPTED", "RECONSIDERATION_REVIEWED"):
            self._fail("case must be reviewed or settlement accepted before finalization")
        case_data["status"] = "FINALIZED"
        case_data["finalized_at"] = self._marker()
        case_data["final_note"] = self._bounded_str(note, 600)
        self.cases[case_id] = self._dumps(case_data)
        return case_id

    # ------------------------------------------------------------------
    # Views
    # ------------------------------------------------------------------

    @gl.public.view
    def get_case(self, case_id: str) -> str:
        return self.cases.get(str(case_id), "")

    @gl.public.view
    def get_response(self, response_id: str) -> str:
        return self.responses.get(str(response_id), "")

    @gl.public.view
    def get_evidence(self, evidence_id: str) -> str:
        return self.evidence.get(str(evidence_id), "")

    @gl.public.view
    def get_explanation(self, explanation_id: str) -> str:
        return self.explanations.get(str(explanation_id), "")

    @gl.public.view
    def get_review(self, case_id: str) -> str:
        return self.reviews.get(str(case_id), "")

    @gl.public.view
    def get_resolution_manifest(self, case_id: str) -> str:
        return self._build_case_manifest(str(case_id))

    @gl.public.view
    def get_settlement(self, settlement_id: str) -> str:
        return self.settlements.get(str(settlement_id), "")

    @gl.public.view
    def get_reconsideration(self, reconsideration_id: str) -> str:
        return self.reconsiderations.get(str(reconsideration_id), "")

    @gl.public.view
    def get_reconsideration_review(self, reconsideration_id: str) -> str:
        return self.reconsideration_reviews.get(str(reconsideration_id), "")

    @gl.public.view
    def list_cases(self, offset: str, limit: str) -> str:
        try:
            start = max(0, int(offset))
        except Exception:
            start = 0
        try:
            n = int(limit)
        except Exception:
            n = 100
        if n <= 0:
            n = 100
        if n > 500:
            n = 500
        all_ids = self._safe_list(self.case_index.get("all", "[]"))
        return json.dumps(all_ids[start : start + n], separators=(",", ":"))

    @gl.public.view
    def get_party_cases(self, party: str) -> str:
        return self.party_cases.get(str(party), "[]")

    @gl.public.view
    def get_responses_for_case(self, case_id: str) -> str:
        return self.responses_by_case.get(str(case_id), "[]")

    @gl.public.view
    def get_evidence_for_case(self, case_id: str) -> str:
        return self.evidence_by_case.get(str(case_id), "[]")

    @gl.public.view
    def get_explanations_for_case(self, case_id: str) -> str:
        return self.explanations_by_case.get(str(case_id), "[]")

    @gl.public.view
    def get_settlements_for_case(self, case_id: str) -> str:
        return self.settlements_by_case.get(str(case_id), "[]")

    @gl.public.view
    def get_reconsiderations_for_case(self, case_id: str) -> str:
        return self.reconsiderations_by_case.get(str(case_id), "[]")

    @gl.public.view
    def get_owner(self) -> str:
        return str(self.owner)

    @gl.public.view
    def is_resolver_address(self, address: str) -> str:
        return "true" if self._is_resolver(str(address).strip()) else "false"

    @gl.public.view
    def get_config(self) -> str:
        return self._dumps(
            {
                "owner": str(self.owner),
                "paused": bool(self.paused),
                "review_fee": str(self.review_fee),
                "case_statuses": list(CASE_STATUSES),
                "liability_views": list(LIABILITY_VIEWS),
                "case_outcomes": list(CASE_OUTCOMES),
                "evidence_strength": list(EVIDENCE_STRENGTH),
                "settlement_actions": list(SETTLEMENT_ACTIONS),
            }
        )

    @gl.public.view
    def get_protocol_stats(self) -> str:
        return self._dumps(
            {
                "cases": str(self.case_count),
                "responses": str(self.response_count),
                "evidence": str(self.evidence_count),
                "explanations": str(self.explanation_count),
                "reviews": str(self.review_count),
                "settlements": str(self.settlement_count),
                "reconsiderations": str(self.reconsideration_count),
            }
        )
