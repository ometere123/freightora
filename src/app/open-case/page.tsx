"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Shell, TxBanner } from "@/components/shell";
import { NotAuthenticated } from "@/components/access-denied";
import { useWallet } from "@/lib/store";
import { openCase } from "@/lib/genlayer/contract";
import { uid } from "@/lib/utils";
import { saveDraft, deleteDraft } from "@/lib/storage/drafts";

const schema = z.object({
  description: z.string().min(10, "Min 10 chars"),
  exception_type: z.string().min(1, "Required"),
  shipper: z.string().optional(),
  carrier: z.string().optional(),
  respondent: z.string().optional(),
  cargo_description: z.string().optional(),
  cargo_value: z.number().min(0),
  currency: z.string().min(1, "Required"),
  shipment_date: z.string().optional(),
  exception_date: z.string().min(1, "Required"),
  shipment_id: z.string().optional(),
  tracking_number: z.string().optional(),
  route_origin: z.string().optional(),
  route_destination: z.string().optional(),
  claimant_statement: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const EXCEPTION_TYPES = [
  "DAMAGE", "LOSS", "SHORT_DELIVERY", "WRONG_DELIVERY",
  "CONTAMINATION", "DELAY", "DOCUMENTATION_ERROR", "OTHER",
];

export default function OpenCasePage() {
  const router = useRouter();
  const { account, connect } = useWallet();
  const [txState, setTxState] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [txMsg, setTxMsg] = useState("");
  const [txHash, setTxHash] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      cargo_value: 0,
      currency: "USD",
      exception_type: "DAMAGE",
    },
  });

  if (!account) return <NotAuthenticated message="Connect your wallet to open a cargo exception case. Your wallet address will be recorded as the claimant." />;

  const onSubmit = async (data: FormData) => {
    if (!account) { await connect(); return; }

    const caseId = uid("CASE");
    const caseJson = JSON.stringify({
      claimant: account,
      respondent: data.respondent ?? "",
      shipment_summary: data.description,
      exception_type: data.exception_type,
      claim_amount: data.cargo_value,
      currency: data.currency,
      claimant_narrative: data.claimant_statement ?? "",
      // supplemental fields stored for UI display
      shipper: data.shipper ?? "",
      carrier: data.carrier ?? "",
      cargo_description: data.cargo_description ?? "",
      shipment_id: data.shipment_id ?? "",
      tracking_number: data.tracking_number ?? "",
      route_origin: data.route_origin ?? "",
      route_destination: data.route_destination ?? "",
      shipment_date: data.shipment_date ?? "",
      exception_date: data.exception_date,
    });

    setTxState("pending");
    setTxMsg("Submitting exception case to GenLayer…");
    setTxHash("");

    try {
      await saveDraft({ case_id: caseId, ...data });
      const result = await openCase(account, caseId, caseJson);
      const hash = typeof result === "string" ? result : "";
      setTxHash(hash);
      setTxState("success");
      setTxMsg(`Case ${caseId} opened successfully.`);
      await deleteDraft(caseId);
      setTimeout(() => router.push(`/cases/${caseId}`), 1800);
    } catch (e) {
      setTxState("error");
      const msg = e instanceof Error ? e.message : String(e);
      setTxMsg(msg || "Transaction failed — check console for details");
      console.error("[open-case] tx error:", e);
    }
  };

  return (
    <Shell>
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-10">
          <h1 className="h-font text-3xl font-medium uppercase tracking-[0.06em] text-manifest-paper sm:text-4xl">
            Open Exception Case
          </h1>
          <p className="mt-1 text-sm text-fog-grey">
            File a cargo exception. All fields are stored on-chain.
          </p>
        </div>

        <TxBanner
          state={txState}
          message={txMsg}
          hash={txHash}
          onDismiss={() => setTxState("idle")}
        />

        {!account && (
          <div className="panel-orange p-5 mb-8">
            <p className="text-sm text-fog-grey mb-3">Connect your wallet to open a case.</p>
            <button onClick={() => void connect()} className="btn-primary text-sm">
              Connect Wallet
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Exception Info */}
          <div className="panel p-5 space-y-7">
            <h2 className="h-font text-2xl uppercase tracking-[0.06em] text-manifest-paper">
              Exception Details
            </h2>

            <div>
              <label className="field-label">Exception Type *</label>
              <select {...register("exception_type")} className="field-input">
                {EXCEPTION_TYPES.map((t) => (
                  <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
                ))}
              </select>
              {errors.exception_type && <p className="field-error">{errors.exception_type.message}</p>}
            </div>

            <div>
              <label className="field-label">Description *</label>
              <textarea
                {...register("description")}
                rows={3}
                className="field-input"
                placeholder="Describe the cargo exception in detail…"
              />
              {errors.description && <p className="field-error">{errors.description.message}</p>}
            </div>

            <div>
              <label className="field-label">Claimant Statement</label>
              <textarea
                {...register("claimant_statement")}
                rows={2}
                className="field-input"
                placeholder="Your position on this exception…"
              />
            </div>

            <div>
              <label className="field-label">Exception Date *</label>
              <input {...register("exception_date")} type="date" className="field-input" />
              {errors.exception_date && <p className="field-error">{errors.exception_date.message}</p>}
            </div>
          </div>

          {/* Parties */}
          <div className="panel p-5 space-y-7">
            <h2 className="h-font text-2xl uppercase tracking-[0.06em] text-manifest-paper">Parties</h2>

            <div>
              <label className="field-label">Respondent Address</label>
              <input
                {...register("respondent")}
                type="text"
                className="field-input mono-font"
                placeholder="0x…"
              />
              <p className="mt-1 mono-font text-[10px] text-fog-grey/50">
                The party responding to this exception (carrier, warehouse, etc.)
              </p>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label className="field-label">Shipper</label>
                <input {...register("shipper")} type="text" className="field-input" placeholder="Shipper name" />
              </div>
              <div>
                <label className="field-label">Carrier</label>
                <input {...register("carrier")} type="text" className="field-input" placeholder="Carrier name" />
              </div>
            </div>
          </div>

          {/* Shipment */}
          <div className="panel p-5 space-y-7">
            <h2 className="h-font text-2xl uppercase tracking-[0.06em] text-manifest-paper">
              Shipment Details
            </h2>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label className="field-label">Shipment ID</label>
                <input {...register("shipment_id")} type="text" className="field-input mono-font" />
              </div>
              <div>
                <label className="field-label">Tracking Number</label>
                <input {...register("tracking_number")} type="text" className="field-input mono-font" />
              </div>
            </div>

            <div>
              <label className="field-label">Cargo Description</label>
              <input {...register("cargo_description")} type="text" className="field-input" />
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label className="field-label">Claim Amount *</label>
                <input
                  {...register("cargo_value", { valueAsNumber: true })}
                  type="number"
                  min="0"
                  step="0.01"
                  className="field-input"
                />
                {errors.cargo_value && <p className="field-error">{errors.cargo_value.message}</p>}
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

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label className="field-label">Origin</label>
                <input {...register("route_origin")} type="text" className="field-input" />
              </div>
              <div>
                <label className="field-label">Destination</label>
                <input {...register("route_destination")} type="text" className="field-input" />
              </div>
            </div>

            <div>
              <label className="field-label">Shipment Date</label>
              <input {...register("shipment_date")} type="date" className="field-input" />
            </div>
          </div>

          <button
            type="submit"
            disabled={!account || txState === "pending"}
            className="btn-primary w-full py-3 disabled:opacity-40"
          >
            {txState === "pending" ? "Submitting…" : "▣ Open Exception Case"}
          </button>
        </form>
      </div>
    </Shell>
  );
}
