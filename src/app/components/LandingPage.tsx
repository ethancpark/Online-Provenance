import Link from "next/link";
import { ScanSearch, FileText, ShieldCheck, ArrowRight } from "lucide-react";
import Seal from "./Seal";

// Institutional landing per design.md: parchment record surface, navy chrome,
// Fraunces display + Plex body + Plex Mono data, the wax-seal mark, signal
// colors reserved for the dashboard. No Native imagery, no shadows/gradients.

const wordmark: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontWeight: 600,
  letterSpacing: "0.13em",
  color: "var(--color-navy)",
};

const STEPS = [
  {
    n: "01",
    Icon: ScanSearch,
    title: "Find",
    body: "Continuously scans Amazon, Temu, and Alibaba for tribal seals and trademarked flags listed by third-party sellers.",
  },
  {
    n: "02",
    Icon: FileText,
    title: "Document",
    body: "Flags likely infringements with a confidence score and an on-the-record case file — listing ID, seller, price, and source.",
  },
  {
    n: "03",
    Icon: ShieldCheck,
    title: "Help remove",
    body: "Drafts takedown and trademark notices so tribes can get infringing listings pulled down.",
  },
];

export default function LandingPage() {
  return (
    <main
      className="flex min-h-screen flex-col"
      style={{ background: "var(--color-parchment)", color: "var(--color-ink)" }}
    >
      {/* Header */}
      <header
        className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
        <div className="flex items-center gap-3">
          <Seal size={30} />
          <span className="text-sm" style={wordmark}>
            ONLINE PROVENANCE
          </span>
        </div>
        <Link
          href="/dashboard"
          className="text-sm hover:underline"
          style={{ color: "var(--color-text-secondary)" }}
        >
          View dashboard
        </Link>
      </header>

      {/* Hero — navy chrome */}
      <section style={{ background: "var(--color-navy)" }}>
        <div className="mx-auto w-full max-w-5xl px-6 py-20 md:py-24">
          <Seal size={64} variant="reversed" />
          <p
            className="mt-8 text-xs"
            style={{ color: "var(--color-on-navy)", letterSpacing: "0.04em", fontWeight: 500 }}
          >
            Provenance · authentication · enforcement
          </p>
          <h1
            className="mt-3 max-w-3xl"
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 600,
              fontSize: "2.75rem",
              lineHeight: 1.15,
              color: "var(--color-on-navy-strong)",
            }}
          >
            Protecting the seals and marks of Native American nations
          </h1>
          <p
            className="mt-6 max-w-2xl"
            style={{ color: "var(--color-on-navy)", lineHeight: 1.65, fontSize: "1rem" }}
          >
            Across 574 federally recognized tribes, sacred seals and trademarked flags
            are sold by third-party sellers on Amazon, Temu, and Alibaba with no consent,
            credit, or compensation. AI-generated slop has only made the theft faster.
            Online Provenance finds it, documents it, and helps tribes get it removed.
          </p>
          <div className="mt-10 flex items-center gap-6">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium"
              style={{ background: "var(--color-parchment)", color: "var(--color-navy)" }}
            >
              View the monitor
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="#how" className="text-sm" style={{ color: "var(--color-on-navy)" }}>
              How it works
            </a>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto w-full max-w-5xl px-6 py-16 md:py-20">
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 500,
            fontSize: "1.625rem",
            lineHeight: 1.25,
            color: "var(--color-navy)",
          }}
        >
          How it works
        </h2>
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          {STEPS.map(({ n, Icon, title, body }) => (
            <div
              key={n}
              className="rounded-xl p-6"
              style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
            >
              <div className="flex items-center justify-between">
                <Icon className="h-5 w-5" strokeWidth={1.75} style={{ color: "var(--color-navy)" }} />
                <span className="op-data text-xs" style={{ color: "var(--color-text-muted)" }}>
                  {n}
                </span>
              </div>
              <h3 className="mt-4 text-lg" style={{ fontWeight: 500 }}>
                {title}
              </h3>
              <p className="mt-2 text-sm" style={{ color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
                {body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Currently monitoring */}
      <section className="mx-auto w-full max-w-5xl px-6 pb-16 md:pb-20">
        <div
          className="rounded-xl p-6 md:p-8"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <p
            className="text-xs"
            style={{ color: "var(--color-text-muted)", letterSpacing: "0.04em", fontWeight: 500 }}
          >
            Currently monitoring
          </p>
          <div className="mt-3 flex flex-wrap items-baseline gap-x-8 gap-y-2">
            {["Amazon", "Temu", "Alibaba"].map((mp) => (
              <span
                key={mp}
                className="text-2xl"
                style={{ fontFamily: "var(--font-display)", fontWeight: 500, color: "var(--color-navy)" }}
              >
                {mp}
              </span>
            ))}
            <span className="op-data ml-auto text-sm" style={{ color: "var(--color-text-muted)" }}>
              574 federally recognized tribes
            </span>
          </div>
        </div>
      </section>

      {/* Footer — navy */}
      <footer className="mt-auto" style={{ background: "var(--color-navy)" }}>
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-6 py-10 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Seal size={26} variant="reversed" />
            <span className="text-xs" style={{ ...wordmark, color: "var(--color-on-navy-strong)" }}>
              ONLINE PROVENANCE
            </span>
          </div>
          <p className="max-w-md text-xs" style={{ color: "var(--color-on-navy)", lineHeight: 1.5 }}>
            Protecting the seals and marks of Native American nations. Research prototype —
            drafts are reviewed by a human before anything is sent.
          </p>
        </div>
      </footer>
    </main>
  );
}
