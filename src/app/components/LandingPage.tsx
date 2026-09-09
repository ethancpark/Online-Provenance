import Link from "next/link";
import { HERO_WALL } from "@/lib/heroImages";
import HotspotMap, { type TribeCount } from "./HotspotMap";
import AboutProject from "./AboutProject";
import AccountNav, { type SessionUser } from "./AccountNav";
import styles from "./LandingPage.module.css";

type Props = {
  tribesMonitored: number;
  tribesAffected: number;
  totalListings: number;
  tribeCounts: TribeCount[];
  sessionUser: SessionUser;
};

const n = (v: number) => v.toLocaleString("en-US");

const STEPS = [
  {
    title: "Find",
    body: "Every week we search Amazon and Temu for merchandise carrying Tribal seals and flags.",
  },
  {
    title: "Prove",
    body: "Each product photo is matched against the nation's registered mark, and scored.",
  },
  {
    title: "Remove",
    body: "Confirmed matches become a takedown notice a tribe can review and send.",
  },
];

export default function LandingPage({
  tribesMonitored,
  tribesAffected,
  totalListings,
  tribeCounts,
  sessionUser,
}: Props) {
  const top = [...tribeCounts].sort((a, b) => b.count - a.count).slice(0, 5);
  // A signed-in person goes straight to their own nation rather than to
  // whichever nation happens to have the most listings.
  const monitorHref = sessionUser?.nation
    ? `/dashboard?tribe=${encodeURIComponent(sessionUser.nation)}`
    : "/dashboard";

  return (
    <main className={styles.page}>
      {/* 1 — Header */}
      <header className={styles.header}>
        <Link href="/" className={styles.wordmark}>
          Online Provenance
        </Link>
        <nav className={styles.nav}>
          <a href="#how">How it works</a>
          <a href="#about">About</a>
          <AccountNav user={sessionUser} />
          <Link href={monitorHref} className={styles.navButton}>
            {sessionUser?.nation ? "Open your monitor" : "Open the monitor"}
          </Link>
        </nav>
      </header>

      {/* 2 — Hero. The wallpaper is real flagged merchandise, in full colour.
          One image per orientation rather than sixty tiles: sixty tiles is 25
          requests before a phone has any hero at all, and it left the hero an
          empty dark slab for seconds on cellular. A single sheet either
          arrives or does not. The portrait sheet is taller than the hero on
          purpose — the wall is cut off by the bottom edge instead of ending in
          a tidy block, because sixty products is a sample of the flagged
          listings, not all of them. */}
      <section className={styles.hero}>
        <picture className={styles.heroPhoto}>
          <source media="(max-width: 1000px)" type="image/webp" srcSet={HERO_WALL.portrait.webp} />
          <source media="(max-width: 1000px)" srcSet={HERO_WALL.portrait.jpg} />
          <source type="image/webp" srcSet={HERO_WALL.landscape.webp} />
          {/* alt="" rather than aria-hidden: the wall is decoration, and an
              <img> inside <picture> is the element that carries that. */}
          <img src={HERO_WALL.landscape.jpg} alt="" fetchPriority="high" decoding="async" />
        </picture>
        <div className={styles.heroScrim} aria-hidden="true" />
        <div className={styles.heroText}>
          <h1 className={styles.heroHeadline}>
            Every product behind this text is selling{" "}
            <span className={styles.highlight}>a tribe&rsquo;s seal.</span>
          </h1>
          {/* The wall shows sixty. The point of the hero is the number it is
              drawn from, so the hero says both. */}
          <p className={styles.heroCount}>
            <strong>{n(totalListings)}</strong> listings across{" "}
            <strong>{n(tribesAffected)}</strong> nations.{" "}
            <span className={styles.heroCountTail}>
              This wall shows {HERO_WALL.tiles} of them.
            </span>
          </p>
        </div>
      </section>

      {/* 3 — Action band */}
      <section className={styles.ledeBand}>
        <div className={styles.ledeCtas}>
          <Link href={monitorHref} className={styles.ctaSolid}>
            {sessionUser?.nation ? `See what we found for ${sessionUser.nation}` : "See what we found"}
          </Link>
          <a href="#map" className={styles.ctaText}>
            Where it&rsquo;s happening
          </a>
        </div>
      </section>

      {/* 4 — Stat band */}
      <section className={styles.stats}>
        <div className={styles.stat}>
          <div className={`${styles.statNum} ${styles.statNumClay}`}>{n(totalListings)}</div>
          <div className={styles.statLabel}>Listings flagged</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statNum}>{n(tribesAffected)}</div>
          <div className={styles.statLabel}>Nations affected</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statNum}>{n(tribesMonitored)}</div>
          <div className={styles.statLabel}>Nations monitored</div>
        </div>
      </section>

      {/* 5 — Map */}
      <section className={styles.mapSection} id="map">
        <div className={styles.mapHead}>
          <h2 className={styles.h2}>Where it&rsquo;s happening</h2>
          <p className={styles.mapCaption}>
            Every Tribal nation we monitor, placed at its reservation or seat of government. The larger
            the dot, the more of its marks we&rsquo;ve found for sale.
          </p>
        </div>
        <div className={styles.mapHolder}>
          <HotspotMap tribes={tribeCounts} />
        </div>
        <div className={styles.affected}>
          <span className={styles.affectedLabel}>Most affected</span>
          {top.map((t) => (
            <span key={t.name} className={styles.affectedItem}>
              <span className={styles.affectedNum}>{n(t.count)}</span>
              <span className={styles.affectedName}>{t.name}</span>
            </span>
          ))}
        </div>
      </section>

      {/* 6 — How it works */}
      <section className={styles.how} id="how">
        <div className={styles.howHead}>
          <h2 className={styles.howHeading}>How it works</h2>
          <p className={styles.howNote}>
            Nothing is sent automatically. A nation reviews every notice before it leaves.
          </p>
        </div>
        <div className={styles.steps}>
          {STEPS.map((s) => (
            <div key={s.title} className={styles.step}>
              <h3 className={styles.stepTitle}>{s.title}</h3>
              <p className={styles.stepBody}>{s.body}</p>
            </div>
          ))}
        </div>
      </section>
      {/* 7 — About */}
      <section className={styles.aboutBand} id="about">
        <AboutProject className={styles.about} />
        <p className={styles.aboutMeta}>𐒻𐒼𐓂 Lab — Indigenous Politics Lab, Emory University</p>
      </section>

    </main>
  );
}
