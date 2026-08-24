import Link from "next/link";
import type { ReportAccess } from "@/lib/access";
import styles from "./ReportLock.module.css";

type Props = {
  /** Always a denied result — the caller renders the real flow when allowed. */
  access: Extract<ReportAccess, { allowed: false }>;
  /** The nation currently on screen. */
  nation: string;
  /** How many listings sit behind the lock. Shown so the value is concrete. */
  count: number;
  /**
   * "banner" makes the case, once, where the bulk flow would be. "inline" is
   * the same gate met a second time on a single listing, so it stays short —
   * a page never argues for an account twice.
   */
  variant?: "banner" | "inline";
};

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
  count,
  variant = "banner",
}: Props) {
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
              A report comes from the nation whose mark is being used. A{" "}
              {theirs ?? "different nation"} account can&rsquo;t file for {nation}.
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
            If you work for {nation} too, contact the 𐒻𐒼𐓂 Lab and we&rsquo;ll add it to your
            account.
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
              A report has to name the nation it comes from. Contact the 𐒻𐒼𐓂 Lab and
              we&rsquo;ll connect your account.
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
              You sign it under penalty of perjury, so it has to come from someone at {nation}.
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
            Anyone can read this page. Filing is different. A takedown notice is sworn under
            penalty of perjury, so it has to come from someone at {nation}. An account gives you
            all {count} {plural} as one paste-ready list, with the notice written for you. That
            is one filing instead of {count}.
          </p>
        </div>
      </div>

      {ways}

      <p className={styles.foot}>
        Free. Sign up with your nation&rsquo;s email address and we&rsquo;ll send you a link. If
        {" "}{nation} isn&rsquo;t listed yet, contact the 𐒻𐒼𐓂 Lab.
      </p>
    </section>
  );
}
