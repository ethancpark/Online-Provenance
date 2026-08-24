"use client";

import { useState } from "react";
import { getBrowserClient } from "@/lib/supabase-browser";
import styles from "./account.module.css";

/**
 * The monthly digest opt-in.
 *
 * Written straight from the browser to Supabase: the profiles_update_self
 * policy already permits a person to change their own row while blocking any
 * change to role or tribe_id, so this needs no endpoint of its own and cannot
 * be pointed at somebody else's account.
 *
 * Off is the default and the switch says which state it is in without relying
 * on colour alone — this is the one setting on the page and it should never be
 * ambiguous whether mail is coming.
 */
export default function MonthlyEmailToggle({
  initial,
  email,
  nation,
}: {
  initial: boolean;
  email: string;
  nation: string | null;
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
    if (!auth.user) {
      setOn(!next);
      setBusy(false);
      setError("Your session expired. Sign in again.");
      return;
    }
    const { error: upErr } = await supabase
      .from("profiles")
      .update({ monthly_email: next })
      .eq("id", auth.user.id);
    setBusy(false);
    if (upErr) {
      setOn(!next);
      setError("Couldn't save that. Try again.");
    }
  }

  return (
    <section className={on ? `${styles.card} ${styles.cardOn}` : styles.card}>
      <div className={styles.toggleRow}>
        <div>
          <h2 className={styles.cardTitle}>Monthly email updates</h2>
          <p className={styles.cardBody}>
            On the first of each month we&rsquo;ll email <strong>{email}</strong> the new listings
            carrying {nation ? `the ${nation}` : "your nation's"} seal or flag that appeared on
            Amazon and Temu that month. Nothing new that month means no email.
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Monthly email updates"
          className={on ? `${styles.switch} ${styles.switchOn}` : styles.switch}
          onClick={toggle}
          disabled={busy}
        >
          <span className={styles.knob} />
        </button>
      </div>

      <div className={styles.state}>
        <span className={on ? `${styles.dot} ${styles.dotOn}` : styles.dot} aria-hidden="true" />
        {busy ? "Saving…" : on ? "On — you'll get the next one" : "Off — no email will be sent"}
      </div>

      {error && <p className={styles.error}>{error}</p>}
    </section>
  );
}
