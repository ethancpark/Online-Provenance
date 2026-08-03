import Link from "next/link";
import HotspotMap, { type TribeCount } from "./HotspotMap";
import styles from "./LandingPage.module.css";

type Props = {
  tribesMonitored: number;
  tribesAffected: number;
  totalListings: number;
  tribeCounts: TribeCount[];
  heroImages: string[];
};

const STEPS = [
  {
    title: "Find",
    body: "Every week we search Amazon and Temu for merchandise carrying tribal seals and flags.",
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
  heroImages,
}: Props) {
  const top = [...tribeCounts].sort((a, b) => b.count - a.count).slice(0, 5);

  return (
    <main className={styles.page}>
      {/* 1 — Header */}
      <header className={styles.header}>
        <span className={styles.wordmark}>Online Provenance</span>
        <nav className={styles.nav}>
          <a href="#how">How it works</a>
          <a href="#about">About</a>
          <Link href="/dashboard" className={styles.navButton}>
            Open the monitor
          </Link>
        </nav>
      </header>

      {/* 2 — Hero. The wallpaper is real flagged merchandise, in full colour. */}
      <section className={styles.hero}>
        <div className={styles.heroPhoto} aria-hidden="true">
          {heroImages.map((src, i) => (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img key={i} src={src} alt="" loading={i < 20 ? "eager" : "lazy"} />
          ))}
        </div>
        <div className={styles.heroScrim} aria-hidden="true" />
        <h1 className={styles.heroHeadline}>
          Every product behind this text is selling{" "}
          <span className={styles.highlight}>a tribe&rsquo;s seal.</span>
        </h1>
      </section>

      {/* 3 — Lede band */}
      <section className={styles.ledeBand}>
        <p className={styles.lede}>
          Sacred seals and trademarked flags of Native nations are printed on flags, hats and
          stickers by third-party sellers on Amazon and Temu — with no consent, credit, or
          compensation. We find them, prove it, and help nations get them taken down.
        </p>
        <div className={styles.ledeCtas}>
          <Link href="/dashboard" className={styles.ctaSolid}>
            See what we found
          </Link>
          <a href="#map" className={styles.ctaText}>
            Where it&rsquo;s happening
          </a>
        </div>
      </section>

      {/* 4 — Stat band */}
      <section className={styles.stats}>
        <div className={styles.stat}>
          <div className={`${styles.statNum} ${styles.statNumClay}`}>{totalListings}</div>
          <div className={styles.statLabel}>Listings flagged</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statNum}>{tribesAffected}</div>
          <div className={styles.statLabel}>Nations affected</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statNum}>{tribesMonitored}</div>
          <div className={styles.statLabel}>Nations monitored</div>
        </div>
      </section>

      {/* 5 — Credits band */}
      <section className={styles.credits} id="about">
        <p className={styles.creditText}>
          Online Provenance is a free tool built by Anish Thota, Ethan Park, and Dr. Elise
          Blasingame, a professor and citizen of the Osage Nation.{" "}
          <em>
            It is and will remain completely free — our only goal is to make it useful to Native
            communities.
          </em>
        </p>
        <div className={styles.creditMeta}>
          <p>𐒻𐒼𐓂 Lab — Indigenous Politics Lab, Emory University</p>
          <p>
            Accountable to the Native American and Indigenous Studies Initiative at Emory
          </p>
        </div>
      </section>

      {/* 6 — Map */}
      <section className={styles.mapSection} id="map">
        <div className={styles.mapHead}>
          <h2 className={styles.h2}>Where it&rsquo;s happening</h2>
          <p className={styles.mapCaption}>
            Every nation we monitor, placed at its reservation or seat of government. The larger
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
              <span className={styles.affectedNum}>{t.count}</span>
              <span className={styles.affectedName}>{t.name}</span>
            </span>
          ))}
        </div>
      </section>

      {/* 7 — How it works */}
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
    </main>
  );
}
