"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Shell, TxBanner } from "@/components/shell";
import { AccessDenied, NotAuthenticated, AccessLoading } from "@/components/access-denied";
import { useWallet } from "@/lib/store";
import { useAccessControl } from "@/lib/hooks/useAccessControl";
import {
  markReadyForReview,
  reviewException,
  reviewReconsideration,
  submitExplanation,
  listAllCases,
  getCase,
  REVIEW_FEE,
} from "@/lib/genlayer/contract";
import { statusBadge, uid, shortAddr } from "@/lib/utils";
import type { CaseData } from "@/lib/types";

const REVIEW_STATUSES = new Set(["READY_FOR_REVIEW", "READY_FOR_RECONSIDERATION_REVIEW"]);
const ACTIVE_STATUSES = new Set([
  "OPENED", "CLAIM_EVIDENCE_SUBMITTED", "RESPONDED", "EXPLANATIONS_SUBMITTED",
  "READY_FOR_REVIEW", "UNDER_REVIEW", "REVIEWED",
  "SETTLEMENT_PROPOSED", "RECONSIDERATION_REQUESTED", "READY_FOR_RECONSIDERATION_REVIEW",
]);

async function loadCasesById(ids: string[]): Promise<CaseData[]> {
  const results = await Promise.allSettled(ids.map((id) => getCase(id)));
  return results
    .filter((r): r is PromiseFulfilledResult<unknown> => r.status === "fulfilled")
    .map((r) => r.value as CaseData)
    .filter(Boolean);
}

const EXPL_TYPES = [
  "RESOLVER_ASSESSMENT", "CARRIER_EXPLANATION", "SHIPPER_EXPLANATION",
  "WAREHOUSE_EXPLANATION", "EXPERT_OPINION", "TIMELINE_CLARIFICATION", "OTHER",
];

