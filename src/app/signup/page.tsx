"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "../login/login.module.css";

/**
 * Signup collects an address and sends a link; the password is chosen on the
 * page that link opens.
 *
 * That round trip is not a formality. The whole gate is "you control an
 * address at this nation's domain" — clicking the emailed link is the only
 * thing that proves it. Setting a password here instead would mean anyone
 * could type someone@nation.gov and be that nation's staff, and it would put
 * the password through our own server, which it currently never touches.
 *
 * So the flow stays; what it says about itself does the work. The button and
 * the line under it name the next step before anyone commits to it.
 */
export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ nation: string | null; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [resent, setResent] = useState(false);

  async function send() {
    const resp = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, full_name: fullName, job_title: jobTitle }),
    });
    return { resp, json: await resp.json() };
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { resp, json } = await send();
    setBusy(false);
    if (!resp.ok) {
      setError(json.error ?? "Something went wrong. Try again.");
      return;
    }
    setDone(json);
  }

  async function resend() {
    setBusy(true);
    setError(null);
    const { resp, json } = await send();
    setBusy(false);
    if (!resp.ok) {
      setError(json.error ?? "Something went wrong. Try again.");
      return;
    }
    setResent(true);
  }

  if (done) {
    return (
      <main className={styles.page}>
        <div className={styles.card}>
          <h1 className={styles.title}>Check your email</h1>
          <p className={styles.sub}>
            {done.nation ? (
              <>
                We matched your address to <strong>{done.nation}</strong>. Open the link we sent to{" "}
                <strong>{email}</strong> and choose a password — that finishes your account.
              </>
            ) : (
              done.message
            )}
          </p>
          <p className={styles.note}>
            The link lasts 24 hours and works once. Nothing after a few minutes? Check your spam
            folder — and if your nation filters outside mail, ask IT to allow messages from
            Supabase.
          </p>
          {error && <p className={styles.error}>{error}</p>}
          <p className={styles.footLink}>
            {resent ? (
              "Sent again."
            ) : (
              <button type="button" className={styles.linkButton} onClick={resend} disabled={busy}>
                {busy ? "Sending…" : "Send the link again"}
              </button>
            )}
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
          For staff of the Tribal nations we monitor. Use your nation&rsquo;s email address — the
          domain is how we know which nation you work for.
        </p>

        <label className={styles.label} htmlFor="email">Work email</label>
        <input
          id="email" type="email" autoComplete="email" required autoFocus
          placeholder="you@yournation.gov"
          className={styles.input} value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <label className={styles.label} htmlFor="name">Full name</label>
        <input
          id="name" type="text" autoComplete="name" required
          className={styles.input} value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />

        <label className={styles.label} htmlFor="title">Job title (optional)</label>
        <input
          id="title" type="text" autoComplete="organization-title"
          className={styles.input} value={jobTitle}
          onChange={(e) => setJobTitle(e.target.value)}
        />
        <p className={styles.hint}>
          Your name and title sign the notices you file, so they appear as you type them.
        </p>

        {error && <p className={styles.error}>{error}</p>}

        <button className={styles.submit} type="submit" disabled={busy}>
          {busy ? "Checking…" : "Email me a link"}
        </button>
        <p className={styles.hint} style={{ margin: "14px 0 0" }}>
          You pick your password on the page that link opens. Clicking it is how we confirm the
          address is really yours.
        </p>

        <p className={styles.footLink}>
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      </form>
    </main>
  );
}
