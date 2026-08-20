"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getBrowserClient } from "@/lib/supabase-browser";
import styles from "./AccountNav.module.css";

export type SessionUser = {
  full_name: string | null;
  email: string;
  role: "lab_admin" | "tribal_admin" | "tribal_staff";
  nation: string | null;
} | null;

/**
 * Account controls for the site headers. `tone` matches the surface it sits
 * on: the landing header is paper, the monitor masthead is ink.
 */
export default function AccountNav({ user, tone = "light" }: { user: SessionUser; tone?: "light" | "dark" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const cls = tone === "dark" ? `${styles.wrap} ${styles.dark}` : styles.wrap;

  async function signOut() {
    setBusy(true);
    await getBrowserClient().auth.signOut();
    router.push("/");
    router.refresh();
  }

  if (!user) {
    return (
      <div className={cls}>
        <Link href="/login" className={styles.link}>Sign in</Link>
        <Link href="/signup" className={styles.primary}>Create account</Link>
      </div>
    );
  }

  return (
    <div className={cls}>
      <span className={styles.who}>
        <span className={styles.name}>{user.full_name ?? user.email}</span>
        {user.nation && <span className={styles.nation}>{user.nation}</span>}
      </span>
      {user.role === "lab_admin" && (
        <Link href="/admin" className={styles.link}>Accounts</Link>
      )}
      <button type="button" className={styles.link} onClick={signOut} disabled={busy}>
        {busy ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}
