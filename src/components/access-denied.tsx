"use client";

import Link from "next/link";
import { Shell } from "./shell";
import { useWallet } from "@/lib/store";

export function AccessDenied({ message }: { message?: string }) {
  const { account, connect } = useWallet();
  return (
    <Shell>
      <div className="mx-auto max-w-lg pt-8">
        <div className="panel-red p-10 text-center space-y-5">
          <div className="h-font text-5xl leading-none text-rust-red">⊘</div>
          <h1 className="h-font text-2xl font-medium uppercase tracking-[0.06em] text-manifest-paper">
            Access Denied
          </h1>
          <p className="text-sm text-fog-grey leading-relaxed">
            {message ?? "You do not have permission to access this resource."}
          </p>
          {!account && (
            <button onClick={() => void connect()} className="btn-primary">
              Connect Wallet
            </button>
          )}
          <div className="flex justify-center gap-3 pt-1">
            <Link href="/dashboard" className="btn-secondary text-xs">Dashboard</Link>
            <Link href="/" className="btn-ghost text-xs">← Home</Link>
          </div>
        </div>
      </div>
    </Shell>
  );
}

export function NotAuthenticated({ message }: { message?: string }) {
  const { connect, connecting } = useWallet();
  return (
    <Shell>
      <div className="mx-auto max-w-lg pt-8">
        <div className="panel-orange p-10 text-center space-y-5">
          <div className="h-font text-5xl leading-none text-container-orange">⬡</div>
          <h1 className="h-font text-2xl font-medium uppercase tracking-[0.06em] text-manifest-paper">
            Wallet Required
          </h1>
          <p className="text-sm text-fog-grey leading-relaxed">
            {message ?? "Connect your wallet to continue. This area is restricted to authenticated users."}
          </p>
          <button
            onClick={() => void connect()}
            disabled={connecting}
            className="btn-primary"
          >
            {connecting ? "Connecting…" : "Connect Wallet"}
          </button>
          <div className="flex justify-center pt-1">
            <Link href="/" className="btn-ghost text-xs">← Back to Home</Link>
          </div>
        </div>
      </div>
    </Shell>
  );
}

export function AccessLoading() {
  return (
    <Shell>
      <div className="mx-auto max-w-lg pt-16 text-center">
        <div className="scan-line mx-auto mb-4 h-px w-48" />
        <p className="mono-font text-xs text-fog-grey/50 uppercase tracking-[0.15em]">
          Verifying access…
        </p>
      </div>
    </Shell>
  );
}
