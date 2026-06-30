"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Tribe, MatchRow, TribeSummary } from "@/lib/types";
import ReviewQueue from "./ReviewQueue";
import ListingDetail from "./ListingDetail";
import styles from "./Dashboard.module.css";

type Props = {
  tribes: Tribe[];
  selectedTribe: Tribe | null;
  summary: TribeSummary | null;
  matches: MatchRow[];
};

// Gold registry medallion — decorative brand mark in the masthead. The cog teeth
// and inner tick ring are deterministic, so they're computed once at render.
const MEDAL = (() => {
  const cx = 200;
  const cy = 200;
  const teeth = 52;
  const ro = 176;
  const ri = 162;
  const p = (r: number, a: number) => `${(cx + Math.cos(a) * r).toFixed(1)} ${(cy + Math.sin(a) * r).toFixed(1)}`;
  let cog = "";
  for (let i = 0; i < teeth; i++) {
    const a0 = (i / teeth) * 2 * Math.PI;
    const a1 = ((i + 0.5) / teeth) * 2 * Math.PI;
    const a2 = ((i + 1) / teeth) * 2 * Math.PI;
    cog += (i === 0 ? "M" : "L") + p(ro, a0) + " L" + p(ro, a1) + " L" + p(ri, a1) + " L" + p(ri, a2) + " ";
  }
  cog += "Z";
  let ticks = "";
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * 2 * Math.PI;
    ticks += `M${(cx + Math.cos(a) * 150).toFixed(1)} ${(cy + Math.sin(a) * 150).toFixed(1)} L${(cx + Math.cos(a) * 138).toFixed(1)} ${(cy + Math.sin(a) * 138).toFixed(1)} `;
  }
  return { cog, ticks };
})();

