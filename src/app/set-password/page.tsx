"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase-browser";
import PasswordField from "../components/PasswordField";
import AuthShell from "../components/AuthShell";
import { passwordRules, firstProblem, MIN_LENGTH } from "@/lib/password";
import styles from "../login/login.module.css";

/**
 * Where both email links land: the invitation from signup, and the recovery
 * link from a password reset. All that is left by the time someone gets here
 * is choosing a password — the click on the link is what proves they control
 * the mailbox.
 *
 * The password goes from this page straight to Supabase. It never passes
 * through our own server, which is why it is set here rather than on the
 * signup form.
 *
 * ---------------------------------------------------------------------------
 * Why there is a button between arriving and the form
 *
 * Supabase's default email link points at its own /auth/v1/verify endpoint,
 * which spends the one-time token on the GET and redirects here with a
 * session. That works until the mailbox is behind a scanner. Emory — and every
 * other institution on Microsoft Defender for Office 365, which is most of the
 * nations we are writing to — fetches every link in every message to check it
 * before the recipient is allowed near it. The scanner's fetch is a GET, so it
 * spends the token, and the real click arrives to find it already used. The
 * user is told the link has expired minutes after it was sent, every time, and
 * asking for a fresh one produces another link the scanner eats first.
 *
 * So the link in the mail no longer verifies anything by being fetched. It
 * carries the token hash to this page, and nothing happens until someone
 * presses a button. Scanners follow links; they do not press buttons. The
 * matching email templates are in supabase/email-templates.md.
 *
 * Links of the old shape still work — a session that is already in place is
 * accepted — so mail sent before this deploy is not stranded.
 */

/** The token types our two mails can carry. Anything else is not ours. */
const LINK_TYPES = ["recovery", "invite", "signup", "magiclink", "email"] as const;
type LinkType = (typeof LINK_TYPES)[number];

type Phase = "checking" | "confirm" | "ready" | "expired";

/** Supabase's own messages arrive without a full stop, and ours follows it. */
function sentence(text: string): string {
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function asLinkType(v: string | null): LinkType | null {
  return LINK_TYPES.includes(v as LinkType) ? (v as LinkType) : null;
}

/**
 * Supabase reports failures in the URL fragment on the old redirect flow and
 * in the query string on the new one. Read both, and prefer its own wording
 * for anything we do not have a better sentence for.
 */
function linkError(params: URLSearchParams): { code: string; description: string } | null {
  const hash = new URLSearchParams(
    typeof window === "undefined" ? "" : window.location.hash.replace(/^#/, ""),
  );
  const code = hash.get("error_code") ?? params.get("error_code");
  const kind = hash.get("error") ?? params.get("error");
  if (!code && !kind) return null;
  const description = (hash.get("error_description") ?? params.get("error_description") ?? "")
    .replace(/\+/g, " ")
    .trim();
  return { code: code ?? kind ?? "", description };
}

function SetPassword() {
  const router = useRouter();
  const params = useSearchParams();

  const tokenHash = params.get("token_hash");
  const linkType = asLinkType(params.get("type"));
  const isReset = linkType === "recovery" || params.get("mode") === "reset";

  const [linkProblem, setLinkProblem] = useState<string | null>(null);
  // A token in the query string has not been spent yet — that is the whole
  // point of the new link shape — so the gate can be the very first render.
  // The query string is the only part of the URL the server also sees, which
  // is what makes it safe to decide a first render from.
  const [state, setState] = useState<Phase>(() =>
    tokenHash && linkType ? "confirm" : "checking",
  );
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Only a link of the old shape gets here: no token to spend, so either a
    // session is already in place or there is nothing to work with.
    if (state !== "checking") return;
    let dropped = false;
    getBrowserClient()
      .auth.getUser()
      .then(({ data }) => {
        if (dropped) return;
        if (data.user) {
          setEmail(data.user.email ?? "");
          setState("ready");
          return;
        }
        // The fragment is read here rather than during render: it never
        // reaches the server, so a first render that depends on it is a
        // hydration mismatch. By this point there is no session either way.
        const failed = linkError(params);
        if (failed) {
          // Worth distinguishing: "already used" is the scanner, "expired" is
          // genuinely stale mail, and they need different advice.
          setLinkProblem(
            failed.code === "otp_expired"
              ? "That link has already been used, or it is too old."
              : failed.description || null,
          );
        }
        setState("expired");
      });
    return () => {
      dropped = true;
    };
  }, [state, params]);

  /** The click that spends the token. Nothing before this touches it. */
  const confirmLink = useCallback(async () => {
    if (!tokenHash || !linkType) return;
    setBusy(true);
    setLinkProblem(null);

    const supabase = getBrowserClient();
    const { data, error: vErr } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: linkType,
    });
    setBusy(false);

    if (vErr || !data.user) {
      setLinkProblem(vErr?.message ?? null);
      setState("expired");
      return;
    }

    setEmail(data.user.email ?? "");
    setState("ready");
    // Drop the token out of the address bar so it is not left in history, in
    // the referrer, or in a screenshot of a shared screen.
    router.replace(isReset ? "/set-password?mode=reset" : "/set-password");
  }, [tokenHash, linkType, isReset, router]);

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
      <AuthShell>
        <div className={styles.card}>
          <h1 className={styles.title}>One moment</h1>
          <p className={styles.sub}>Checking your link.</p>
        </div>
      </AuthShell>
    );
  }

  // The gate. One button, and it is the only thing on the page that spends
  // the token.
  if (state === "confirm") {
    return (
      <AuthShell>
        <div className={styles.card}>
          <h1 className={styles.title}>{isReset ? "Reset your password" : "Confirm your email"}</h1>
          <p className={styles.sub}>
            {isReset
              ? "Press the button to confirm this was you, then choose a new password."
              : "Press the button to confirm your address, then choose a password."}
          </p>

          <button className={styles.submit} type="button" onClick={confirmLink} disabled={busy}>
            {busy ? "Checking…" : isReset ? "Continue to set a new password" : "Confirm and continue"}
          </button>

          <p className={styles.note}>
            Didn&rsquo;t ask for this? Close this page and nothing will change.
          </p>
        </div>
      </AuthShell>
    );
  }

  // An expired link used to be a dead end that needed a human. It is now
  // self-serve: the same reset flow issues a fresh one.
  if (state === "expired") {
    return (
      <AuthShell>
        <div className={styles.card}>
          <h1 className={styles.title}>This link didn&rsquo;t work</h1>
          <p className={styles.sub}>
            {sentence(linkProblem ?? "That link has already been used, or it is too old")} Links can
            only be used once. Ask for a new one and it will arrive in a minute or two.
          </p>
          <Link className={styles.submit} href="/forgot-password" style={{ textAlign: "center" }}>
            Send me a new link
          </Link>

          <hr className={styles.divider} />

          <Link className={styles.secondary} href="/login">
            Already set a password? Sign in
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
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
    </AuthShell>
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
        <AuthShell>
          <div className={styles.card}>
            <h1 className={styles.title}>One moment</h1>
          </div>
        </AuthShell>
      }
    >
      <SetPassword />
    </Suspense>
  );
}
