"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getBrowserClient } from "@/lib/supabase-browser";
import styles from "./AccountNav.module.css";

export type SessionUser = {
  full_name: string | null;
  email: string;
  role: "lab_admin" | "tribal_admin" | "tribal_staff";
  /** The nation this account belongs to. Null for lab admins, by schema constraint. */
  tribe_id: string | null;
  nation: string | null;
  monthly_email: boolean;
} | null;

const ROLE_LABEL: Record<NonNullable<SessionUser>["role"], string> = {
  lab_admin: "Lab admin",
  tribal_admin: "Nation admin",
  tribal_staff: "Staff",
};

/** Initials from a name, else the first two letters of the mailbox. */
function initials(user: NonNullable<SessionUser>) {
  const source = user.full_name?.trim() || user.email.split("@")[0];
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : source.slice(0, 2);
  return letters.toUpperCase();
}

export default function AccountNav({
  user,
  tone = "light",
}: {
  user: SessionUser;
  tone?: "light" | "dark";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const cls = tone === "dark" ? `${styles.wrap} ${styles.dark}` : styles.wrap;

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function signOut() {
    setBusy(true);
    await getBrowserClient().auth.signOut();
    router.push("/");
    router.refresh();
  }

  if (!user) {
    return (
      <div className={cls}>
        <Link href="/login" className={styles.signIn}>Sign in</Link>
      </div>
    );
  }

  return (
    <div className={cls} ref={ref}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        // The label is for screen readers; the email is never painted on screen.
        aria-label={`Account menu for ${user.full_name ?? user.email}`}
      >
        <span className={styles.avatar}>{initials(user)}</span>
        <span className={styles.chevron} aria-hidden="true" />
      </button>

      {open && (
        <div className={styles.menu} role="menu">
          <div className={styles.identity}>
            <div className={styles.name}>{user.full_name ?? user.email.split("@")[0]}</div>
            <div className={styles.detail}>{user.email}</div>
            <div className={styles.badges}>
              <span className={styles.role}>{ROLE_LABEL[user.role]}</span>
              {user.nation && <span className={styles.detail}>{user.nation}</span>}
            </div>
          </div>

          <Link href="/account" className={styles.item} role="menuitem" onClick={() => setOpen(false)}>
            Account &amp; email updates
          </Link>
          {user.role === "lab_admin" && (
            <Link href="/admin" className={styles.item} role="menuitem" onClick={() => setOpen(false)}>
              Accounts
            </Link>
          )}
          <button type="button" className={styles.item} role="menuitem" onClick={signOut} disabled={busy}>
            {busy ? "Signing out…" : "Sign out"}
          </button>
        </div>
      )}
    </div>
  );
}
