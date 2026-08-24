import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile, getSessionUser } from "@/lib/auth";
import AccountNav from "../components/AccountNav";
import MonthlyEmailToggle from "./MonthlyEmailToggle";
import styles from "./account.module.css";

export const dynamic = "force-dynamic";

/**
 * The signed-in person's own settings. Middleware already redirects signed-out
 * visitors, but the profile is re-read here rather than trusted from the
 * session — the redirect is convenience, the data is the authority.
 */
export default async function AccountPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login?next=/account");
  const sessionUser = await getSessionUser();

  return (
    <div className={styles.shell}>
      <header className={styles.masthead}>
        <div className={styles.mastIn}>
          <Link href="/" className={styles.wordmark}>
            Online Provenance
          </Link>
          <div className={styles.topRight}>
            <Link href="/dashboard" className={styles.topLink}>
              Open the monitor
            </Link>
            <AccountNav user={sessionUser} tone="dark" />
          </div>
        </div>
      </header>

      <main className={styles.body}>
        <div className={styles.head}>
          <div className={styles.eyebrow}>Your account</div>
          <h1 className={styles.title}>{profile.full_name ?? profile.email.split("@")[0]}</h1>
          <div className={styles.meta}>
            <span>{profile.email}</span>
            {sessionUser?.nation && <span>{sessionUser.nation}</span>}
          </div>
        </div>

        <MonthlyEmailToggle
          initial={profile.monthly_email}
          email={profile.email}
          nation={sessionUser?.nation ?? null}
        />

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Password</h2>
          <p className={styles.cardBody}>
            Passwords are set from an emailed link and never pass through this site, so changing
            one goes the same route as resetting it.
          </p>
          <Link href="/forgot-password" className={styles.secondary}>
            Change password
          </Link>
        </section>
      </main>
    </div>
  );
}
