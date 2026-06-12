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
import { addEvidence } from "@/lib/genlayer/contract";
import { uid } from "@/lib/utils";

const schema = z.object({
  evidence_type: z.string().min(1, "Required"),
  description: z.string().min(5, "Min 5 chars"),
  document_url: z.string().optional(),
  document_hash: z.string().optional(),
  source: z.string().optional(),
  timestamp: z.string().optional(),
  content: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const EVIDENCE_TYPES = [
  "PHOTO", "DOCUMENT", "CARRIER_RECORD", "INSPECTION_REPORT",
  "BILL_OF_LADING", "INVOICE", "INSURANCE_DOCUMENT",
  "WEIGHT_CERTIFICATE", "TEMPERATURE_LOG", "WITNESS_STATEMENT", "OTHER",
];

export default function EvidencePage() {
  const { caseId } = useParams<{ caseId: string }>();
  const router = useRouter();
  const { account, connect } = useWallet();
  const [txState, setTxState] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [txMsg, setTxMsg] = useState("");
  const [txHash, setTxHash] = useState("");

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { evidence_type: "DOCUMENT" },
  });

  if (!account) return <NotAuthenticated message="Connect your wallet to continue." />;

  const onSubmit = async (data: FormData) => {
    if (!account) { await connect(); return; }
    const evidenceId = uid("EVID");
    const evidenceJson = JSON.stringify({
      ...data,
      submitted_by: account,
      submitted_at: new Date().toISOString(),
    });
    setTxState("pending");
    setTxMsg("Adding evidence…");
    setTxHash("");
    try {
      const r = await addEvidence(account, evidenceId, caseId, evidenceJson);
      setTxHash(typeof r === "string" ? r : "");
      setTxState("success");
      setTxMsg("Evidence added.");
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
          Add Evidence
        </h1>
        <p className="mb-5 text-sm text-fog-grey">
          Submit photos, documents, carrier records, or other evidence for case {caseId}.
        </p>

        <TxBanner state={txState} message={txMsg} hash={txHash} onDismiss={() => setTxState("idle")} />

        {!account && (
          <div className="panel-orange p-4 mb-7">
            <button onClick={() => void connect()} className="btn-primary text-sm">Connect Wallet</button>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="panel p-5 space-y-7">
          <div>
            <label className="field-label">Evidence Type *</label>
            <select {...register("evidence_type")} className="field-input">
              {EVIDENCE_TYPES.map((t) => (
                <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
              ))}
            </select>
            {errors.evidence_type && <p className="field-error">{errors.evidence_type.message}</p>}
          </div>

          <div>
            <label className="field-label">Description *</label>
            <textarea {...register("description")} rows={3} className="field-input"
              placeholder="Describe this evidence and its relevance…" />
            {errors.description && <p className="field-error">{errors.description.message}</p>}
          </div>

          <div>
            <label className="field-label">Document URL</label>
            <input {...register("document_url")} type="text" className="field-input"
              placeholder="https://… or IPFS hash" />
          </div>

          <div>
            <label className="field-label">Document Hash (SHA-256)</label>
            <input {...register("document_hash")} type="text" className="field-input mono-font"
              placeholder="0x… or sha256:…" />
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label className="field-label">Source</label>
              <input {...register("source")} type="text" className="field-input"
                placeholder="Carrier, Warehouse, Claimant…" />
            </div>
            <div>
              <label className="field-label">Timestamp</label>
              <input {...register("timestamp")} type="datetime-local" className="field-input" />
            </div>
          </div>

          <div>
            <label className="field-label">Additional Content / Notes</label>
            <textarea {...register("content")} rows={2} className="field-input"
              placeholder="Any additional details about this evidence…" />
          </div>

          <button
            type="submit"
            disabled={!account || txState === "pending"}
            className="btn-evidence w-full disabled:opacity-40"
          >
            {txState === "pending" ? "Adding…" : "Add Evidence"}
          </button>
        </form>
      </div>
    </Shell>
  );
}
