"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Shell, Panel, TxBanner } from "@/components/shell";
import { AccessDenied, NotAuthenticated, AccessLoading } from "@/components/access-denied";
import { useAccessControl } from "@/lib/hooks/useAccessControl";
import { useWallet } from "@/lib/store";
import {
  getCase, getReview, getResponsesForCase, getEvidenceForCase,
  getExplanationsForCase, getSettlementsForCase, getReconsiderationsForCase,
  markReadyForReview, reviewException, finalizeCase, cancelCase,
} from "@/lib/genlayer/contract";
import {
  statusBadge, liabilityBadge, outcomeBadge, confColor, shortAddr, strengthBadge,
} from "@/lib/utils";
import type {
  CaseData, ReviewData, ResponseData, EvidenceData,
  ExplanationData, SettlementData, ReconsiderationData,
} from "@/lib/types";

export default function CaseDetailPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const router = useRouter();
  const { account, connect } = useWallet();
  const { loading: acLoading, isAdminOrResolver } = useAccessControl();

  const [accessChecked, setAccessChecked] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [review, setReview] = useState<ReviewData | null>(null);
  const [responses, setResponses] = useState<ResponseData[]>([]);
  const [evidence, setEvidence] = useState<EvidenceData[]>([]);
  const [explanations, setExplanations] = useState<ExplanationData[]>([]);
  const [settlements, setSettlements] = useState<SettlementData[]>([]);
  const [reconsiderations, setReconsiderations] = useState<ReconsiderationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [txState, setTxState] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [txMsg, setTxMsg] = useState("");
  const [txHash, setTxHash] = useState("");

  // Use refs so changing access-control state doesn't recreate the callback
  const accountRef = React.useRef(account);
  const isAdminOrResolverRef = React.useRef(isAdminOrResolver);
  accountRef.current = account;
  isAdminOrResolverRef.current = isAdminOrResolver;

  const load = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    setError("");
    try {
      const [c, rev, resps, evid, expl, sett, recon] = await Promise.allSettled([
        getCase(caseId),
        getReview(caseId),
        getResponsesForCase(caseId),
        getEvidenceForCase(caseId),
        getExplanationsForCase(caseId),
        getSettlementsForCase(caseId),
        getReconsiderationsForCase(caseId),
      ]);
      if (c.status === "fulfilled") {
        const cd = c.value as CaseData;
        setCaseData(cd);
        if (accountRef.current && cd) {
          const addr = accountRef.current.toLowerCase();
          const isParty =
            cd.claimant?.toLowerCase() === addr ||
            cd.respondent?.toLowerCase() === addr;
          setHasAccess(isParty || isAdminOrResolverRef.current);
        }
        setAccessChecked(true);
      } else {
        setError("Case not found");
        setAccessChecked(true);
      }
      if (rev.status === "fulfilled") setReview(rev.value as unknown as ReviewData);
      if (resps.status === "fulfilled") setResponses((resps.value as unknown as ResponseData[]) ?? []);
      if (evid.status === "fulfilled") setEvidence((evid.value as unknown as EvidenceData[]) ?? []);
      if (expl.status === "fulfilled") setExplanations((expl.value as unknown as ExplanationData[]) ?? []);
      if (sett.status === "fulfilled") setSettlements((sett.value as unknown as SettlementData[]) ?? []);
      if (recon.status === "fulfilled") setReconsiderations((recon.value as unknown as ReconsiderationData[]) ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load case");
      setAccessChecked(true);
    } finally {
      setLoading(false);
    }
  }, [caseId]); // only re-create when caseId changes

  useEffect(() => {
    if (!acLoading) void load();
  }, [load, acLoading]);

  async function doTx(label: string, fn: () => Promise<unknown>) {
    if (!account) { await connect(); return; }
    setTxState("pending");
    setTxMsg(`${label}…`);
    setTxHash("");
    try {
      const r = await fn();
      const hash = typeof r === "string" ? r : "";
      setTxHash(hash);
      setTxState("success");
      setTxMsg(`${label} submitted.`);
      await load();
    } catch (e) {
      setTxState("error");
      setTxMsg(e instanceof Error ? e.message : "Transaction failed");
    }
  }

  if (!account) return <NotAuthenticated message="Connect your wallet to view this case." />;
  if (acLoading || (loading && !accessChecked)) return <AccessLoading />;
  if (accessChecked && !hasAccess && !error) {
    return <AccessDenied message="You do not have access to this case. Only the claimant, respondent, assigned resolver, or admin can view private cargo disputes." />;
  }

  if (loading) {
    return (
      <Shell>
        <div className="panel p-12 text-center">
          <div className="scan-line mx-auto mb-3 h-px w-48" />
          <p className="mono-font text-sm text-fog-grey/60">Loading case {caseId}…</p>
        </div>
      </Shell>
    );
  }

  if (error || !caseData) {
    return (
      <Shell>
        <div className="panel-red p-8 text-center">
          <p className="h-font text-2xl uppercase tracking-[0.06em]">Case Not Found</p>
          <p className="mt-2 text-sm text-fog-grey">{error}</p>
          <button onClick={() => router.push("/cases")} className="btn-ghost mt-4 text-sm">
            ← Back to Cases
          </button>
        </div>
      </Shell>
    );
  }

  const isClaimant = account?.toLowerCase() === caseData.claimant?.toLowerCase();
  const isRespondent = account?.toLowerCase() === caseData.respondent?.toLowerCase();
  const isAuthorizedParty = isClaimant || isRespondent || isAdminOrResolver;
  const canMarkReady = isAuthorizedParty && !["READY_FOR_REVIEW", "UNDER_REVIEW", "REVIEWED", "FINALIZED", "CANCELLED"].includes(caseData.status);
  const canReview = isAuthorizedParty && caseData.status === "READY_FOR_REVIEW";
  const canFinalize = caseData.status === "REVIEWED" || caseData.status === "SETTLEMENT_ACCEPTED";
  const canCancel = isClaimant && !["FINALIZED", "CANCELLED"].includes(caseData.status);

  return (
    <Shell>
      {/* Breadcrumb */}
      <div className="mb-5 flex items-center gap-2 mono-font text-[10px] text-fog-grey/50">
        <Link href="/cases" className="hover:text-fog-grey/80">Cases</Link>
        <span>/</span>
        <span className="text-container-orange">{caseId}</span>
      </div>

      <TxBanner state={txState} message={txMsg} hash={txHash} onDismiss={() => setTxState("idle")} />

      {/* Case Header */}
      <div className="panel-orange p-5 mb-7">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="space-y-7">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`badge ${statusBadge(caseData.status)}`}>
                {caseData.status.replace(/_/g, " ")}
              </span>
              <span className="badge badge-paper">
                {caseData.exception_type?.replace(/_/g, " ") ?? "—"}
              </span>
            </div>
            <h1 className="h-font text-3xl lg:text-4xl font-medium uppercase tracking-[0.05em] text-manifest-paper">
              {caseId}
            </h1>
            <p className="text-sm text-fog-grey max-w-3xl">{caseData.description}</p>
          </div>
          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            {canMarkReady && (
              <button
                onClick={() => doTx("Mark Ready for Review", () => markReadyForReview(account!, caseId))}
                className="btn-consensus"
              >
                ⬡ Mark Ready
              </button>
            )}
            {canReview && (
              <button
                onClick={() => doTx("Request GenLayer Review", () => reviewException(account!, caseId))}
                className="btn-consensus"
              >
                ⬡ Request GenLayer Review
              </button>
            )}
            {canFinalize && (
              <button
                onClick={() => doTx("Finalize Case", () => finalizeCase(account!, caseId, "Finalized by claimant"))}
                className="btn-secondary"
              >
                Finalize
              </button>
            )}
            {canCancel && (
              <button
                onClick={() => doTx("Cancel Case", () => cancelCase(account!, caseId, "Cancelled by claimant"))}
                className="btn-ghost text-xs"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-7">

          {/* Exception Record */}
          <Panel title="Exception Record">
            <dl className="space-y-7">
              {RECORD_FIELDS.map(({ key: fieldKey, label }) => {
                const val = (caseData as unknown as Record<string, unknown>)[fieldKey];
                if (!val) return null;
                return (
                  <div key={fieldKey} className="stat-row">
                    <dt className="field-label mb-0">{label}</dt>
                    <dd className="mono-font text-xs text-manifest-paper text-right">{String(val)}</dd>
                  </div>
                );
              })}
            </dl>
          </Panel>

          {/* Review / AI Consensus */}
          {review && (
            <Panel title="Resolution Manifest" tone="cyan">
              <div className="space-y-5">
                <div className="flex flex-wrap gap-2">
                  <span className={`badge ${liabilityBadge(review.liability_view ?? "")}`}>
                    Liability: {(review.liability_view ?? "—").replace(/_/g, " ")}
                  </span>
                  <span className={`badge ${outcomeBadge(review.case_outcome ?? "")}`}>
                    {(review.case_outcome ?? "—").replace(/_/g, " ")}
                  </span>
                </div>

                {review.confidence !== undefined && (
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="field-label mb-0">Confidence</span>
                      <span className="mono-font text-xs" style={{ color: confColor(review.confidence) }}>
                        {review.confidence}%
                      </span>
                    </div>
                    <div className="conf-bar">
                      <div
                        className="h-full transition-all"
                        style={{
                          width: `${review.confidence}%`,
                          backgroundColor: confColor(review.confidence),
                        }}
                      />
                    </div>
                  </div>
                )}

                {review.reasoning && review.reasoning.length > 0 && (
                  <div>
                    <p className="field-label">AI Reasoning</p>
                    <ul className="space-y-1">
                      {review.reasoning.map((r, i) => (
                        <li key={i} className="text-sm text-fog-grey leading-relaxed">· {r}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {review.settlement_recommendation && (
                  <div>
                    <p className="field-label">Recommended Settlement</p>
                    <p className="text-sm text-manifest-paper">
                      {review.settlement_recommendation.action.replace(/_/g, " ")} —{" "}
                      {review.settlement_recommendation.recommended_amount}{" "}
                      {review.settlement_recommendation.currency}
                    </p>
                    {review.settlement_recommendation.rationale && (
                      <p className="text-xs text-fog-grey mt-1">{review.settlement_recommendation.rationale}</p>
                    )}
                  </div>
                )}
              </div>
            </Panel>
          )}

          {/* Responses */}
          {responses.length > 0 && (
            <Panel title={`Responses (${responses.length})`}>
              <div className="space-y-5">
                {responses.map((r) => (
                  <div key={r.response_id} className="border border-white/[0.06] p-3 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="mono-font text-xs text-container-orange">{r.response_id}</span>
                      <span className="mono-font text-[10px] text-fog-grey/50">{shortAddr(r.respondent ?? "")}</span>
                    </div>
                    <p className="text-sm text-fog-grey">{r.respondent_narrative ?? r.statement}</p>
                    {r.position && (
                      <span className="badge badge-paper text-[10px]">{r.position.replace(/_/g, " ")}</span>
                    )}
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {/* Evidence */}
          {evidence.length > 0 && (
            <Panel title={`Evidence (${evidence.length})`}>
              <div className="space-y-7">
                {evidence.map((e) => (
                  <div key={e.evidence_id} className="border border-white/[0.06] p-3 flex items-start gap-5">
                    <div
                      className="h-8 w-8 flex-shrink-0 flex items-center justify-center border border-signal-cyan/20 bg-signal-cyan/5 text-signal-cyan mono-font text-[9px]"
                    >
                      {(e.evidence_type ?? "DOC").slice(0, 3)}
                    </div>
                    <div className="min-w-0">
                      <p className="mono-font text-xs text-container-orange">{e.evidence_id}</p>
                      <p className="text-sm text-fog-grey truncate">{e.description}</p>
                      {e.strength && (
                        <span className={`badge ${strengthBadge(e.strength)} mt-1`}>{e.strength}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {/* Explanations */}
          {explanations.length > 0 && (
            <Panel title={`Explanations (${explanations.length})`}>
              <div className="space-y-5">
                {explanations.map((ex) => (
                  <div key={ex.explanation_id} className="border border-white/[0.06] p-3 space-y-1">
                    <span className="mono-font text-xs text-container-orange">{ex.explanation_id}</span>
                    <p className="text-sm text-fog-grey">{ex.explanation_text}</p>
                    {ex.explanation_type && (
                      <span className="badge badge-grey text-[10px]">{ex.explanation_type.replace(/_/g, " ")}</span>
                    )}
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {/* Settlements */}
          {settlements.length > 0 && (
            <Panel title={`Settlements (${settlements.length})`}>
              <div className="space-y-7">
                {settlements.map((s) => (
                  <div key={s.settlement_id} className="border border-white/[0.06] p-3 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="mono-font text-xs text-container-orange">{s.settlement_id}</span>
                      <span className={`badge ${statusBadge(s.status ?? "")}`}>{(s.status ?? "—").replace(/_/g, " ")}</span>
                    </div>
                    {s.amount && (
                      <p className="mono-font text-sm text-manifest-paper">
                        {s.amount} {s.currency ?? "USD"}
                      </p>
                    )}
                    {s.terms && <p className="text-sm text-fog-grey">{s.terms}</p>}
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {/* Reconsiderations */}
          {reconsiderations.length > 0 && (
            <Panel title={`Reconsiderations (${reconsiderations.length})`}>
              <div className="space-y-7">
                {reconsiderations.map((rc) => (
                  <div key={rc.reconsideration_id} className="border border-white/[0.06] p-3 space-y-1">
                    <span className="mono-font text-xs text-container-orange">{rc.reconsideration_id}</span>
                    <p className="text-sm text-fog-grey">{rc.grounds}</p>
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-7">
          <Panel title="Actions">
            <div className="flex flex-col gap-3">
              <Link href={`/cases/${caseId}/respond`} className="btn-secondary w-full justify-center text-sm">
                Submit Response
              </Link>
              <Link href={`/cases/${caseId}/evidence`} className="btn-evidence w-full justify-center text-sm">
                Add Evidence
              </Link>
              <Link href={`/cases/${caseId}/settlement`} className="btn-settlement w-full justify-center text-sm">
                Propose Settlement
              </Link>
              <Link href={`/cases/${caseId}/reconsideration`} className="btn-escalate w-full justify-center text-sm">
                Open Reconsideration
              </Link>
              {isAdminOrResolver && (
                <Link href={`/resolve?caseId=${caseId}`} className="btn-consensus w-full justify-center text-sm">
                  ⬡ Resolution Queue
                </Link>
              )}
            </div>
          </Panel>

          <Panel title="Case Meta" tone="paper">
            <dl className="space-y-7">
              <div className="stat-row">
                <dt className="field-label mb-0">Case ID</dt>
                <dd className="mono-font text-[10px] text-container-orange">{caseId}</dd>
              </div>
              <div className="stat-row">
                <dt className="field-label mb-0">Claimant</dt>
                <dd className="mono-font text-[10px]">{shortAddr(caseData.claimant)}</dd>
              </div>
              {caseData.respondent && (
                <div className="stat-row">
                  <dt className="field-label mb-0">Respondent</dt>
                  <dd className="mono-font text-[10px]">{shortAddr(caseData.respondent)}</dd>
                </div>
              )}
              {caseData.cargo_value && (
                <div className="stat-row">
                  <dt className="field-label mb-0">Value</dt>
                  <dd className="mono-font text-[10px]">
                    {caseData.cargo_value} {caseData.currency ?? "USD"}
                  </dd>
                </div>
              )}
              {caseData.created_at && (
                <div className="stat-row">
                  <dt className="field-label mb-0">Opened</dt>
                  <dd className="mono-font text-[10px]">
                    {new Date(caseData.created_at).toLocaleDateString()}
                  </dd>
                </div>
              )}
            </dl>
          </Panel>
        </div>
      </div>
    </Shell>
  );
}

const RECORD_FIELDS = [
  { key: "exception_type", label: "Exception Type" },
  { key: "shipper", label: "Shipper" },
  { key: "carrier", label: "Carrier" },
  { key: "cargo_description", label: "Cargo" },
  { key: "shipment_id", label: "Shipment ID" },
  { key: "tracking_number", label: "Tracking #" },
  { key: "route_origin", label: "Origin" },
  { key: "route_destination", label: "Destination" },
  { key: "shipment_date", label: "Shipment Date" },
  { key: "exception_date", label: "Exception Date" },
  { key: "claimant_statement", label: "Claimant Statement" },
];
