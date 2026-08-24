"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "./SignUpPrompt.module.css";

const DISMISS_KEY = "op.signup-prompt.dismissed";

/**
 * A one-time invitation for signed-out visitors.
 *
 * Small on purpose. The record itself is public and the page behind this is
 * the point of the site, so this is an offer, not a gate: it shows once,
 * remembers being dismissed, and closes on the button, the backdrop or Escape.
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
          Working for a Tribal nation?
        </h2>
        <p className={styles.body}>
          Browsing needs no account. An account lets you act on what&rsquo;s here:
        </p>

        <ul className={styles.list}>
          <li>File a takedown, with the notice written for you</li>
          <li>A monthly email of new listings using your seal</li>
          <li>The monitor opens on your nation</li>
        </ul>

        <div className={styles.actions}>
          <Link className={styles.primary} href="/signup" onClick={close}>
            Create an account
          </Link>
          <button type="button" className={styles.secondary} onClick={close}>
            Not now
          </button>
        </div>

        <p className={styles.foot}>
          Free, verified by your nation&rsquo;s email domain.{" "}
          <Link href="/login" onClick={close}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
