"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase-browser";
import styles from "../login/login.module.css";

/**
 * Where an invited user lands. Supabase has already verified they control the
 * mailbox; here they choose a password. We never see or store it ourselves.
 */
export default function SetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // The invite link puts a session in place; confirm before showing the form.
    getBrowserClient()
      .auth.getUser()
      .then(({ data }) => setReady(Boolean(data.user)));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (pw.length < 12) {
      setError("Use at least 12 characters. A short phrase is fine and easier to remember.");
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

  if (!ready) {
    return (
      <main className={styles.page}>
        <div className={styles.card}>
          <h1 className={styles.title}>Invitation link</h1>
          <p className={styles.sub}>
            This link has expired or was already used. Ask the 𐒻𐒼𐓂 Lab to send a new invitation.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <form className={styles.card} onSubmit={onSubmit}>
        <h1 className={styles.title}>Choose a password</h1>
        <p className={styles.sub}>
          Your email is already verified. Pick a password of at least 12 characters — only you
          will ever know it.
        </p>

        <label className={styles.label} htmlFor="pw">Password</label>
        <input id="pw" type="password" autoComplete="new-password" required
          className={styles.input} value={pw} onChange={(e) => setPw(e.target.value)} />

        <label className={styles.label} htmlFor="pw2">Confirm password</label>
        <input id="pw2" type="password" autoComplete="new-password" required
          className={styles.input} value={pw2} onChange={(e) => setPw2(e.target.value)} />

        {error && <p className={styles.error}>{error}</p>}

        <button className={styles.submit} type="submit" disabled={busy}>
          {busy ? "Saving…" : "Set password and continue"}
        </button>
      </form>
    </main>
  );
}
