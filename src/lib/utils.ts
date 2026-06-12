export function shortAddr(addr: string): string {
  if (!addr || addr.length < 10) return addr ?? "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function uid(prefix: string): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `${prefix}-${ts}-${rand}`;
}

export function statusBadge(status: string): string {
  const m: Record<string, string> = {
    OPENED: "badge-cyan",
    OPEN: "badge-cyan",
    CLAIM_EVIDENCE_SUBMITTED: "badge-yellow",
    EVIDENCE_SUBMITTED: "badge-yellow",
    RESPONDED: "badge-cyan",
    EXPLANATIONS_SUBMITTED: "badge-yellow",
    READY_FOR_REVIEW: "badge-orange",
    UNDER_REVIEW: "badge-purple",
    REVIEWED: "badge-green",
    SETTLEMENT_PROPOSED: "badge-teal",
    SETTLEMENT_ACCEPTED: "badge-green",
    RECONSIDERATION_REQUESTED: "badge-yellow",
    RECONSIDERATION_OPENED: "badge-yellow",
    READY_FOR_RECONSIDERATION_REVIEW: "badge-orange",
    RECONSIDERATION_REVIEWED: "badge-green",
    FINALIZED: "badge-green",
    CANCELLED: "badge-red",
  };
  return m[status] ?? "badge-grey";
}

export function liabilityBadge(view: string): string {
  if (!view) return "badge-grey";
  if (view === "CLAIMANT_STRONG" || view === "CLAIMANT_PARTIAL") return "badge-cyan";
  if (view === "RESPONDENT_STRONG" || view === "RESPONDENT_PARTIAL") return "badge-yellow";
  if (view === "CARRIER_PRIMARY") return "badge-orange";
  if (view === "SHIPPER_PRIMARY") return "badge-yellow";
  if (view === "WAREHOUSE_PRIMARY") return "badge-purple";
  if (view === "SHARED") return "badge-teal";
  if (view === "NO_LIABILITY_SHOWN") return "badge-grey";
  if (view.includes("CARRIER")) return "badge-orange";
  if (view.includes("SHIPPER")) return "badge-yellow";
  if (view.includes("WAREHOUSE")) return "badge-purple";
  if (view.includes("MIXED") || view.includes("SHARED")) return "badge-teal";
  return "badge-grey";
}

export function outcomeBadge(outcome: string): string {
  if (!outcome) return "badge-grey";
  if (outcome === "CLAIMANT_SUPPORTED") return "badge-green";
  if (outcome === "RESPONDENT_SUPPORTED") return "badge-yellow";
  if (outcome === "REJECT_CLAIM") return "badge-red";
  if (outcome === "SHARED_LIABILITY") return "badge-teal";
  if (outcome === "INSUFFICIENT_EVIDENCE" || outcome === "NEEDS_MORE_RECORDS") return "badge-yellow";
  if (outcome === "SETTLEMENT_RECOMMENDED") return "badge-teal";
  if (outcome.includes("LIABLE")) return "badge-orange";
  if (outcome.includes("EXTERNAL")) return "badge-grey";
  return "badge-grey";
}

export function confColor(n: number): string {
  if (n >= 75) return "#38b000";
  if (n >= 50) return "#ffd23f";
  if (n >= 25) return "#ff6a00";
  return "#b23a2e";
}

export function strengthBadge(s: string): string {
  if (s === "STRONG") return "badge-green";
  if (s === "MODERATE") return "badge-yellow";
  if (s === "WEAK") return "badge-orange";
  if (s === "CONFLICTING") return "badge-purple";
  return "badge-red";
}
