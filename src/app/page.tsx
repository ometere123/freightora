import Link from "next/link";
import { Shell } from "@/components/shell";

export default function Home() {
  return (
    <Shell>
      {/* Hero */}
      <section className="relative overflow-hidden border border-white/[0.05] bg-gradient-to-br from-harbour-black via-dock-slate/60 to-harbour-black px-6 py-16 lg:py-24">
        {/* Grid overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(var(--color-manifest-paper) 1px, transparent 1px), linear-gradient(90deg, var(--color-manifest-paper) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        {/* Crane graphic */}
        <div className="pointer-events-none absolute right-0 top-0 h-full w-1/2 opacity-[0.04] select-none">
          <svg viewBox="0 0 400 500" className="h-full w-full" fill="none">
            <line x1="200" y1="0" x2="200" y2="500" stroke="#ff6a00" strokeWidth="3"/>
            <line x1="80" y1="60" x2="320" y2="60" stroke="#ff6a00" strokeWidth="3"/>
            <line x1="200" y1="60" x2="80" y2="180" stroke="#ff6a00" strokeWidth="2"/>
            <line x1="200" y1="60" x2="320" y2="180" stroke="#ff6a00" strokeWidth="2"/>
            <line x1="320" y1="60" x2="320" y2="240" stroke="#ff6a00" strokeWidth="2"/>
            <rect x="290" y="240" width="60" height="40" stroke="#ff6a00" strokeWidth="2"/>
            <rect x="260" y="280" width="120" height="80" stroke="#ff6a00" strokeWidth="2"/>
            <rect x="280" y="360" width="80" height="60" stroke="#00b4d8" strokeWidth="1.5"/>
            <rect x="290" y="420" width="60" height="40" stroke="#00b4d8" strokeWidth="1.5" opacity="0.6"/>
          </svg>
        </div>

        <div className="relative z-10 max-w-4xl">
          <div className="mb-4 flex items-center gap-5">
            <span className="badge badge-orange pulse">GenLayer Studionet</span>
            <span className="badge badge-grey">v1.0</span>
          </div>

          <h1 className="h-font mb-4 text-5xl font-semibold uppercase leading-[1.05] tracking-[0.05em] text-manifest-paper lg:text-7xl">
            Cargo Exception
            <br />
            <span className="text-container-orange">Resolution</span>
            <br />
            Marketplace
          </h1>

          <p className="mb-8 max-w-2xl font-body text-base leading-relaxed text-fog-grey">
            Cargo exception? Damaged shipment, missing freight, wrong quantity?{" "}
            <span className="text-signal-cyan">GenLayer&apos;s AI consensus engine</span> reviews photos,
            documents, carrier records, and timelines — then returns a deterministic liability ruling.
          </p>

          <div className="flex flex-wrap items-center gap-5">
            <Link href="/open-case" className="btn-primary">
              ▣ Open Exception Case
            </Link>
            <Link href="/cases" className="btn-secondary">
              Browse Cases
            </Link>
            <Link href="/marketplace" className="btn-secondary">
              Marketplace
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        {HOW.map((step, i) => (
          <div key={i} className="panel p-6">
            <div className="mb-3 flex items-center gap-5">
              <span className="mono-font text-3xl font-medium text-container-orange/40 leading-none">
                0{i + 1}
              </span>
              <span className="h-font text-xl uppercase tracking-[0.06em] text-manifest-paper">
                {step.title}
              </span>
            </div>
            <p className="text-sm leading-relaxed text-fog-grey">{step.body}</p>
          </div>
        ))}
      </section>

      {/* Why GenLayer */}
      <section className="mt-4 panel-cyan p-6 lg:p-14">
        <div className="mb-5 flex items-start justify-between gap-7">
          <h2 className="h-font text-3xl font-medium uppercase tracking-[0.06em] text-manifest-paper">
            Why GenLayer?
          </h2>
          <span className="badge badge-cyan hidden sm:inline-flex">AI Consensus</span>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {WHY.map((item, i) => (
            <div key={i} className="space-y-1.5">
              <p className="h-font text-base uppercase tracking-[0.06em] text-signal-cyan">{item.label}</p>
              <p className="text-sm leading-relaxed text-fog-grey">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Exception Types */}
      <section className="mt-4">
        <div className="panel p-6">
          <h2 className="h-font mb-4 text-2xl uppercase tracking-[0.06em] text-manifest-paper">
            Supported Exception Types
          </h2>
          <div className="flex flex-wrap gap-2">
            {EXCEPTION_TYPES.map((t) => (
              <span key={t} className="badge badge-paper">{t.replace(/_/g, " ")}</span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mt-4 panel-orange p-8 text-center">
        <h2 className="h-font mb-3 text-4xl font-medium uppercase tracking-[0.06em] text-manifest-paper">
          Ready to resolve a cargo exception?
        </h2>
        <p className="mb-6 text-fog-grey">
          Connect your wallet and open a case in minutes.
        </p>
        <Link href="/open-case" className="btn-primary inline-flex">
          ▣ Open Exception Case
        </Link>
      </section>
    </Shell>
  );
}

const HOW = [
  {
    title: "Open a Case",
    body: "Submit the cargo exception: exception type, shipment details, claimant and respondent parties, cargo value, and timeline.",
  },
  {
    title: "Submit Evidence",
    body: "All parties add photos, documents, carrier records, and written responses. Each piece of evidence is stored on-chain.",
  },
  {
    title: "AI Consensus Review",
    body: "GenLayer's non-deterministic AI validators examine every document and return a liability ruling with confidence score.",
  },
];

const WHY = [
  {
    label: "Deterministic Outcome",
    body: "Multiple GenLayer validators reach consensus so no single party can manipulate the result.",
  },
  {
    label: "Evidence-First",
    body: "Photos, carrier records, bills of lading, inspection reports — all reviewed before any ruling.",
  },
  {
    label: "Reconsideration Path",
    body: "Parties can open reconsideration if new evidence emerges or a settlement is rejected.",
  },
  {
    label: "Settlement Protocol",
    body: "Built-in settlement negotiation before final ruling, reducing litigation costs.",
  },
];

const EXCEPTION_TYPES = [
  "DAMAGE", "LOSS", "SHORT_DELIVERY", "WRONG_DELIVERY",
  "CONTAMINATION", "DELAY", "DOCUMENTATION_ERROR", "OTHER",
];
