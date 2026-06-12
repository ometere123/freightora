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
import { openSettlementPath, acceptSettlement } from "@/lib/genlayer/contract";
import { uid } from "@/lib/utils";

const schema = z.object({
  amount: z.number().min(0),
  currency: z.string().min(1),
  terms: z.string().min(10, "Min 10 chars"),
  action: z.string().min(1),
  expiry_date: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function SettlementPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const router = useRouter();
  const { account, connect } = useWallet();
  const [txState, setTxState] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [txMsg, setTxMsg] = useState("");
  const [txHash, setTxHash] = useState("");
  const [mode, setMode] = useState<"propose" | "accept">("propose");
  const [acceptId, setAcceptId] = useState("");

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { amount: 0, currency: "USD", action: "FULL_COMPENSATION" },
  });

  if (!account) return <NotAuthenticated message="Connect your wallet to continue." />;

  const onPropose = async (data: FormData) => {
    if (!account) { await connect(); return; }
    const settlementId = uid("SETT");
    const json = JSON.stringify({
      ...data,
      proposed_by: account,
      proposed_at: new Date().toISOString(),
      status: "PROPOSED",
    });
    setTxState("pending");
    setTxMsg("Proposing settlement…");
    setTxHash("");
    try {
      const r = await openSettlementPath(account, settlementId, caseId, json);
      setTxHash(typeof r === "string" ? r : "");
      setTxState("success");
      setTxMsg(`Settlement ${settlementId} proposed.`);
      setTimeout(() => router.push(`/cases/${caseId}`), 1500);
    } catch (e) {
      setTxState("error");
      setTxMsg(e instanceof Error ? e.message : "Transaction failed");
    }
  };

  const onAccept = async () => {
    if (!account) { await connect(); return; }
    if (!acceptId.trim()) return;
    setTxState("pending");
    setTxMsg(`Accepting settlement ${acceptId}…`);
    setTxHash("");
    try {
      const r = await acceptSettlement(account, acceptId.trim());
      setTxHash(typeof r === "string" ? r : "");
      setTxState("success");
      setTxMsg("Settlement accepted.");
      setTimeout(() => router.push(`/cases/${caseId}`), 1500);
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
          Settlement
        </h1>
        <p className="mb-5 text-sm text-fog-grey">Propose or accept a settlement for this cargo exception.</p>

        <TxBanner state={txState} message={txMsg} hash={txHash} onDismiss={() => setTxState("idle")} />

        {/* Mode toggle */}
        <div className="mb-5 flex gap-2">
          <button
            onClick={() => setMode("propose")}
            className={mode === "propose" ? "btn-settlement" : "btn-ghost text-sm"}
          >
            Propose Settlement
          </button>
          <button
            onClick={() => setMode("accept")}
            className={mode === "accept" ? "btn-settlement" : "btn-ghost text-sm"}
          >
            Accept Settlement
          </button>
        </div>

        {!account && (
          <div className="panel-orange p-4 mb-7">
            <button onClick={() => void connect()} className="btn-primary text-sm">Connect Wallet</button>
          </div>
        )}

        {mode === "propose" && (
          <form onSubmit={handleSubmit(onPropose)} className="panel p-5 space-y-7">
            <div>
              <label className="field-label">Settlement Action</label>
              <select {...register("action")} className="field-input">
                {SETTLEMENT_ACTIONS.map((a) => (
                  <option key={a} value={a}>{a.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label className="field-label">Amount</label>
                <input
                  {...register("amount", { valueAsNumber: true })}
                  type="number"
                  min="0"
                  step="0.01"
                  className="field-input"
                />
                {errors.amount && <p className="field-error">{errors.amount.message}</p>}
              </div>
              <div>
                <label className="field-label">Currency</label>
                <select {...register("currency")} className="field-input">
                  <option>USD</option>
                  <option>EUR</option>
                  <option>GBP</option>
                  <option>OTHER</option>
                </select>
              </div>
            </div>

            <div>
              <label className="field-label">Terms *</label>
              <textarea {...register("terms")} rows={3} className="field-input"
                placeholder="Describe the settlement terms…" />
              {errors.terms && <p className="field-error">{errors.terms.message}</p>}
            </div>

            <div>
              <label className="field-label">Expiry Date</label>
              <input {...register("expiry_date")} type="date" className="field-input" />
            </div>

            <button
              type="submit"
              disabled={!account || txState === "pending"}
              className="btn-settlement w-full disabled:opacity-40"
            >
              {txState === "pending" ? "Proposing…" : "Propose Settlement"}
            </button>
          </form>
        )}

        {mode === "accept" && (
          <div className="panel p-5 space-y-7">
            <div>
              <label className="field-label">Settlement ID to Accept</label>
              <input
                type="text"
                value={acceptId}
                onChange={(e) => setAcceptId(e.target.value)}
                className="field-input mono-font"
                placeholder="SETT-…"
              />
            </div>
            <button
              onClick={() => void onAccept()}
              disabled={!account || !acceptId.trim() || txState === "pending"}
              className="btn-settlement w-full disabled:opacity-40"
            >
              {txState === "pending" ? "Accepting…" : "Accept Settlement"}
            </button>
          </div>
        )}
      </div>
    </Shell>
  );
}

const SETTLEMENT_ACTIONS = [
  "FULL_COMPENSATION", "PARTIAL_COMPENSATION",
  "REPLACEMENT_CARGO", "CREDIT_NOTE", "REPAIR_COST",
  "INSURANCE_CLAIM", "OTHER",
];
