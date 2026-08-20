"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase-browser";
import PasswordField from "../components/PasswordField";
import { passwordRules, firstProblem, MIN_LENGTH } from "@/lib/password";
import styles from "../login/login.module.css";

/**
 * Where both email links land: the invitation from signup, and the recovery
 * link from a password reset. Supabase has already verified the person
 * controls the mailbox by the time they get here — that click is the whole
 * point of the round trip — so all that is left is choosing a password.
 *
 * The password goes from this page straight to Supabase. It never passes
 * through our own server, which is why it is set here rather than on the
 * signup form.
 */
function SetPassword() {
  const router = useRouter();
  const params = useSearchParams();
  const isReset = params.get("mode") === "reset";

  const [state, setState] = useState<"checking" | "ready" | "expired">("checking");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // The link puts a session in place; confirm before showing the form.
    getBrowserClient()
      .auth.getUser()
      .then(({ data }) => {
        if (data.user) {
          setEmail(data.user.email ?? "");
          setState("ready");
        } else {
          setState("expired");
        }
      });
  }, []);

  const rules = passwordRules(pw, email);
  const matches = pw.length > 0 && pw === pw2;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const problem = firstProblem(pw, email);
    if (problem) {
      setError(`That password does not meet one of the rules: ${problem.toLowerCase()}.`);
      return;
    }
    if (pw !== pw2) {
      setError("Those two passwords don't match.");
      return;
    }

    setBusy(true);
    const supabase = getBrowserClient();
    const { error: upErr } = await supabase.auth.updateUser({ password: pw });
    if (upErr) {
      setBusy(false);
      setError(upErr.message);
      return;
    }
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      await supabase.from("profiles").update({ status: "active" }).eq("id", data.user.id);
    }
    setBusy(false);
    router.push("/dashboard");
    router.refresh();
  }

  if (state === "checking") {
    return (
      <main className={styles.page}>
        <div className={styles.card}>
          <h1 className={styles.title}>One moment</h1>
          <p className={styles.sub}>Checking your link.</p>
        </div>
      </main>
    );
  }

  // An expired link used to be a dead end that needed a human. It is now
  // self-serve: the same reset flow issues a fresh one.
  if (state === "expired") {
    return (
      <main className={styles.page}>
        <div className={styles.card}>
          <h1 className={styles.title}>This link has expired</h1>
          <p className={styles.sub}>
            Links last 24 hours and can only be used once. Ask for a new one and it will arrive in
            a minute or two.
          </p>
          <Link className={styles.submit} href="/forgot-password" style={{ textAlign: "center" }}>
            Send me a new link
          </Link>
          <p className={styles.footLink}>
            Already set a password? <Link href="/login">Sign in</Link>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <form className={styles.card} onSubmit={onSubmit}>
        <h1 className={styles.title}>{isReset ? "Set a new password" : "Choose a password"}</h1>
        <p className={styles.sub}>
          {isReset ? "Signing in as " : "Your email is verified. You'll sign in as "}
          <strong>{email}</strong>. A long phrase you can remember beats a short, complicated one —
          {" "}{MIN_LENGTH} characters is the minimum, not the target.
        </p>

        <PasswordField label="Password" value={pw} onChange={setPw} autoComplete="new-password" autoFocus />

        <ul className={styles.rules}>
          {rules.map((r) => (
            <li key={r.label} className={r.met ? `${styles.rule} ${styles.ruleMet}` : styles.rule}>
              <span className={styles.ruleMark} aria-hidden="true">
                {r.met ? "✓" : "·"}
              </span>
              <span>{r.label}</span>
            </li>
          ))}
        </ul>

        <PasswordField
          label="Confirm password"
          value={pw2}
          onChange={setPw2}
          autoComplete="new-password"
        />
        {pw2.length > 0 && !matches && (
          <p className={styles.error} style={{ marginTop: -8 }}>
            Those two don&rsquo;t match yet.
          </p>
        )}

        {error && <p className={styles.error}>{error}</p>}

        <button className={styles.submit} type="submit" disabled={busy}>
          {busy ? "Saving…" : isReset ? "Save and sign in" : "Set password and continue"}
        </button>
      </form>
    </main>
  );
}

/**
 * useSearchParams() opts the subtree out of prerendering, so it has to live
 * inside a Suspense boundary or the production build fails on this route.
 */
export default function SetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className={styles.page}>
          <div className={styles.card}>
            <h1 className={styles.title}>One moment</h1>
          </div>
        </main>
      }
    >
      <SetPassword />
    </Suspense>
  );
}
