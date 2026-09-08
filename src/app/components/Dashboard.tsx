"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Tribe, MatchRow, TribeSummary } from "@/lib/types";
import { reportAccess } from "@/lib/access";
import ReviewQueue from "./ReviewQueue";
import ListingDetail from "./ListingDetail";
import AccountNav, { type SessionUser } from "./AccountNav";
import BulkReport from "./BulkReport";
import SignUpPrompt from "./SignUpPrompt";
import AboutProject from "./AboutProject";
import styles from "./Dashboard.module.css";

type Props = {
  tribes: Tribe[];
  selectedTribe: Tribe | null;
  summary: TribeSummary | null;
  matches: MatchRow[];
  sessionUser: SessionUser;
};

export default function Dashboard({ tribes, selectedTribe, summary, matches, sessionUser }: Props) {
  const router = useRouter();
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(matches[0]?.id ?? null);
  const [aboutOpen, setAboutOpen] = useState(false);

  const sortedTribes = [...tribes].sort((a, b) => a.name.localeCompare(b.name));

  // Decided once, for both the bulk flow and the single-listing panel: only the
  // nation on screen (or lab staff) may prepare a notice in that nation's name.
  const access = reportAccess(sessionUser, selectedTribe?.id ?? null);
  const selectedMatch = useMemo(
    () => matches.find((m) => m.id === selectedMatchId) ?? matches[0] ?? null,
    [matches, selectedMatchId],
  );

  function handleTribeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    router.push(`/dashboard?tribe=${encodeURIComponent(e.target.value)}`);
  }

  const usptoLabel = selectedTribe?.uspto_search_url?.includes("tsdr.uspto.gov")
    ? "USPTO seal registration"
    : "USPTO trademark records";

  return (
    <div className={styles.shell}>
      {/* Shown once to signed-out visitors, here rather than on the landing
          page: this is where the account-only features actually are. */}
      {!sessionUser && <SignUpPrompt />}

      <header className={styles.masthead}>
        <div className={styles.mastIn}>
          {/* 1 — top bar */}
          <div className={styles.topBar}>
            <Link href="/" className={styles.wordmark}>
              Online Provenance
            </Link>
            <div className={styles.topRight}>
              <span className={styles.live}>
                <span className={styles.liveDot} />
                Live · updated daily
              </span>
              <button
                type="button"
                className={styles.topLink}
                onClick={() => setAboutOpen((v) => !v)}
                aria-expanded={aboutOpen}
              >
                About
              </button>
              <Link href="/" className={`${styles.topLink} ${styles.viewSite}`}>
                View site
              </Link>
              <AccountNav user={sessionUser} tone="dark" />
            </div>
          </div>

          {/* 2 — identity */}
          <div className={styles.identity}>
            <div>
              <div className={styles.eyebrow}>Marketplace monitor</div>
              <h1 className={styles.nationName}>{selectedTribe?.name ?? "—"}</h1>
              <div className={styles.identityMeta}>
                <span>Tribal seal &amp; flag protection</span>
                {selectedTribe?.has_registered_mark && (
                  <span className={styles.usptoTag}>USPTO registered</span>
                )}
                {selectedTribe?.uspto_search_url && (
                  <a
                    className={styles.usptoLink}
                    href={selectedTribe.uspto_search_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={selectedTribe.uspto_notes ?? "USPTO trademark records"}
                  >
                    {usptoLabel}
                  </a>
                )}
              </div>
            </div>
            <div className={styles.selectWrap}>
              <label className={styles.selectLabel} htmlFor="nation">
                Nation
              </label>
              <select
                id="nation"
                className={styles.select}
                value={selectedTribe?.name ?? ""}
                onChange={handleTribeChange}
              >
                {sortedTribes.map((t) => (
                  <option key={t.id} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 3 — counts */}
          <div className={styles.counts}>
            <div className={styles.count}>
              <div className={`${styles.countNum} ${styles.countNumClay}`}>
                {summary?.listings_flagged ?? 0}
              </div>
              <div className={styles.countLabel}>Listings flagged</div>
            </div>
            <div className={styles.count}>
              <div className={styles.countNum}>{summary?.removed ?? 0}</div>
              <div className={styles.countLabel}>Removed</div>
            </div>
            <div className={styles.count}>
              <div className={styles.countNum}>3</div>
              <div className={styles.countLabel}>Marketplaces</div>
            </div>
          </div>
        </div>
      </header>

      <div className={styles.body}>
        {aboutOpen && <AboutProject className={styles.about} />}

        {/* One quiet line, only for someone signed in who has not opted in yet.
            The setting lives on /account; this is what makes it findable. */}
        {sessionUser && !sessionUser.monthly_email && (
          <p className={styles.emailPrompt}>
            <span className={styles.emailPromptDot} aria-hidden="true" />
            Want these in your inbox? Get a monthly email of new listings using
            {sessionUser.nation ? ` the ${sessionUser.nation}` : " your nation's"} seal.{" "}
            <Link href="/account">Turn it on</Link>
          </p>
        )}

        <BulkReport matches={matches} tribe={selectedTribe} sessionUser={sessionUser} access={access} />

        <div className={styles.grid}>
          <ReviewQueue
            matches={matches}
            selectedMatchId={selectedMatch?.id ?? null}
            onSelect={setSelectedMatchId}
          />
          <ListingDetail
            match={selectedMatch}
            tribe={selectedTribe}
            sessionUser={sessionUser}
            access={access}
          />
        </div>
      </div>
    </div>
  );
}
