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
  tribes,
  followedTribeId,
}: {
  initial: boolean;
  email: string;
  nation: string | null;
  /** Nations to choose from — only passed when the account has none of its own. */
  tribes?: { id: string; name: string }[];
  followedTribeId?: string | null;
}) {
  const [on, setOn] = useState(initial);
  const [followed, setFollowed] = useState(followedTribeId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mustPick = !nation && !!tribes;

  async function save(patch: Record<string, unknown>) {
    const supabase = getBrowserClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return "Your session expired. Sign in again.";
    const { error: upErr } = await supabase.from("profiles").update(patch).eq("id", auth.user.id);
    return upErr ? "Couldn't save that. Try again." : null;
  }

  async function pickNation(id: string) {
    const prev = followed;
    setFollowed(id);
    setBusy(true);
    setError(null);
    const err = await save({ monthly_email_tribe_id: id || null });
    setBusy(false);
    if (err) {
      setFollowed(prev);
      setError(err);
    }
  }

  async function toggle() {
    const next = !on;
    setBusy(true);
    setError(null);
    setOn(next); // optimistic — reverted below if the write fails
    const err = await save({ monthly_email: next });
    setBusy(false);
    if (err) {
      setOn(!next);
      setError(err);
    }
  }

  return (
    <section className={on ? `${styles.card} ${styles.cardOn}` : styles.card}>
      <div className={styles.toggleRow}>
        <div>
          <h2 className={styles.cardTitle}>Monthly email updates</h2>
          <p className={styles.cardBody}>
            On the first of each month we&rsquo;ll email <strong>{email}</strong> the new listings
            carrying {nation ? `the ${nation}` : "a nation's"} seal or flag that appeared on Amazon
            and Temu that month. Nothing new that month means no email.
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

      {/* A lab admin belongs to no nation, so the digest has nothing to be about
          until one is chosen. Without this the switch turned on and no email
          ever came. */}
      {mustPick && (
        <div className={styles.pick}>
          <label className={styles.pickLabel} htmlFor="follow-nation">
            Your account isn&rsquo;t tied to a nation. Choose one to follow:
          </label>
          <select
            id="follow-nation"
            className={styles.select}
            value={followed}
            onChange={(e) => pickNation(e.target.value)}
            disabled={busy}
          >
            <option value="">Select a nation…</option>
            {tribes!.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className={styles.state}>
        <span className={on ? `${styles.dot} ${styles.dotOn}` : styles.dot} aria-hidden="true" />
        {busy
          ? "Saving…"
          : !on
            ? "Off — no email will be sent"
            : mustPick && !followed
              ? "On, but no nation chosen yet — nothing will send"
              : "On — you'll get the next one"}
      </div>

      {error && <p className={styles.error}>{error}</p>}
    </section>
  );
}
