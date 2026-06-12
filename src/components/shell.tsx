"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "@/lib/store";
import { useAccessControl } from "@/lib/hooks/useAccessControl";
import { shortAddr } from "@/lib/utils";
import { isContractConfigured, CONTRACT_NOT_CONFIGURED, genlayerConfig } from "@/lib/genlayer/config";

const BASE_NAV = [
  { href: "/", label: "Dock", role: "public" },
  { href: "/dashboard", label: "Dashboard", role: "auth" },
  { href: "/cases", label: "Cases", role: "auth" },
  { href: "/open-case", label: "Open Case", role: "auth" },
  { href: "/resolve", label: "Resolve", role: "resolver" },
  { href: "/admin", label: "Admin", role: "admin" },
] as const;

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { account, connecting, connect, disconnect } = useWallet();
  const { isOwner, isAdminOrResolver } = useAccessControl();

  const nav = BASE_NAV.filter(({ role }) => {
    if (role === "public") return true;
    if (role === "auth") return !!account;
    if (role === "resolver") return isAdminOrResolver;
    if (role === "admin") return isOwner;
    return false;
  });

  return (
    <div className="dock-grid min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-[1520px] flex-col gap-0">

        {/* Top Bar */}
        <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-harbour-black/95 backdrop-blur-md">
          <div className="flex items-center justify-between gap-3 px-4 py-3 lg:gap-5 lg:px-10">

            {/* Logo */}
            <Link href="/" className="flex items-center gap-3 flex-shrink-0">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center border border-container-orange/40 bg-container-orange/10">
                <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
                  <rect x="1" y="5" width="14" height="9" rx="0.5" stroke="#ff6a00" strokeWidth="1.2"/>
                  <rect x="3" y="3" width="10" height="3" rx="0.5" stroke="#ff6a00" strokeWidth="1.2"/>
                  <line x1="4" y1="9" x2="4" y2="12" stroke="#ff6a00" strokeWidth="1" strokeOpacity="0.6"/>
                  <line x1="8" y1="9" x2="8" y2="12" stroke="#ff6a00" strokeWidth="1" strokeOpacity="0.6"/>
                  <line x1="12" y1="9" x2="12" y2="12" stroke="#ff6a00" strokeWidth="1" strokeOpacity="0.6"/>
                </svg>
              </div>
              <div>
                <p className="h-font text-lg font-semibold uppercase tracking-[0.14em] text-manifest-paper leading-none sm:text-xl">
                  Freightora
                </p>
                <p className="mono-font hidden text-[10px] uppercase tracking-[0.2em] text-signal-cyan opacity-70 mt-0.5 sm:block">
                  Exception Dock
                </p>
              </div>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden items-center gap-1 lg:flex">
              {nav.map(({ href, label }) => {
                const active = href === "/" ? path === "/" : path.startsWith(href);
                return (
                  <Link key={href} href={href} className={`nav-item ${active ? "nav-item-active" : ""}`}>
                    {label}
                  </Link>
                );
              })}
            </nav>

            {/* Wallet */}
            <div className="flex flex-shrink-0 items-center gap-2">
              {account ? (
                <div className="flex items-center gap-2">
                  <span className="badge badge-green hidden sm:inline-flex">{shortAddr(account)}</span>
                  <button onClick={disconnect} className="btn-ghost text-xs px-3 py-2">
                    Disconnect
                  </button>
                </div>
              ) : (
                <button onClick={() => void connect()} disabled={connecting} className="btn-secondary text-xs px-4 py-2 sm:text-sm sm:px-6">
                  {connecting ? "…" : <><span className="hidden sm:inline">Connect </span>Wallet</>}
                </button>
              )}
            </div>
          </div>

          {/* Mobile Nav */}
          <div className="flex gap-1 overflow-x-auto scrollbar-none px-4 pb-2 lg:hidden">
            {nav.map(({ href, label }) => {
              const active = href === "/" ? path === "/" : path.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`nav-item whitespace-nowrap text-sm ${active ? "nav-item-active" : ""}`}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        </header>

        {/* Contract Banner */}
        {!isContractConfigured && (
          <div className="border-b border-container-orange/20 bg-container-orange/5 px-6 py-3 lg:px-12">
            <p className="mono-font text-xs text-container-orange/80">{CONTRACT_NOT_CONFIGURED}</p>
          </div>
        )}

        {/* Content */}
        <main className="flex-1 px-4 py-6 sm:px-5 sm:py-8 lg:px-10 lg:py-12 animate-in">
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t border-white/[0.05] px-6 py-6 lg:px-12">
          <p className="mono-font text-xs text-fog-grey/50 text-center tracking-[0.12em]">
            FREIGHTORA — CARGO EXCEPTIONS RESOLVED BY EVIDENCE, RECORDS, AND CONSENSUS — GENLAYER
          </p>
        </footer>

      </div>
    </div>
  );
}

// ─── Panel ─────────────────────────────────────────────────────────────────

export function Panel({
  title,
  action,
  children,
  tone = "default",
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  tone?: "default" | "paper" | "orange" | "cyan" | "red";
}) {
  const cls = {
    default: "panel",
    paper: "panel-paper",
    orange: "panel-orange",
    cyan: "panel-cyan",
    red: "panel-red",
  }[tone];

  return (
    <section className={`${cls} p-6 lg:p-8 mb-5`}>
      {title && (
        <div className="mb-6 flex items-center justify-between gap-4">
          <h3 className="h-font text-2xl font-medium uppercase tracking-[0.08em] text-manifest-paper">
            {title}
          </h3>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

// ─── Tx Banner ─────────────────────────────────────────────────────────────

type TxState = "idle" | "pending" | "success" | "error";

export function TxBanner({
  state,
  message,
  hash,
  onDismiss,
}: {
  state: TxState;
  message: string;
  hash: string;
  onDismiss: () => void;
}) {
  if (state === "idle") return null;
  const cls = {
    idle: "",
    pending: "panel-orange",
    success: "panel-cyan",
    error: "panel-red",
  }[state];
  const label = state === "pending" ? "Processing…" : state === "success" ? "Success" : "Error";

  return (
    <div className={`${cls} p-4 mb-5 animate-in`}>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="h-font text-xl uppercase tracking-[0.06em]">{label}</p>
          <p className="text-base text-fog-grey">{message}</p>
          {hash && (
            <a
              href={`${genlayerConfig.explorerUrl.replace(/\/?$/, "/")}tx/${hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mono-font text-xs text-signal-cyan/60 hover:text-signal-cyan break-all mt-1 block"
            >
              TX: {hash} ↗
            </a>
          )}
        </div>
        {state !== "pending" && (
          <button onClick={onDismiss} className="btn-ghost flex-shrink-0">✕</button>
        )}
      </div>
      {state === "pending" && (
        <div className="mt-4 overflow-hidden h-px">
          <div className="scan-line" />
        </div>
      )}
    </div>
  );
}
