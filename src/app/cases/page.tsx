"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Shell } from "@/components/shell";
import { NotAuthenticated, AccessLoading } from "@/components/access-denied";
import { useWallet } from "@/lib/store";
import { useAccessControl } from "@/lib/hooks/useAccessControl";
import { listAllCases, getPartyCases, getCase } from "@/lib/genlayer/contract";
import { statusBadge, shortAddr } from "@/lib/utils";
import type { CaseData } from "@/lib/types";

const PAGE_SIZE = 20;

async function loadCasesById(ids: string[]): Promise<CaseData[]> {
  const results = await Promise.allSettled(ids.map((id) => getCase(id)));
  return results
    .filter((r): r is PromiseFulfilledResult<unknown> => r.status === "fulfilled")
    .map((r) => r.value as CaseData)
    .filter(Boolean);
}

export default function CasesPage() {
  const { account } = useWallet();
  const { loading: acLoading, isOwner, isAdminOrResolver } = useAccessControl();

  const [cases, setCases] = useState<CaseData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [offset, setOffset] = useState(0);
  const [label, setLabel] = useState("");

  const load = useCallback(async (off: number) => {
    if (!account) return;
    setLoading(true);
    setError("");
    try {
      let fetchedCases: CaseData[] = [];

      if (isOwner) {
        // Admin sees all cases
        const ids = await listAllCases(off, PAGE_SIZE);
        fetchedCases = await loadCasesById(ids);
        setLabel("All Cases (Admin View)");
      } else if (isAdminOrResolver) {
        // Resolver sees all cases (full visibility needed to manage queues)
        const ids = await listAllCases(off, PAGE_SIZE);
        fetchedCases = await loadCasesById(ids);
        setLabel("All Cases (Resolver View)");
      } else {
        // Party: only see cases they're involved in
        const ids = await getPartyCases(account);
        const sliced = ids.slice(off, off + PAGE_SIZE);
        fetchedCases = await loadCasesById(sliced);
        setLabel("My Cases");
      }

      setCases(fetchedCases);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load cases");
    } finally {
      setLoading(false);
    }
  }, [account, isOwner, isAdminOrResolver]);

  useEffect(() => {
    if (account && !acLoading) void load(offset);
  }, [account, acLoading, load, offset]);

  if (!account) return <NotAuthenticated message="Connect your wallet to view cases you are involved in." />;
  if (acLoading) return <AccessLoading />;

  return (
    <Shell>
      <div className="mb-6 flex items-center justify-between gap-7">
        <div>
          <h1 className="h-font text-4xl font-medium uppercase tracking-[0.06em] text-manifest-paper">
            {label || "Cases"}
          </h1>
          <p className="mt-1 mono-font text-[11px] uppercase tracking-[0.15em] text-fog-grey/60">
            {isOwner
              ? "Protocol-wide case registry — admin view"
              : isAdminOrResolver
              ? "All active cases — resolver view"
              : "Cases where you are the claimant or respondent"}
          </p>
        </div>
        <Link href="/open-case" className="btn-primary">▣ Open Case</Link>
      </div>

      {loading && (
        <div className="panel p-8 text-center">
          <div className="scan-line mx-auto mb-3 h-px w-48" />
          <p className="mono-font text-sm text-fog-grey/60">Loading cases…</p>
        </div>
      )}

      {error && (
        <div className="panel-red p-5 mb-7">
          <p className="text-sm text-fog-grey">{error}</p>
          <button onClick={() => void load(offset)} className="btn-ghost mt-3 text-xs">Retry</button>
        </div>
      )}

      {!loading && !error && cases.length === 0 && (
        <div className="panel p-12 text-center">
          <p className="h-font text-2xl uppercase tracking-[0.06em] text-fog-grey/50">No Cases Found</p>
          <p className="mt-2 text-sm text-fog-grey/40">
            {isAdminOrResolver
              ? "No cases have been opened on this protocol yet."
              : "You are not a party to any cases. Open one to get started."}
          </p>
          <Link href="/open-case" className="btn-primary mt-6 inline-flex">▣ Open Case</Link>
        </div>
      )}

      {!loading && cases.length > 0 && (
        <div className="space-y-7">
          {cases.map((c) => <CaseRow key={c.case_id} data={c} account={account} />)}
        </div>
      )}

      {!loading && cases.length > 0 && (
        <div className="mt-6 flex items-center justify-between gap-5">
          <button
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            disabled={offset === 0}
            className="btn-ghost text-xs disabled:opacity-30"
          >
            ← Previous
          </button>
          <span className="mono-font text-xs text-fog-grey/50">
            Showing {offset + 1}–{offset + cases.length}
          </span>
          <button
            onClick={() => setOffset(offset + PAGE_SIZE)}
            disabled={cases.length < PAGE_SIZE}
            className="btn-ghost text-xs disabled:opacity-30"
          >
            Next →
          </button>
        </div>
      )}
    </Shell>
  );
}

function CaseRow({ data, account }: { data: CaseData; account: string }) {
  const badge = statusBadge(data.status);
  const isClaimant = data.claimant?.toLowerCase() === account.toLowerCase();
  const isRespondent = data.respondent?.toLowerCase() === account.toLowerCase();
  const myRole = isClaimant ? "claimant" : isRespondent ? "respondent" : null;

  return (
    <Link
      href={`/cases/${data.case_id}`}
      className="container-card block p-4 transition-opacity hover:opacity-90"
    >
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mono-font text-xs text-container-orange">{data.case_id}</span>
            <span className={`badge ${badge}`}>{data.status?.replace(/_/g, " ") ?? "—"}</span>
            <span className="badge badge-paper">{data.exception_type?.replace(/_/g, " ") ?? "—"}</span>
            {myRole && (
              <span className={`badge ${myRole === "claimant" ? "badge-cyan" : "badge-yellow"}`}>
                {myRole}
              </span>
            )}
          </div>
          <p className="text-sm text-manifest-paper truncate max-w-2xl">
            {data.shipment_summary || data.claimant_narrative || "No description provided"}
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-1">
            <span className="mono-font text-[10px] text-fog-grey/50">
              Claimant: {shortAddr(data.claimant)}
            </span>
            {data.respondent && (
              <span className="mono-font text-[10px] text-fog-grey/50">
                Respondent: {shortAddr(data.respondent)}
              </span>
            )}
            {(data.claim_amount > 0 || data.cargo_value) && (
              <span className="mono-font text-[10px] text-fog-grey/50">
                {data.cargo_value ?? data.claim_amount} {data.currency ?? "USD"}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className="mono-font text-[10px] text-fog-grey/40">
            {data.created_at ? new Date(data.created_at).toLocaleDateString() : "—"}
          </span>
          <span className="mono-font text-[10px] text-signal-cyan/60">View →</span>
        </div>
      </div>
    </Link>
  );
}