function Medal() {
  return (
    <svg className={styles.medal} viewBox="0 0 400 400" aria-hidden="true">
      <defs>
        <radialGradient id="medalDisc" cx="38%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#F0D49A" />
          <stop offset="42%" stopColor="#C79A57" />
          <stop offset="78%" stopColor="#8E6630" />
          <stop offset="100%" stopColor="#5E411D" />
        </radialGradient>
        <radialGradient id="medalInner" cx="40%" cy="34%" r="75%">
          <stop offset="0%" stopColor="#D7AE69" />
          <stop offset="100%" stopColor="#6E4D24" />
        </radialGradient>
        <linearGradient id="medalShield" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F4DCA6" />
          <stop offset="100%" stopColor="#8C6128" />
        </linearGradient>
        <radialGradient id="medalSpot" cx="34%" cy="26%" r="60%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.5" />
          <stop offset="55%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path d={MEDAL.cog} fill="url(#medalDisc)" stroke="#4F360F" strokeWidth="1" />
      <circle cx="200" cy="200" r="160" fill="url(#medalDisc)" stroke="#4F360F" strokeWidth="2" />
      <circle cx="200" cy="200" r="150" fill="none" stroke="#F0D49A" strokeWidth="1" opacity="0.45" />
      <circle cx="200" cy="200" r="128" fill="url(#medalInner)" stroke="#4F360F" strokeWidth="1.5" />
      <path d={MEDAL.ticks} stroke="#4F360F" strokeWidth="1" opacity="0.5" fill="none" />
      <path
        d="M200 118 L262 145 L262 210 C262 248 232 272 200 286 C168 272 138 248 138 210 L138 145 Z"
        fill="url(#medalShield)"
        stroke="#4F360F"
        strokeWidth="2.5"
      />
      <path d="M172 200 l22 22 l40 -52" fill="none" stroke="#4F360F" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M172 200 l22 22 l40 -52" fill="none" stroke="#F6E2B0" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
      <circle cx="200" cy="200" r="176" fill="url(#medalSpot)" />
    </svg>
  );
}

// Registry line seal — reused as the placeholder mark in the queue and comparison.
function SealDefs() {
  return (
    <svg style={{ display: "none" }} aria-hidden="true">
      <symbol id="seal-line" viewBox="0 0 100 100">
        <g fill="none" stroke="currentColor">
          <circle cx="50" cy="50" r="47" strokeWidth="1.4" />
          <circle cx="50" cy="50" r="38" strokeWidth="1" />
          <path d="M50 30 L66 37 L66 54 C66 64 58 70 50 73 C42 70 34 64 34 54 L34 37 Z" strokeWidth="1.4" />
          <path d="M43 51 l5 5 l10 -12" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </symbol>
    </svg>
  );
}

export default function Dashboard({ tribes, selectedTribe, summary, matches }: Props) {
  const router = useRouter();
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(matches[0]?.id ?? null);
  const [aboutOpen, setAboutOpen] = useState(false);

  const sortedTribes = [...tribes].sort((a, b) => a.name.localeCompare(b.name));
  const visibleMatches = matches;
  const selectedMatch = useMemo(
    () => visibleMatches.find((m) => m.id === selectedMatchId) ?? visibleMatches[0] ?? null,
    [visibleMatches, selectedMatchId],
  );

  function handleTribeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    router.push(`/dashboard?tribe=${encodeURIComponent(e.target.value)}`);
  }

  const usptoLabel = selectedTribe?.uspto_search_url?.includes("tsdr.uspto.gov")
    ? "USPTO seal registration"
    : "USPTO trademark records";
  const removed = summary?.removed ?? 0;

  return (
    <div className={styles.shell}>
      <SealDefs />

      <header className={styles.masthead}>
        <div className={styles.mastIn}>
          <div className={styles.mastTop}>
            <div className={styles.brand}>
              <svg className={styles.sealSm} style={{ color: "var(--on-dark)" }} aria-hidden="true">
                <use href="#seal-line" />
              </svg>
              <span className={styles.wm}>Online&nbsp;Provenance</span>
            </div>
            <div className={styles.links}>
              <span className={styles.status}>
                <span className={styles.dot} />
                Live · auto-updated daily
              </span>
              <button
                type="button"
                className={styles.aboutBtn}
                onClick={() => setAboutOpen((v) => !v)}
                aria-expanded={aboutOpen}
              >
                About
              </button>
              <Link href="/">View site</Link>
            </div>
          </div>

          <div className={styles.mastBody}>
            <div>
              <div className={styles.eyebrow}>Marketplace monitor</div>
              <h1>{selectedTribe?.name ?? "—"}</h1>
              <div className={styles.sub}>
                <span>Tribal seal &amp; flag protection</span>
                {selectedTribe?.has_registered_mark && (
                  <span className={`${styles.tag} ${styles.tagReg}`}>USPTO registered</span>
                )}
                {selectedTribe?.uspto_search_url && (
                  <a
                    href={selectedTribe.uspto_search_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={selectedTribe.uspto_notes ?? "USPTO trademark records"}
                  >
                    {usptoLabel} ↗
                  </a>
                )}
              </div>
            </div>
            <Medal />
          </div>

          <div className={styles.mastStats}>
            <div className={styles.stat}>
              <div className={styles.k}>Listings flagged</div>
              <div className={styles.v}>{summary?.listings_flagged ?? 0}</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.k}>Removed</div>
              <div className={`${styles.v} ${removed === 0 ? styles.zero : ""}`}>{removed}</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.k}>Marketplaces</div>
              <div className={styles.v}>3</div>
            </div>
            <div className={styles.selector}>
              <label htmlFor="nation">Nation</label>
              <select id="nation" value={selectedTribe?.name ?? ""} onChange={handleTribeChange} aria-label="Select tribal nation">
                {sortedTribes.map((t) => (
                  <option key={t.id} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </header>

      <div className={styles.wrap}>
        {aboutOpen && (
          <div className={styles.about}>
            <div className={styles.aboutPanel}>
              <h2>About this project</h2>
              <p>
                Online Provenance protects the intellectual property, cultural symbols, and sovereign
                rights of federally recognized Native American tribes by identifying and reporting
                unauthorized commercial use of tribal flags, emblems, and protected cultural assets on
                online marketplaces. It maintains a verified database of federally recognized tribes,
                monitors e-commerce sites such as Amazon and Temu for potential misuse, trademark
                violations, and copyright infringements, and streamlines documenting and reporting
                violations to the appropriate tribal authorities and legal entities.
              </p>
              <p>
                Through automated monitoring, evidence collection, copyright-registration support, and
                notification workflows, the project helps tribes and government agencies take timely
                action against unauthorized merchandise and counterfeit products. By facilitating
                communication with tribal representatives, state attorneys general, and marketplace
                operators, it helps safeguard tribal identity and ensures intellectual property rights
                are respected across digital commerce.
              </p>
              <h3>Call to action</h3>
              <p>
                Join us in protecting tribal heritage and intellectual property. Whether you are a
                tribal representative, legal advocate, government agency, or technology partner, your
                participation can help identify violations faster, strengthen enforcement, and preserve
                the integrity of tribal symbols for future generations.
              </p>
            </div>
          </div>
        )}

        <div className={styles.main}>
          <ReviewQueue
            matches={visibleMatches}
            selectedMatchId={selectedMatch?.id ?? null}
            onSelect={setSelectedMatchId}
          />
          <ListingDetail match={selectedMatch} tribe={selectedTribe} />
        </div>
      </div>
    </div>
  );
}
