"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "../login/login.module.css";

/**
 * Ask for a fresh link. This covers both cases that used to need a human:
 * a forgotten password, and an invitation that expired before it was used.
 *
 * The reply is the same whether or not the address has an account. Saying
 * otherwise would let anyone check which Tribal nation staff are registered.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const resp = await fetch("/api/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const json = await resp.json();
    setBusy(false);
    if (!resp.ok) {
      setError(json.error ?? "Something went wrong. Try again.");
      return;
    }
    setSent(json.message);
  }

  if (sent) {
    return (
      <main className={styles.page}>
        <div className={styles.card}>
          <h1 className={styles.title}>Check your email</h1>
          <p className={styles.sub}>{sent}</p>
          <p className={styles.note}>
            Nothing after a few minutes? Check your spam folder. If your nation filters outside
            mail, ask IT to allow messages from Supabase, or contact the 𐒻𐒼𐓂 Lab.
          </p>
          <p className={styles.footLink}>
            <Link href="/login">Back to sign in</Link>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <form className={styles.card} onSubmit={onSubmit}>
        <h1 className={styles.title}>Reset your password</h1>
        <p className={styles.sub}>
          Enter the address you signed up with and we&rsquo;ll email you a link to set a new
          password. Use this too if your invitation link expired.
        </p>

        <label className={styles.label} htmlFor="email">Email</label>
        <input
          id="email" type="email" autoComplete="email" required autoFocus
          className={styles.input} value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        {error && <p className={styles.error}>{error}</p>}

        <button className={styles.submit} type="submit" disabled={busy}>
          {busy ? "Sending…" : "Email me a link"}
        </button>

        <p className={styles.footLink}>
          Remembered it? <Link href="/login">Sign in</Link>
        </p>
      </form>
    </main>
  );
}
