import Link from "next/link";
import styles from "./LandingPage.module.css";

// Registry authentication seal — concentric rings, 60 edge ticks, shield + check.
// Neutral provenance mark (no Native imagery). Ticks are computed once at render.
const SEAL_TICKS = Array.from({ length: 60 }, (_, i) => {
  const a = (i / 60) * Math.PI * 2;
  const x1 = (50 + Math.cos(a) * 47).toFixed(1);
  const y1 = (50 + Math.sin(a) * 47).toFixed(1);
  const x2 = (50 + Math.cos(a) * 43).toFixed(1);
  const y2 = (50 + Math.sin(a) * 43).toFixed(1);
  return `M${x1} ${y1} L${x2} ${y2}`;
}).join(" ");

export default function LandingPage() {
  return (
    <main className={styles.page}>
      {/* Reusable seal symbol */}
      <svg style={{ display: "none" }} aria-hidden="true">
        <symbol id="seal" viewBox="0 0 100 100">
          <g fill="none" stroke="currentColor">
            <circle cx="50" cy="50" r="47" strokeWidth="1.4" />
            <circle cx="50" cy="50" r="38" strokeWidth="1" />
            <path d={SEAL_TICKS} strokeWidth="0.7" />
            <path
              d="M50 30 L66 37 L66 54 C66 64 58 70 50 73 C42 70 34 64 34 54 L34 37 Z"
              strokeWidth="1.4"
            />
            <path
              d="M43 51 l5 5 l10 -12"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        </symbol>
      </svg>

      {/* Hero */}
      <div className={styles.hero}>
        <svg className={styles.heroSealBg} style={{ color: "#8FA6C8" }} aria-hidden="true">
          <use href="#seal" />
        </svg>

        <div className={styles.topbar}>
          <div className={styles.brand}>
            <svg className={styles.sealSm} style={{ color: "var(--on-dark)" }} aria-hidden="true">
              <use href="#seal" />
            </svg>
            <span className={styles.wm}>Online&nbsp;Provenance</span>
          </div>
          <nav>
            <Link href="/dashboard">View dashboard</Link>
          </nav>
        </div>

        <div className={styles.heroInner}>
          <div className={styles.eyebrow}>Provenance · Authentication · Enforcement</div>
          <h1>Protecting the seals and marks of Native American nations</h1>
          <p className={styles.lede}>
            Across 574 federally recognized tribes, sacred seals and trademarked flags are sold by
            third-party sellers on Amazon, Temu, and Alibaba with no consent, credit, or
            compensation. AI-generated slop has only made the theft faster. Online Provenance finds
            it, documents it, and helps tribes get it removed.
          </p>
          <div className={styles.ctaRow}>
            <Link className={styles.btnPrimary} href="/dashboard">
              View the monitor →
            </Link>
            <a className={styles.btnGhost} href="#how">
              How it works
            </a>
          </div>
        </div>

        <div className={styles.regMeta}>
          <span>Record · auto-updated daily</span>
          <span>574 nations monitored</span>
          <span>Amazon · Temu · Alibaba</span>
        </div>
      </div>

      {/* How it works */}
      <div className={styles.section} id="how">
        <h2>How it works</h2>
        <div className={styles.steps}>
          <div className={styles.step}>
            <div className={styles.num}>01</div>
            <h3>Find</h3>
            <p>
              Continuously scans Amazon, Temu, and Alibaba for tribal seals and trademarked flags
              listed by third-party sellers.
            </p>
          </div>
          <div className={styles.step}>
            <div className={styles.num}>02</div>
            <h3>Document</h3>
            <p>
              Flags likely infringements with a confidence score and an on-the-record case file —
              listing ID, seller, price, and source.
            </p>
          </div>
          <div className={styles.step}>
            <div className={styles.num}>03</div>
            <h3>Help remove</h3>
            <p>Drafts takedown and trademark notices so tribes can get infringing listings pulled down.</p>
          </div>
        </div>
      </div>

      {/* Monitoring band */}
      <div className={styles.band}>
        <div className={styles.bandInner}>
          <div>
            <div className={styles.eyebrow}>Currently monitoring</div>
            <div className={styles.marks}>
              <span>Amazon</span>
              <span>Temu</span>
              <span>Alibaba</span>
            </div>
          </div>
          <div className={styles.count}>574 federally recognized tribes</div>
        </div>
      </div>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footInner}>
          <div className={styles.brand}>
            <svg className={styles.sealSm} style={{ color: "var(--on-dark)" }} aria-hidden="true">
              <use href="#seal" />
            </svg>
            <span className={styles.wm}>Online&nbsp;Provenance</span>
          </div>
          <p>
            Protecting the seals and marks of Native American nations. Research prototype — drafts
            are reviewed by a human before anything is sent.
          </p>
        </div>
      </footer>
    </main>
  );
}
