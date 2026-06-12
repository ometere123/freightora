"use client";

import { useEffect, useState } from "react";
import { Shell, Panel, TxBanner } from "@/components/shell";
import { AccessDenied, NotAuthenticated, AccessLoading } from "@/components/access-denied";
import { useAccessControl } from "@/lib/hooks/useAccessControl";
import { useWallet } from "@/lib/store";
import {
  getProtocolStats, getConfig, addResolver, removeResolver,
  pauseProtocol, unpauseProtocol, setReviewFee,
} from "@/lib/genlayer/contract";
import { shortAddr } from "@/lib/utils";
import type { ProtocolStats } from "@/lib/types";

export default function AdminPage() {
  const { account, connect } = useWallet();
  const { loading: acLoading, isOwner } = useAccessControl();

  if (!account) return <NotAuthenticated message="Admin panel requires a connected wallet." />;
  if (acLoading) return <AccessLoading />;
  if (!isOwner) return <AccessDenied message="Admin panel is restricted to the contract owner (deployer wallet)." />;
  const [stats, setStats] = useState<ProtocolStats | null>(null);
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [txState, setTxState] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [txMsg, setTxMsg] = useState("");
  const [txHash, setTxHash] = useState("");
  const [resolverAddr, setResolverAddr] = useState("");
  const [removeAddr, setRemoveAddr] = useState("");
  const [newFeeWei, setNewFeeWei] = useState("10000000000000000");

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const [s, c] = await Promise.allSettled([getProtocolStats(), getConfig()]);
        if (s.status === "fulfilled") setStats(s.value as ProtocolStats);
        if (c.status === "fulfilled") setConfig(c.value as Record<string, unknown>);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function doTx(label: string, fn: () => Promise<unknown>) {
    if (!account) { await connect(); return; }
    setTxState("pending");
    setTxMsg(`${label}…`);
    setTxHash("");
    try {
      const r = await fn();
      setTxHash(typeof r === "string" ? r : "");
      setTxState("success");
      setTxMsg(`${label} complete.`);
    } catch (e) {
      setTxState("error");
      setTxMsg(e instanceof Error ? e.message : "Transaction failed");
    }
  }

  return (
    <Shell>
      <div className="mx-auto max-w-4xl">
        <div className="mb-10">
          <h1 className="h-font text-4xl font-medium uppercase tracking-[0.06em] text-manifest-paper">
            Admin Panel
          </h1>
          <p className="mt-1 text-sm text-fog-grey">Protocol configuration and resolver management.</p>
        </div>

        <TxBanner state={txState} message={txMsg} hash={txHash} onDismiss={() => setTxState("idle")} />

        {/* Protocol Stats */}
        {!loading && stats && (
          <Panel title="Protocol Stats" tone="paper">
            <dl className="space-y-7">
              {Object.entries(stats).map(([k, v]) => (
                <div key={k} className="stat-row">
                  <dt className="field-label mb-0 capitalize">{k.replace(/_/g, " ")}</dt>
                  <dd className="mono-font text-xs text-manifest-paper">{String(v)}</dd>
                </div>
              ))}
            </dl>
          </Panel>
        )}

        {loading && (
          <div className="panel p-8 text-center mb-7">
            <p className="mono-font text-xs text-fog-grey/50">Loading protocol data…</p>
          </div>
        )}

        {/* Config */}
        {!loading && config && (
          <Panel title="Protocol Config" tone="default">
            <dl className="space-y-7">
              {Object.entries(config).map(([k, v]) => (
                <div key={k} className="stat-row">
                  <dt className="field-label mb-0 capitalize">{k.replace(/_/g, " ")}</dt>
                  <dd className="mono-font text-xs text-manifest-paper break-all">{String(v)}</dd>
                </div>
              ))}
            </dl>
          </Panel>
        )}

        {/* Protocol Controls */}
        <div className="mt-4 mb-7">
          <div className="panel p-5 space-y-7">
            <h2 className="h-font text-xl uppercase tracking-[0.06em] text-manifest-paper">Protocol Controls</h2>
            <p className="text-xs text-fog-grey">
              Pause halts all write operations. Unpause resumes normal operation.
              Only the contract owner can perform these actions.
            </p>
            <div className="flex flex-wrap gap-5">
              <button
                onClick={() => void doTx("Pause Protocol", () => pauseProtocol(account!))}
                disabled={!account || txState === "pending"}
                className="btn-escalate text-sm disabled:opacity-40"
              >
                Pause Protocol
              </button>
              <button
                onClick={() => void doTx("Unpause Protocol", () => unpauseProtocol(account!))}
                disabled={!account || txState === "pending"}
                className="btn-consensus text-sm disabled:opacity-40"
              >
                Unpause Protocol
              </button>
            </div>
          </div>
        </div>

        {/* Review Fee */}
        <div className="mb-7">
          <div className="panel p-5 space-y-5">
            <h2 className="h-font text-xl uppercase tracking-[0.06em] text-manifest-paper">Review Fee</h2>
            <p className="text-xs text-fog-grey">
              Set the wei amount required to trigger AI consensus review. Default: 10000000000000000 (0.01 GEN).
            </p>
            <input
              type="text"
              value={newFeeWei}
              onChange={(e) => setNewFeeWei(e.target.value)}
              className="field-input mono-font"
              placeholder="10000000000000000"
            />
            <button
              onClick={() => void doTx("Set Review Fee", () => setReviewFee(account!, newFeeWei.trim()))}
              disabled={!account || !newFeeWei.trim() || txState === "pending"}
              className="btn-secondary text-sm disabled:opacity-40"
            >
              Set Review Fee
            </button>
          </div>
        </div>

        {/* Resolver Management */}
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="panel p-5 space-y-5">
            <h2 className="h-font text-xl uppercase tracking-[0.06em] text-manifest-paper">Add Resolver</h2>
            <p className="text-xs text-fog-grey">Grant resolver role to an address.</p>
            <input
              type="text"
              value={resolverAddr}
              onChange={(e) => setResolverAddr(e.target.value)}
              className="field-input mono-font"
              placeholder="0x…"
            />
            <button
              onClick={() => {
                void doTx(`Add resolver ${shortAddr(resolverAddr)}`,
                  () => addResolver(account!, resolverAddr.trim() as `0x${string}`));
              }}
              disabled={!account || !resolverAddr.trim() || txState === "pending"}
              className="btn-consensus w-full disabled:opacity-40"
            >
              Add Resolver
            </button>
          </div>

          <div className="panel p-5 space-y-5">
            <h2 className="h-font text-xl uppercase tracking-[0.06em] text-manifest-paper">
              Remove Resolver
            </h2>
            <p className="text-xs text-fog-grey">Revoke resolver role from an address.</p>
            <input
              type="text"
              value={removeAddr}
              onChange={(e) => setRemoveAddr(e.target.value)}
              className="field-input mono-font"
              placeholder="0x…"
            />
            <button
              onClick={() => {
                void doTx(`Remove resolver ${shortAddr(removeAddr)}`,
                  () => removeResolver(account!, removeAddr.trim() as `0x${string}`));
              }}
              disabled={!account || !removeAddr.trim() || txState === "pending"}
              className="btn-escalate w-full disabled:opacity-40"
            >
              Remove Resolver
            </button>
          </div>
        </div>

        {/* Network Info */}
        <div className="panel-paper mt-4 p-14">
          <h3 className="h-font mb-3 text-xl uppercase tracking-[0.06em] text-manifest-paper">
            Network
          </h3>
          <dl className="space-y-7">
            <div className="stat-row">
              <dt className="field-label mb-0">Chain</dt>
              <dd className="mono-font text-xs">GenLayer Studionet (61999)</dd>
            </div>
            <div className="stat-row">
              <dt className="field-label mb-0">RPC</dt>
              <dd className="mono-font text-xs text-fog-grey/60">https://studio.genlayer.com/api</dd>
            </div>
            <div className="stat-row">
              <dt className="field-label mb-0">Contract</dt>
              <dd className="mono-font text-xs text-container-orange break-all">
                {process.env.NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS ?? "Not configured"}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </Shell>
  );
}
