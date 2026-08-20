"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "../login/login.module.css";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ nation: string | null; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const resp = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, full_name: fullName, job_title: jobTitle }),
    });
    const json = await resp.json();
    setBusy(false);
    if (!resp.ok) {
      setError(json.error ?? "Something went wrong. Try again.");
      return;
    }
    setDone(json);
  }

  if (done) {
    return (
      <main className={styles.page}>
        <div className={styles.card}>
          <h1 className={styles.title}>Check your email</h1>
          <p className={styles.sub}>
            {done.nation ? (
              <>
                We recognised your email as belonging to <strong>{done.nation}</strong>. {done.message}
              </>
            ) : (
              done.message
            )}
          </p>
          <p className={styles.sub}>
            The link expires in 24 hours. If it doesn&rsquo;t arrive, check your spam folder.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <form className={styles.card} onSubmit={onSubmit}>
        <h1 className={styles.title}>Create an account</h1>
        <p className={styles.sub}>
          For staff of the Tribal nations we monitor. Use your nation&rsquo;s email address —
          we&rsquo;ll match the domain and connect you to your nation automatically.
        </p>

        <label className={styles.label} htmlFor="email">Work email</label>
        <input
          id="email" type="email" autoComplete="email" required
          placeholder="you@yournation.gov"
          className={styles.input} value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <label className={styles.label} htmlFor="name">Full name</label>
        <input
          id="name" type="text" autoComplete="name"
          className={styles.input} value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />

        <label className={styles.label} htmlFor="title">Job title (optional)</label>
        <input
          id="title" type="text" autoComplete="organization-title"
          className={styles.input} value={jobTitle}
          onChange={(e) => setJobTitle(e.target.value)}
        />

        {error && <p className={styles.error}>{error}</p>}

        <button className={styles.submit} type="submit" disabled={busy}>
          {busy ? "Checking…" : "Create account"}
        </button>

        <p className={styles.sub} style={{ marginTop: 20, marginBottom: 0 }}>
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      </form>
    </main>
  );
}
