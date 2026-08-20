import Link from "next/link";
import styles from "../login/login.module.css";

/**
 * The frame around every auth page.
 *
 * These pages used to be a bare card on an empty ground: nothing said which
 * site you were on, and nothing led back out. Someone who opened sign-in by
 * mistake had the browser's back button and nothing else. The wordmark fixes
 * both — it names the site and it is the way out.
 */
export default function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <Link href="/" className={styles.back}>
          <span className={styles.backArrow} aria-hidden="true">
            ←
          </span>
          Online Provenance
        </Link>
        {children}
      </div>
    </main>
  );
}
