"use client";

import { useId, useState } from "react";
import styles from "../login/login.module.css";

type Props = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  /** "new-password" while choosing one, "current-password" when signing in. */
  autoComplete: "new-password" | "current-password";
  /** Rendered to the right of the label — used for "Forgot password?". */
  action?: React.ReactNode;
  autoFocus?: boolean;
};

/**
 * A password input that can be revealed.
 *
 * Typing twelve unseen characters is where people give up or, worse, pick
 * something short enough to type reliably. Showing it is the safer default
 * for the person, not the riskier one — it starts hidden and never persists.
 */
export default function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  action,
  autoFocus,
}: Props) {
  const id = useId();
  const [shown, setShown] = useState(false);

  return (
    <>
      <div className={styles.labelRow}>
        <label className={styles.label} htmlFor={id}>
          {label}
        </label>
        {action}
      </div>
      <div className={styles.pwRow}>
        <input
          id={id}
          type={shown ? "text" : "password"}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          required
          className={styles.input}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          className={styles.reveal}
          onClick={() => setShown((v) => !v)}
          aria-pressed={shown}
          aria-label={shown ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
        >
          {shown ? "Hide" : "Show"}
        </button>
      </div>
    </>
  );
}
