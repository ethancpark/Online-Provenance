import Link from "next/link";
import type { ReportAccess } from "@/lib/access";
import { batchIdLabel, marketplaceName } from "@/lib/notice";
import styles from "./ReportLock.module.css";

type Props = {
  /** Always a denied result — the caller renders the real flow when allowed. */
  access: Extract<ReportAccess, { allowed: false }>;
  /** The nation currently on screen. */
  nation: string;
  /** Marketplace keys present in the queue, e.g. ["amazon", "temu"]. */
  marketplaces: string[];
  /** How many listings sit behind the lock. Shown so the value is concrete. */
  count: number;
  /**
   * "banner" makes the case, once, where the bulk flow would be. "inline" is
   * the same gate met a second time on a single listing, so it stays short —
   * a page never argues for an account twice.
   */
  variant?: "banner" | "inline";
};

/** "Amazon", or "Amazon and Temu". */
function marketplaceList(keys: string[]): string {
  const names = keys.map(marketplaceName);
  if (names.length === 0) return "the marketplace";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function Padlock({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="22"
      height="22"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      {/* Square corners and a flat stroke — same geometry as the rest of the UI. */}
      <rect x="3.75" y="10.25" width="16.5" height="10.5" />
      <path d="M7.75 10.25V6.75a4.25 4.25 0 0 1 8.5 0v3.5" />
      <path d="M12 14.25v2.75" />
    </svg>
  );
}

/**
 * The gate a visitor meets where the reporting flow would be.
 *
 * It is deliberately not a dead end and not a tease: it says who the feature is
 * for, why it is restricted (the notice is sworn, so it has to come from the
 * nation), exactly what is behind it, and the one route in. No blur, no
 * teaser-locked content — the listings themselves stay fully visible, because
 * the public record is the point of this site. Only the act of speaking in a
 * nation's name is gated.
 */
export default function ReportLock({
  access,
  nation,
  marketplaces,
  count,
  variant = "banner",
}: Props) {
  const mpList = marketplaceList(marketplaces);
  const single = marketplaces.length === 1;
  const plural = count === 1 ? "listing" : "listings";
  const inline = variant === "inline";
  const cls = inline ? `${styles.lock} ${styles.inline}` : styles.lock;
  // Come back to the nation they were looking at, not a generic dashboard.
  // Encoded twice on purpose: URLSearchParams strips one layer on the way back.
  const returnTo = encodeURIComponent(`/dashboard?tribe=${encodeURIComponent(nation)}`);

  const ways = (
    <div className={styles.actions}>
      <Link className={styles.primary} href="/signup">
        Create an account
      </Link>
      <Link className={styles.secondary} href={`/login?next=${returnTo}`}>
        Sign in
      </Link>
    </div>
  );

  // Signed in for a different nation: not a signup problem, a wrong-desk
  // problem. Send them to their own nation's monitor rather than a form.
  if (access.reason === "other_nation") {
    const theirs = access.userNation;
    return (
      <section className={cls}>
        <div className={styles.head}>
          <Padlock className={styles.icon} />
          <div>
            <h2 className={styles.title}>
              {theirs ? `You're signed in for ${theirs}` : "Wrong nation"}
            </h2>
            <p className={styles.body}>
              {inline ? (
                <>
                  A notice is filed by the nation whose mark is being used, so an account at{" "}
                  {theirs ?? "your nation"} cannot file for {nation}.
                </>
              ) : (
                <>
                  Reports are prepared by the nation whose mark is being used, so an account at{" "}
                  {theirs ?? "your nation"} cannot file for {nation}. Every notice is signed under
                  penalty of perjury by a named person, on behalf of their own nation.
                </>
              )}
            </p>
          </div>
        </div>
        {theirs && (
          <div className={styles.actions}>
            <Link
              className={styles.primary}
              href={`/dashboard?tribe=${encodeURIComponent(theirs)}`}
            >
              Open the {theirs} monitor
            </Link>
          </div>
        )}
        {!inline && (
          <p className={styles.foot}>
            If you work for {nation} as well, contact the 𐒻𐒼𐓂 Lab and we&rsquo;ll attach your
            account to it.
          </p>
        )}
      </section>
    );
  }

  // Signed in, but no nation on the profile. Nothing the person can fix alone.
  if (access.reason === "no_nation") {
    return (
      <section className={cls}>
        <div className={styles.head}>
          <Padlock className={styles.icon} />
          <div>
            <h2 className={styles.title}>Your account isn&rsquo;t linked to a nation yet</h2>
            <p className={styles.body}>
              Preparing a report requires an account attached to the nation it speaks for. Contact
              the 𐒻𐒼𐓂 Lab and we&rsquo;ll connect yours.
            </p>
          </div>
        </div>
      </section>
    );
  }

  // Signed out on a single listing. The banner above has already made the case,
  // so this one only says what it blocks and how to get past it.
  if (inline) {
    return (
      <section className={cls}>
        <div className={styles.head}>
          <Padlock className={styles.icon} />
          <div>
            <h2 className={styles.title}>Sign in to prepare this notice</h2>
            <p className={styles.body}>
              It is signed under penalty of perjury by a named person at {nation}.
            </p>
          </div>
        </div>
        {ways}
      </section>
    );
  }

  // Signed out — the common case, and the one that has to earn an account.
  return (
    <section className={cls}>
      <div className={styles.head}>
        <Padlock className={styles.icon} />
        <div>
          <h2 className={styles.title}>Reporting is for {nation} staff</h2>
          <p className={styles.body}>
            Anyone can read this record — that is the point of it. Filing is different: the notice
            is signed under penalty of perjury and asserts authority to act for a sovereign
            nation, so it has to come from a named person at {nation}.
          </p>
        </div>
      </div>

      <div className={styles.unlockLabel}>An account opens</div>
      <ul className={styles.unlocks}>
        <li>
          <span className={styles.unlockNum}>{count}</span>
          <span>
            {single ? (
              <>
                {plural} as one list of {batchIdLabel(marketplaces[0])}, ready to paste straight
                into {mpList}&rsquo;s form
              </>
            ) : (
              <>{plural}, each carrying the identifier its own marketplace&rsquo;s form asks for</>
            )}
          </span>
        </li>
        <li>
          <span className={styles.unlockNum}>1</span>
          <span>
            complete notice carrying your name, your title, and the sworn statement the form
            requires{count > 1 ? <> — instead of {count} written by hand</> : null}
          </span>
        </li>
        <li>
          <span className={styles.unlockNum}>{marketplaces.length}</span>
          <span>
            {single ? (
              <>
                channel — the one {mpList} actually accepts this on, and what to have ready before
                you open it
              </>
            ) : (
              <>
                channels — where {mpList} each take a report, and what to have ready before you
                open them
              </>
            )}
          </span>
        </li>
      </ul>

      {ways}

      <p className={styles.foot}>
        Free, and verified by email domain — use your nation&rsquo;s address. If {nation}{" "}
        isn&rsquo;t recognised yet, contact the 𐒻𐒼𐓂 Lab and we&rsquo;ll add it.
      </p>
    </section>
  );
}
