"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getBrowserClient } from "@/lib/supabase-browser";
import PasswordField from "../components/PasswordField";
import AuthShell from "../components/AuthShell";
import styles from "./login.module.css";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = getBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) {
      // Deliberately generic: never reveal whether the address has an account.
      setError("That email and password combination didn't work.");
      return;
    }
    router.push(params.get("next") ?? "/dashboard");
    router.refresh();
  }

  return (
    <AuthShell>
      <form className={styles.card} onSubmit={onSubmit}>
        <h1 className={styles.title}>Sign in</h1>
        <p className={styles.sub}>For staff of the Tribal nations we monitor.</p>

        <label className={styles.label} htmlFor="email">Email</label>
        <input
          id="email" type="email" autoComplete="email" required autoFocus
          className={styles.input} value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <PasswordField
          label="Password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          action={
            <Link className={styles.labelLink} href="/forgot-password">
              Forgot password?
            </Link>
          }
        />

        {error && <p className={styles.error}>{error}</p>}

        <button className={styles.submit} type="submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>

        <hr className={styles.divider} />

        <Link className={styles.secondary} href="/signup">
          Create an account
        </Link>
        <p className={styles.hint} style={{ margin: "12px 0 0" }}>
          Free, for staff of the nations we monitor. You&rsquo;ll need your nation&rsquo;s email
          address.
        </p>
      </form>
    </AuthShell>
  );
}

/**
 * useSearchParams() opts the subtree out of prerendering, so it has to live
 * inside a Suspense boundary or the production build fails on this route.
 */
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <AuthShell>
          <div className={styles.card}>
            <h1 className={styles.title}>Sign in</h1>
          </div>
        </AuthShell>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
