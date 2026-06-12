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
import { submitResponse } from "@/lib/genlayer/contract";
import { uid } from "@/lib/utils";

const schema = z.object({
  statement: z.string().min(10, "Min 10 chars required"),
  position: z.string().min(1, "Required"),
  counter_description: z.string().optional(),
  proposed_resolution: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const POSITIONS = [
  "NOT_LIABLE", "PARTIALLY_LIABLE", "FULLY_LIABLE",
  "DISPUTED", "PENDING_INVESTIGATION", "WILLING_TO_SETTLE",
];

export default function RespondPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const router = useRouter();
  const { account, connect } = useWallet();
  const [txState, setTxState] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [txMsg, setTxMsg] = useState("");
  const [txHash, setTxHash] = useState("");

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { position: "NOT_LIABLE" },
  });

  if (!account) return <NotAuthenticated message="Connect your wallet to continue." />;

  const onSubmit = async (data: FormData) => {
    if (!account) { await connect(); return; }
    const responseId = uid("RESP");
    const responseJson = JSON.stringify({
      respondent_narrative: data.statement,   // contract field name
      position: data.position,
      counter_description: data.counter_description ?? "",
      proposed_resolution: data.proposed_resolution ?? "",
      respondent: account,
      submitted_at: new Date().toISOString(),
    });
    setTxState("pending");
    setTxMsg("Submitting response…");
    setTxHash("");
    try {
      const r = await submitResponse(account, responseId, caseId, responseJson);
      setTxHash(typeof r === "string" ? r : "");
      setTxState("success");
      setTxMsg("Response submitted.");
      setTimeout(() => router.push(`/cases/${caseId}`), 1500);
    } catch (e) {
      setTxState("error");
      setTxMsg(e instanceof Error ? e.message : "Transaction failed");
    }
  };

  return (
    <Shell>
      <div className="mx-auto max-w-3xl">
        <div className="mb-2 mono-font text-[10px] text-fog-grey/50 flex items-center gap-2">
          <Link href={`/cases/${caseId}`} className="hover:text-fog-grey/80">← {caseId}</Link>
        </div>

        <h1 className="h-font mb-1 text-4xl font-medium uppercase tracking-[0.06em] text-manifest-paper">
          Submit Response
        </h1>
        <p className="mb-5 text-sm text-fog-grey">Respond to this cargo exception as the respondent party.</p>

        <TxBanner state={txState} message={txMsg} hash={txHash} onDismiss={() => setTxState("idle")} />

        {!account && (
          <div className="panel-orange p-4 mb-7">
            <button onClick={() => void connect()} className="btn-primary text-sm">Connect Wallet</button>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="panel p-5 space-y-7">
          <div>
            <label className="field-label">Position *</label>
            <select {...register("position")} className="field-input">
              {POSITIONS.map((p) => (
                <option key={p} value={p}>{p.replace(/_/g, " ")}</option>
              ))}
            </select>
            {errors.position && <p className="field-error">{errors.position.message}</p>}
          </div>

          <div>
            <label className="field-label">Statement *</label>
            <textarea {...register("statement")} rows={4} className="field-input"
              placeholder="Your formal response to this cargo exception…" />
            {errors.statement && <p className="field-error">{errors.statement.message}</p>}
          </div>

          <div>
            <label className="field-label">Counter Description</label>
            <textarea {...register("counter_description")} rows={2} className="field-input"
              placeholder="Alternative account of events…" />
          </div>

          <div>
            <label className="field-label">Proposed Resolution</label>
            <textarea {...register("proposed_resolution")} rows={2} className="field-input"
              placeholder="If you are willing to resolve, state your terms…" />
          </div>

          <button
            type="submit"
            disabled={!account || txState === "pending"}
            className="btn-primary w-full disabled:opacity-40"
          >
            {txState === "pending" ? "Submitting…" : "Submit Response"}
          </button>
        </form>
      </div>
    </Shell>
  );
}
