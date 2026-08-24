"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "./SignUpPrompt.module.css";

// Versioned. The first release of this dialog lived on the landing page and
// wrote "op.signup-prompt.dismissed"; anyone who dismissed it there would
// never see this one, since it is a different dialog in a different place.
// Bump the suffix whenever the prompt changes enough to be worth showing again.
const DISMISS_KEY = "op.signup-prompt.monitor.v1";

/**
 * A one-time invitation shown on the monitor to signed-out visitors.
 *
 * It sits here rather than on the landing page because this is where the
 * account-only features are — someone meeting it has just arrived at the thing
 * an account is for.
 *
 * Small on purpose, and an offer rather than a gate: the record behind it is
 * public and stays that way, so it shows once, remembers being dismissed, and
 * closes on the button, the backdrop or Escape. The copy says plainly that
 * viewing is open to everyone and only filing is restricted.
 */
export default function SignUpPrompt() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY)) return;
    const t = setTimeout(() => setOpen(true), 1200);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function close() {
    localStorage.setItem(DISMISS_KEY, "1");
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className={styles.scrim} onClick={close}>
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="signup-prompt-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className={styles.title} id="signup-prompt-title">
          Reporting needs an account
        </h2>
        <p className={styles.body}>
          Anyone can look around the site. Filing a takedown is for Tribal nation staff, so that
          part needs an account.
        </p>

        <ul className={styles.list}>
          <li>Report listings to Amazon and Temu</li>
          <li>A monthly email when new ones turn up</li>
          <li>Open straight to your own nation</li>
        </ul>

        <div className={styles.actions}>
          <Link className={styles.primary} href="/signup" onClick={close}>
            Create an account
          </Link>
          <button type="button" className={styles.secondary} onClick={close}>
            Keep looking
          </button>
        </div>

        <p className={styles.foot}>
          Free. Sign up with your nation&rsquo;s email address, or{" "}
          <Link href="/login" onClick={close}>
            sign in
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