function ResolveContent() {
  const searchParams = useSearchParams();
  const { account, connect } = useWallet();
  const { loading: acLoading, isAdminOrResolver } = useAccessControl();

  const [txState, setTxState] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [txMsg, setTxMsg] = useState("");
  const [txHash, setTxHash] = useState("");

  const [caseIdInput, setCaseIdInput] = useState(searchParams.get("caseId") ?? "");
  const [explText, setExplText] = useState("");
  const [explType, setExplType] = useState("RESOLVER_ASSESSMENT");

  const [reviewQueue, setReviewQueue] = useState<CaseData[]>([]);
  const [reconQueue, setReconQueue] = useState<CaseData[]>([]);
  const [activeCases, setActiveCases] = useState<CaseData[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);

  const loadQueues = useCallback(async () => {
    if (!isAdminOrResolver) return;
    setQueueLoading(true);
    try {
      const ids = await listAllCases(0, 200);
      const cases = await loadCasesById(ids);
      setReviewQueue(cases.filter((c) => c.status === "READY_FOR_REVIEW"));
      setReconQueue(cases.filter((c) => c.status === "READY_FOR_RECONSIDERATION_REVIEW"));
      setActiveCases(cases.filter((c) => ACTIVE_STATUSES.has(c.status)).slice(0, 10));
    } catch {
      // silently fail — queues stay empty
    } finally {
      setQueueLoading(false);
    }
  }, [isAdminOrResolver]);

  useEffect(() => {
    if (isAdminOrResolver) void loadQueues();
  }, [isAdminOrResolver, loadQueues]);

  async function doTx(label: string, fn: () => Promise<unknown>) {
    if (!account) { await connect(); return; }
    setTxState("pending");
    setTxMsg(`${label}…`);
    setTxHash("");
    try {
      const r = await fn();
      setTxHash(typeof r === "string" ? r : "");
      setTxState("success");
      setTxMsg(`${label} submitted.`);
      void loadQueues();
    } catch (e) {
      setTxState("error");
      setTxMsg(e instanceof Error ? e.message : "Transaction failed");
    }
  }

  if (!account) return <NotAuthenticated message="Resolution queue requires a connected wallet." />;
  if (acLoading) return <AccessLoading />;
  if (!isAdminOrResolver) return <AccessDenied message="Resolution queue is restricted to registered resolvers and the contract admin." />;

  const feeGEN = (Number(REVIEW_FEE) / 1e18).toFixed(2);

  return (
    <Shell>
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-10">
          <h1 className="h-font text-3xl font-medium uppercase tracking-[0.06em] text-manifest-paper sm:text-4xl">
            Resolution Queue
          </h1>
          <p className="mt-1 text-sm text-fog-grey">
            Operator queue — trigger GenLayer consensus review on ready cases.
            Operators do not decide verdicts. GenLayer validators are the judge.
          </p>
        </div>

        <TxBanner state={txState} message={txMsg} hash={txHash} onDismiss={() => setTxState("idle")} />

        {/* Review Fee notice */}
        <div className="panel-cyan p-3 mb-5 flex flex-wrap items-center gap-3 sm:gap-5">
          <span className="mono-font text-xs text-signal-cyan">Review fee:</span>
          <span className="mono-font text-xs text-manifest-paper font-medium">{feeGEN} GEN ({String(REVIEW_FEE)} wei)</span>
          <span className="mono-font text-xs text-fog-grey/50">— charged per consensus trigger</span>
        </div>

        {/* Review Queue */}
        <section className="mb-10">
          <QueueHeader label="⬡ Ready for GenLayer Review" count={reviewQueue.length} onRefresh={() => void loadQueues()} loading={queueLoading} />
          {queueLoading ? (
            <QueueLoading />
          ) : reviewQueue.length === 0 ? (
            <EmptyQueue text="No cases awaiting review." />
          ) : (
            <div className="space-y-3">
              {reviewQueue.map((c) => (
                <QueueCard
                  key={c.case_id}
                  data={c}
                  action="review"
                  disabled={txState === "pending"}
                  onTrigger={() =>
                    doTx(`Trigger review ${c.case_id}`, () => reviewException(account, c.case_id))
                  }
                />
              ))}
            </div>
          )}
        </section>

        {/* Reconsideration Queue */}
        <section className="mb-10">
          <QueueHeader label="⬡ Ready for Reconsideration Review" count={reconQueue.length} onRefresh={() => void loadQueues()} loading={queueLoading} />
          {queueLoading ? (
            <QueueLoading />
          ) : reconQueue.length === 0 ? (
            <EmptyQueue text="No reconsiderations awaiting review." />
          ) : (
            <div className="space-y-3">
              {reconQueue.map((c) => (
                <QueueCard
                  key={c.case_id}
                  data={c}
                  action="reconsideration"
                  disabled={txState === "pending"}
                  onTrigger={() => {
                    const reconId = c.last_reconsideration_id ?? "";
                    return doTx(`Trigger recon review ${c.case_id}`,
                      () => reviewReconsideration(account, reconId));
                  }}
                />
              ))}
            </div>
          )}
        </section>

        {/* Manual Case Target */}
        <div className="panel p-5 mb-7">
          <h2 className="h-font text-xl uppercase tracking-[0.06em] text-manifest-paper mb-3">
            Target a Specific Case
          </h2>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={caseIdInput}
              onChange={(e) => setCaseIdInput(e.target.value)}
              className="field-input mono-font flex-1"
              placeholder="CASE-…"
            />
            <button
              onClick={() => doTx("Mark Ready", () => markReadyForReview(account, caseIdInput.trim()))}
              disabled={!caseIdInput.trim() || txState === "pending"}
              className="btn-secondary text-sm disabled:opacity-40"
            >
              Mark Ready
            </button>
            <button
              onClick={() => doTx("Trigger Review", () => reviewException(account, caseIdInput.trim()))}
              disabled={!caseIdInput.trim() || txState === "pending"}
              className="btn-consensus text-sm disabled:opacity-40"
            >
              ⬡ Trigger Review
            </button>
          </div>
          {caseIdInput.trim() && (
            <div className="mt-2">
              <Link href={`/cases/${caseIdInput.trim()}`} className="text-xs text-signal-cyan/70 hover:text-signal-cyan">
                View case detail →
              </Link>
            </div>
          )}
        </div>

        {/* Submit Explanation */}
        <div className="panel mt-4 p-5 space-y-5">
          <h2 className="h-font text-2xl uppercase tracking-[0.06em] text-manifest-paper">
            Submit Explanation
          </h2>
          <p className="text-sm text-fog-grey">
            Provide a resolver or expert explanation for a case. Used by GenLayer validators during review.
          </p>
          <div>
            <label className="field-label">Target Case ID</label>
            <input
              type="text"
              value={caseIdInput}
              onChange={(e) => setCaseIdInput(e.target.value)}
              className="field-input mono-font"
              placeholder="CASE-…"
            />
          </div>
          <div>
            <label className="field-label">Explanation Type</label>
            <select value={explType} onChange={(e) => setExplType(e.target.value)} className="field-input">
              {EXPL_TYPES.map((t) => (
                <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Explanation Text</label>
            <textarea
              rows={4}
              value={explText}
              onChange={(e) => setExplText(e.target.value)}
              className="field-input"
              placeholder="Provide a detailed explanation to aid the GenLayer review…"
            />
          </div>
          <button
            onClick={() => {
              const id = uid("EXPL");
              const json = JSON.stringify({
                explanation_type: explType,
                narrative: explText,
                submitted_by: account,
                submitted_at: new Date().toISOString(),
              });
              void doTx("Submit Explanation", () => submitExplanation(account, id, caseIdInput.trim(), json));
            }}
            disabled={!caseIdInput.trim() || !explText.trim() || txState === "pending"}
            className="btn-evidence w-full disabled:opacity-40"
          >
            {txState === "pending" ? "Submitting…" : "Submit Explanation"}
          </button>
        </div>

        {/* Active Cases Overview */}
        {activeCases.length > 0 && (
          <div className="mt-6">
            <h2 className="h-font text-xl uppercase tracking-[0.06em] text-manifest-paper mb-3">
              Active Cases
            </h2>
            <div className="space-y-2">
              {activeCases.map((c) => (
                <Link
                  key={c.case_id}
                  href={`/cases/${c.case_id}`}
                  className="container-card flex items-center justify-between p-4 hover:opacity-90 transition-opacity"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="mono-font text-xs text-container-orange flex-shrink-0">{c.case_id}</span>
                    <span className={`badge ${statusBadge(c.status)} flex-shrink-0`}>
                      {c.status.replace(/_/g, " ")}
                    </span>
                    <span className="text-sm text-fog-grey truncate">
                      {c.shipment_summary || c.claimant_narrative || "—"}
                    </span>
                  </div>
                  <span className="mono-font text-[10px] text-signal-cyan/60 flex-shrink-0 ml-3">
                    {REVIEW_STATUSES.has(c.status) ? "⬡ Review ready" : "View →"}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* How It Works */}
        <div className="panel-paper mt-6 p-5 space-y-3">
          <h3 className="h-font text-xl uppercase tracking-[0.06em] text-manifest-paper">
            How GenLayer Review Works
          </h3>
          <p className="text-sm text-fog-grey leading-relaxed">
            Triggering <em className="text-signal-cyan">Send to Consensus</em> spawns multiple non-deterministic
            GenLayer validators. Each independently reads all on-chain evidence and produces a liability assessment.
            Validators reach consensus through the protocol — the agreed ruling is written immutably to the contract.
          </p>
          <p className="text-sm text-fog-grey leading-relaxed">
            <strong className="text-manifest-paper">Operators do not decide outcomes.</strong> The{" "}
            <span className="text-signal-cyan">Trigger Review</span> button only starts the GenLayer validator process.
            The validator network is the sole judge of liability and settlement.
          </p>
        </div>
      </div>
    </Shell>
  );
}

function QueueHeader({
  label, count, onRefresh, loading,
}: { label: string; count: number; onRefresh: () => void; loading: boolean }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-2 border-b border-white/[0.06] pb-2">
      <span className="h-font text-xl uppercase tracking-[0.06em] text-signal-cyan sm:text-2xl">{label}</span>
      <div className="flex items-center gap-3">
        <span className="mono-font text-xs text-fog-grey/40">{count}</span>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="mono-font text-[10px] text-signal-cyan/50 hover:text-signal-cyan disabled:opacity-30"
        >
          {loading ? "…" : "↻ refresh"}
        </button>
      </div>
    </div>
  );
}

function QueueCard({
  data, action, disabled, onTrigger,
}: {
  data: CaseData;
  action: "review" | "reconsideration";
  disabled: boolean;
  onTrigger: () => void;
}) {
  return (
    <div className="container-card p-4 flex flex-wrap items-center justify-between gap-3">
      <div className="space-y-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mono-font text-xs text-container-orange">{data.case_id}</span>
          <span className="badge badge-paper">{data.exception_type?.replace(/_/g, " ") ?? "—"}</span>
        </div>
        <p className="text-sm text-fog-grey truncate max-w-md">
          {data.shipment_summary || data.claimant_narrative || "—"}
        </p>
        <div className="flex flex-wrap gap-3">
          <span className="mono-font text-[10px] text-fog-grey/50">
            Claimant: {shortAddr(data.claimant)}
          </span>
          {data.respondent && (
            <span className="mono-font text-[10px] text-fog-grey/50">
              Respondent: {shortAddr(data.respondent)}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Link href={`/cases/${data.case_id}`} className="btn-ghost text-xs">View</Link>
        <button
          onClick={onTrigger}
          disabled={disabled}
          className="btn-consensus text-xs disabled:opacity-40"
        >
          ⬡ {action === "review" ? "Trigger Review" : "Trigger Recon Review"}
        </button>
      </div>
    </div>
  );
}

function EmptyQueue({ text }: { text: string }) {
  return (
    <div className="panel p-5 text-center">
      <p className="text-sm text-fog-grey/50">{text}</p>
    </div>
  );
}

function QueueLoading() {
  return (
    <div className="panel p-5 text-center">
      <div className="scan-line mx-auto mb-2 h-px w-32" />
      <p className="mono-font text-xs text-fog-grey/40">Loading queue…</p>
    </div>
  );
}

export default function ResolvePage() {
  return (
    <Suspense>
      <ResolveContent />
    </Suspense>
  );
}
