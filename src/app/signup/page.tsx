"use client";

import { useState } from "react";
import Link from "next/link";
import AuthShell from "../components/AuthShell";
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
      <AuthShell>
        <div className={styles.card}>
          <h1 className={styles.title}>Check your email</h1>
          <p className={styles.sub}>
            {done.nation ? (
              <>
                Matched to <strong>{done.nation}</strong>. Open the link we sent to{" "}
                <strong>{email}</strong> to set your password.
              </>
            ) : (
              done.message
            )}
          </p>
          <p className={styles.note}>
            The link works once and expires in 24 hours. Check spam if it doesn&rsquo;t arrive.
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
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <form className={styles.card} onSubmit={onSubmit}>
        <h1 className={styles.title}>Create an account</h1>
        <p className={styles.sub}>
          For staff of the Tribal nations we monitor. Use your nation&rsquo;s email address.
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
          Your name and title appear on the notices you file.
        </p>

        {error && <p className={styles.error}>{error}</p>}

        <button className={styles.submit} type="submit" disabled={busy}>
          {busy ? "Checking…" : "Email me a link"}
        </button>
        <p className={styles.hint} style={{ margin: "14px 0 0" }}>
          We&rsquo;ll email you a link to set your password.
        </p>

        <hr className={styles.divider} />

        <Link className={styles.secondary} href="/login">
          I already have an account
        </Link>
      </form>
    </AuthShell>
  );
}
