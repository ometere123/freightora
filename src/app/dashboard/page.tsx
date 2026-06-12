"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Shell } from "@/components/shell";
import { useWallet } from "@/lib/store";
import {
  getPartyCases,
  getCase,
  getOwner,
  isResolverAddress,
  listAllCases,
} from "@/lib/genlayer/contract";
import { statusBadge, shortAddr } from "@/lib/utils";
import type { CaseData } from "@/lib/types";

type Role = "claimant" | "respondent" | "resolver" | "admin" | "guest";

interface RoleContext {
  isOwner: boolean;
  isResolver: boolean;
  roles: Role[];
}

async function loadCasesById(ids: string[]): Promise<CaseData[]> {
  const results = await Promise.allSettled(ids.map((id) => getCase(id)));
  return results
    .filter((r): r is PromiseFulfilledResult<unknown> => r.status === "fulfilled")
    .map((r) => r.value as CaseData)
    .filter(Boolean);
}

export default function DashboardPage() {
  const { account, connect } = useWallet();
  const [roleCtx, setRoleCtx] = useState<RoleContext>({ isOwner: false, isResolver: false, roles: ["guest"] });
  const [myCases, setMyCases] = useState<CaseData[]>([]);
  const [reviewQueue, setReviewQueue] = useState<CaseData[]>([]);
  const [allCasesForAdmin, setAllCasesForAdmin] = useState<CaseData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (addr: string) => {
    setLoading(true);
    setError("");
    try {
      const [ownerRaw, resolverRaw] = await Promise.allSettled([
        getOwner(),
        isResolverAddress(addr),
      ]);

      const isOwner = ownerRaw.status === "fulfilled" &&
        ownerRaw.value.toLowerCase() === addr.toLowerCase();
      const isResolver = resolverRaw.status === "fulfilled" && resolverRaw.value === true;

      const roles: Role[] = [];
      if (isOwner) roles.push("admin");
      if (isResolver) roles.push("resolver");
      roles.push("claimant");
      roles.push("respondent");

      setRoleCtx({ isOwner, isResolver, roles });

      const [partyIds, adminIds] = await Promise.allSettled([
        getPartyCases(addr),
        (isOwner || isResolver) ? listAllCases(0, 100) : Promise.resolve([] as string[]),
      ]);

      const partyIdList = partyIds.status === "fulfilled" ? partyIds.value : [];
      const allIdList = adminIds.status === "fulfilled" ? adminIds.value : [];

      const [partyCases, allCases] = await Promise.all([
        loadCasesById(partyIdList),
        (isOwner || isResolver) ? loadCasesById(allIdList) : Promise.resolve([] as CaseData[]),
      ]);

      setMyCases(partyCases);

      if (isOwner || isResolver) {
        const queue = allCases.filter((c) =>
          c.status === "READY_FOR_REVIEW" || c.status === "READY_FOR_RECONSIDERATION_REVIEW"
        );
        setReviewQueue(queue);
        setAllCasesForAdmin(allCases.slice(0, 20));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (account) void load(account);
  }, [account, load]);

  if (!account) {
    return (
      <Shell>
        <div className="mx-auto max-w-4xl">
          <div className="mb-10">
            <h1 className="h-font text-4xl font-medium uppercase tracking-[0.06em] text-manifest-paper">
              Dashboard
            </h1>
            <p className="mt-1 text-sm text-fog-grey">
              Connect your wallet to access your cargo exception dashboard.
            </p>
          </div>
          <div className="panel-orange p-8 text-center space-y-7">
            <p className="text-sm text-fog-grey">
              Your dashboard shows cases where you are the claimant, respondent, assigned resolver,
              or protocol admin. Connect a wallet to continue.
            </p>
            <button onClick={() => void connect()} className="btn-primary">
              Connect Wallet
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-7">
          <div>
            <h1 className="h-font text-4xl font-medium uppercase tracking-[0.06em] text-manifest-paper">
              Dashboard
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="mono-font text-xs text-fog-grey/60">{shortAddr(account)}</span>
              {roleCtx.isOwner && <span className="badge badge-orange">Admin</span>}
              {roleCtx.isResolver && <span className="badge badge-purple">Resolver</span>}
            </div>
          </div>
          <Link href="/open-case" className="btn-primary text-sm">
            ▣ Open New Case
          </Link>
        </div>

        {error && (
          <div className="panel-red p-4 mb-5 text-sm text-fog-grey">{error}</div>
        )}

        {loading && (
          <div className="panel p-10 text-center mb-8">
            <div className="scan-line mx-auto mb-3 h-px w-48" />
            <p className="mono-font text-xs text-fog-grey/50">Loading your cases…</p>
          </div>
        )}

        {/* Admin / Resolver: review queue */}
        {!loading && (roleCtx.isOwner || roleCtx.isResolver) && (
          <section className="mb-10">
            <SectionHeading
              label="⬡ Review Queue"
              tone="cyan"
              count={reviewQueue.length}
              note="Cases ready for AI consensus review"
            />
            {reviewQueue.length === 0 ? (
              <EmptyState text="No cases awaiting review." />
            ) : (
              <div className="space-y-7">
                {reviewQueue.map((c) => (
                  <CaseCard key={c.case_id} data={c} highlight />
                ))}
              </div>
            )}
          </section>
        )}

        {/* My Cases — as claimant */}
        {!loading && (() => {
          const asClaim = myCases.filter((c) => c.claimant?.toLowerCase() === account.toLowerCase());
          return (
            <section className="mb-10">
              <SectionHeading label="Cases I Opened" tone="orange" count={asClaim.length} note="You are the claimant" />
              {asClaim.length === 0 ? (
                <EmptyState text="You have not opened any cases yet." cta={{ href: "/open-case", label: "Open a Case" }} />
              ) : (
                <div className="space-y-7">
                  {asClaim.map((c) => <CaseCard key={c.case_id} data={c} />)}
                </div>
              )}
            </section>
          );
        })()}

        {/* My Cases — as respondent */}
        {!loading && (() => {
          const asResp = myCases.filter((c) => c.respondent?.toLowerCase() === account.toLowerCase());
          return (
            <section className="mb-10">
              <SectionHeading label="Cases Against Me" tone="red" count={asResp.length} note="You are the respondent" />
              {asResp.length === 0 ? (
                <EmptyState text="No cases filed against you." />
              ) : (
                <div className="space-y-7">
                  {asResp.map((c) => <CaseCard key={c.case_id} data={c} />)}
                </div>
              )}
            </section>
          );
        })()}

        {/* Admin: recent cases */}
        {!loading && roleCtx.isOwner && (
          <section className="mb-10">
            <SectionHeading label="Recent Cases" tone="paper" count={allCasesForAdmin.length} note="All protocol cases (latest 20)" />
            {allCasesForAdmin.length === 0 ? (
              <EmptyState text="No cases on-chain yet." />
            ) : (
              <div className="space-y-7">
                {allCasesForAdmin.map((c) => <CaseCard key={c.case_id} data={c} />)}
              </div>
            )}
            <div className="mt-3 flex justify-end">
              <Link href="/cases" className="btn-ghost text-xs">View All Cases →</Link>
            </div>
          </section>
        )}

        {/* Quick links */}
        <div className="panel-paper p-5 mt-4">
          <h3 className="h-font text-lg uppercase tracking-[0.06em] text-manifest-paper mb-3">Quick Actions</h3>
          <div className="flex flex-wrap gap-2">
            <Link href="/open-case" className="btn-primary text-xs">▣ Open Case</Link>
            <Link href="/cases" className="btn-secondary text-xs">Browse Cases</Link>
            {(roleCtx.isOwner || roleCtx.isResolver) && (
              <Link href="/resolver" className="btn-consensus text-xs">⬡ Resolver Panel</Link>
            )}
            {roleCtx.isOwner && (
              <Link href="/admin" className="btn-ghost text-xs">Admin Panel</Link>
            )}
          </div>
        </div>
      </div>
    </Shell>
  );
}

function SectionHeading({
  label, tone, count, note,
}: { label: string; tone: "cyan" | "orange" | "red" | "paper" | "default"; count: number; note?: string }) {
  const colors: Record<string, string> = {
    cyan: "text-signal-cyan",
    orange: "text-container-orange",
    red: "text-rust-red",
    paper: "text-manifest-paper",
    default: "text-manifest-paper",
  };
  return (
    <div className="mb-3 flex items-baseline justify-between gap-2 border-b border-white/[0.06] pb-2">
      <div>
        <span className={`h-font text-2xl uppercase tracking-[0.06em] ${colors[tone]}`}>{label}</span>
        {note && <span className="mono-font ml-3 text-[10px] text-fog-grey/50">{note}</span>}
      </div>
      <span className="mono-font text-xs text-fog-grey/40">{count}</span>
    </div>
  );
}

function EmptyState({ text, cta }: { text: string; cta?: { href: string; label: string } }) {
  return (
    <div className="panel p-6 text-center">
      <p className="text-sm text-fog-grey/50">{text}</p>
      {cta && (
        <Link href={cta.href} className="btn-secondary mt-3 inline-flex text-xs">
          {cta.label}
        </Link>
      )}
    </div>
  );
}

function CaseCard({ data, highlight }: { data: CaseData; highlight?: boolean }) {
  const badge = statusBadge(data.status);
  return (
    <Link
      href={`/cases/${data.case_id}`}
      className={`container-card block p-4 transition-opacity hover:opacity-90 ${highlight ? "border-l-signal-cyan" : ""}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mono-font text-xs text-container-orange">{data.case_id}</span>
            <span className={`badge ${badge}`}>{data.status?.replace(/_/g, " ") ?? "—"}</span>
            {data.exception_type && (
              <span className="badge badge-paper">{data.exception_type.replace(/_/g, " ")}</span>
            )}
          </div>
          <p className="text-sm text-manifest-paper truncate max-w-3xl">
            {data.shipment_summary || data.claimant_narrative || "No description provided"}
          </p>
          <div className="flex flex-wrap items-center gap-5">
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
        <span className="mono-font text-[10px] text-signal-cyan/60 flex-shrink-0">View →</span>
      </div>
    </Link>
  );
}
