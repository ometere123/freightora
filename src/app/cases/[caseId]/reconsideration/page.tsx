"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { Shell, TxBanner } from "@/components/shell";
import { NotAuthenticated } from "@/components/access-denied";
import { useWallet } from "@/lib/store";
import { openReconsideration, reviewReconsideration } from "@/lib/genlayer/contract";
import { uid } from "@/lib/utils";

const schema = z.object({
  grounds: z.string().min(20, "Min 20 chars — state clear grounds for reconsideration"),
  new_evidence_summary: z.string().optional(),
  requested_outcome: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function ReconsiderationPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const router = useRouter();
  const { account, connect } = useWallet();
  const [txState, setTxState] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [txMsg, setTxMsg] = useState("");
  const [txHash, setTxHash] = useState("");
  const [mode, setMode] = useState<"open" | "review">("open");
  const [reviewId, setReviewId] = useState("");

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  if (!account) return <NotAuthenticated message="Connect your wallet to continue." />;

  const onOpen = async (data: FormData) => {
    if (!account) { await connect(); return; }
    const reconId = uid("RECON");
    const json = JSON.stringify({
      ...data,
      opened_by: account,
      opened_at: new Date().toISOString(),
    });
    setTxState("pending");
    setTxMsg("Opening reconsideration…");
    setTxHash("");
    try {
      const r = await openReconsideration(account, reconId, caseId, json);
      setTxHash(typeof r === "string" ? r : "");
      setTxState("success");
      setTxMsg(`Reconsideration ${reconId} opened.`);
      setTimeout(() => router.push(`/cases/${caseId}`), 1500);
    } catch (e) {
      setTxState("error");
      setTxMsg(e instanceof Error ? e.message : "Transaction failed");
    }
  };

  const onReview = async () => {
    if (!account) { await connect(); return; }
    if (!reviewId.trim()) return;
    setTxState("pending");
    setTxMsg(`Reviewing reconsideration ${reviewId}…`);
    setTxHash("");
    try {
      const r = await reviewReconsideration(account, reviewId.trim());
      setTxHash(typeof r === "string" ? r : "");
      setTxState("success");
      setTxMsg("Reconsideration review submitted to AI consensus.");
      setTimeout(() => router.push(`/cases/${caseId}`), 1800);
    } catch (e) {
      setTxState("error");
      setTxMsg(e instanceof Error ? e.message : "Transaction failed");
    }
  };

  return (
    <Shell>
      <div className="mx-auto max-w-3xl">
        <div className="mb-2 mono-font text-[10px] text-fog-grey/50">
          <Link href={`/cases/${caseId}`} className="hover:text-fog-grey/80">← {caseId}</Link>
        </div>
        <h1 className="h-font mb-1 text-4xl font-medium uppercase tracking-[0.06em] text-manifest-paper">
          Reconsideration
        </h1>
        <p className="mb-5 text-sm text-fog-grey">
          Challenge the AI ruling with new grounds or evidence.
        </p>

        <TxBanner state={txState} message={txMsg} hash={txHash} onDismiss={() => setTxState("idle")} />

        <div className="mb-5 flex gap-2">
          <button
            onClick={() => setMode("open")}
            className={mode === "open" ? "btn-escalate" : "btn-ghost text-sm"}
          >
            Open Reconsideration
          </button>
          <button
            onClick={() => setMode("review")}
            className={mode === "review" ? "btn-escalate" : "btn-ghost text-sm"}
          >
            Review (Resolver)
          </button>
        </div>

        {!account && (
          <div className="panel-orange p-4 mb-7">
            <button onClick={() => void connect()} className="btn-primary text-sm">Connect Wallet</button>
          </div>
        )}

        {mode === "open" && (
          <form onSubmit={handleSubmit(onOpen)} className="panel p-5 space-y-7">
            <div>
              <label className="field-label">Grounds for Reconsideration *</label>
              <textarea {...register("grounds")} rows={4} className="field-input"
                placeholder="State clearly why the ruling should be reconsidered. What was missed or misinterpreted?" />
              {errors.grounds && <p className="field-error">{errors.grounds.message}</p>}
            </div>

            <div>
              <label className="field-label">New Evidence Summary</label>
              <textarea {...register("new_evidence_summary")} rows={2} className="field-input"
                placeholder="Describe any new evidence not previously reviewed…" />
            </div>

            <div>
              <label className="field-label">Requested Outcome</label>
              <input {...register("requested_outcome")} type="text" className="field-input"
                placeholder="What outcome are you seeking?" />
            </div>

            <button
              type="submit"
              disabled={!account || txState === "pending"}
              className="btn-escalate w-full disabled:opacity-40"
            >
              {txState === "pending" ? "Opening…" : "Open Reconsideration"}
            </button>
          </form>
        )}

        {mode === "review" && (
          <div className="panel p-5 space-y-7">
            <p className="text-sm text-fog-grey">
              Resolver-only: trigger AI consensus review on a reconsideration.
            </p>
            <div>
              <label className="field-label">Reconsideration ID</label>
              <input
                type="text"
                value={reviewId}
                onChange={(e) => setReviewId(e.target.value)}
                className="field-input mono-font"
                placeholder="RECON-…"
              />
            </div>
            <button
              onClick={() => void onReview()}
              disabled={!account || !reviewId.trim() || txState === "pending"}
              className="btn-consensus w-full disabled:opacity-40"
            >
              {txState === "pending" ? "Submitting…" : "⬡ Request AI Review"}
            </button>
          </div>
        )}
      </div>
    </Shell>
  );
}
