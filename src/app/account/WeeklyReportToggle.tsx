"use client";

import { useState } from "react";
import { getBrowserClient } from "@/lib/supabase-browser";
import styles from "./account.module.css";

/**
 * The weekly meeting report opt-in. Written straight to the person's own
 * profile row, exactly like the monthly toggle above it — profiles_update_self
 * allows that and nothing more.
 *
 * Accounts without a nation of their own follow the nation chosen in the
 * monthly card, so there is one place to choose it rather than two that can
 * disagree.
 */
export default function WeeklyReportToggle({
  initial,
  email,
  nation,
  needsNation,
}: {
  initial: boolean;
  email: string;
  nation: string | null;
  /** True when the account has no nation and has not chosen one to follow yet. */
  needsNation: boolean;
}) {
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    const next = !on;
    setBusy(true);
    setError(null);
    setOn(next); // optimistic — reverted below if the write fails
    const supabase = getBrowserClient();
    const { data: auth } = await supabase.auth.getUser();
    const { error: upErr } = auth.user
      ? await supabase.from("profiles").update({ weekly_report: next }).eq("id", auth.user.id)
      : { error: new Error("signed out") };
    setBusy(false);
    if (upErr) {
      setOn(!next);
      setError(auth.user ? "Couldn't save that. Try again." : "Your session expired. Sign in again.");
    }
  }

  return (
    <section className={on ? `${styles.card} ${styles.cardOn}` : styles.card}>
      <div className={styles.toggleRow}>
        <div>
          <h2 className={styles.cardTitle}>Weekly meeting report</h2>
          <p className={styles.cardBody}>
            Every Monday, after the weekend scan, we&rsquo;ll email <strong>{email}</strong> a
            spreadsheet of the past week&rsquo;s listings carrying{" "}
            {nation ? `the ${nation}` : "the followed nation's"} seal or flag, ready to print for
            leadership&rsquo;s weekly meeting. A week with nothing new sends nothing.
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Weekly meeting report"
          className={on ? `${styles.switch} ${styles.switchOn}` : styles.switch}
          onClick={toggle}
          disabled={busy}
        >
          <span className={styles.knob} />
        </button>
      </div>

      <div className={styles.state}>
        <span className={on ? `${styles.dot} ${styles.dotOn}` : styles.dot} aria-hidden="true" />
        {busy
          ? "Saving…"
          : !on
            ? "Off — no email will be sent"
            : needsNation
              ? "On, but no nation chosen yet — pick one in the monthly card above"
              : "On — you'll get the next one"}
      </div>

      {error && <p className={styles.error}>{error}</p>}
    </section>
  );
}
