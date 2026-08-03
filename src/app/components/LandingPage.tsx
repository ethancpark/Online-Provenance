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
    n: "01",
    title: "Find",
    body: "Every week we search Amazon and Temu for merchandise carrying tribal seals and flags.",
  },
  {
    n: "02",
    title: "Prove",
    body: "Each product photo is matched against the nation's registered mark, and scored.",
  },
  {
    n: "03",
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
      <header className={styles.nav}>
        <span className={styles.brand}>Online Provenance</span>
        <Link href="/dashboard" className={styles.navCta}>
          Open the monitor
        </Link>
      </header>

      {/* Hero — the wallpaper is real flagged merchandise */}
      <section className={styles.hero}>
        <div className={styles.heroGrid} aria-hidden="true">
          {heroImages.map((src, i) => (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img key={i} src={src} alt="" loading="lazy" />
          ))}
        </div>
        <div className={styles.heroScrim} aria-hidden="true" />
        <div className={styles.heroInner}>
          <h1 className={styles.h1}>
            Every product behind this text
            <br />
            is selling a tribe&rsquo;s seal.
          </h1>
          <p className={styles.lede}>
            Sacred seals and trademarked flags of Native nations are printed on flags, hats and
            stickers by third-party sellers on Amazon and Temu — with no consent, credit, or
            compensation. We find them, prove it, and help nations get them taken down.
          </p>
          <div className={styles.ctaRow}>
            <Link href="/dashboard" className={styles.cta}>
              See what we found →
            </Link>
            <a href="#map" className={styles.ctaGhost}>
              Where it&rsquo;s happening
            </a>
          </div>
        </div>
      </section>

      {/* Impact */}
      <section className={styles.stats}>
        <div className={styles.stat}>
          <div className={styles.statNum}>{totalListings.toLocaleString()}</div>
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

      {/* Map */}
      <section className={styles.mapSection} id="map">
        <div className={styles.mapHead}>
          <h2 className={styles.h2}>Where it&rsquo;s happening</h2>
          <p className={styles.mapSub}>
            Every nation we monitor, placed at its reservation or seat of government. The darker
            the state and the larger the dot, the more of its marks we&rsquo;ve found for sale.
          </p>
        </div>
        <HotspotMap tribes={tribeCounts} />
        <div className={styles.topList}>
          <span className={styles.topLabel}>Most affected</span>
          {top.map((t) => (
            <span key={t.name} className={styles.topItem}>
              <b>{t.count}</b> {t.name}
            </span>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className={styles.how}>
        <h2 className={styles.h2}>How it works</h2>
        <div className={styles.steps}>
          {STEPS.map((s) => (
            <div key={s.n} className={styles.step}>
              <div className={styles.stepNum}>{s.n}</div>
              <h3 className={styles.stepTitle}>{s.title}</h3>
              <p className={styles.stepBody}>{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className={styles.footer}>
        <div>
          <div className={styles.footBrand}>Online Provenance</div>
          <p className={styles.footNote}>
            A project of the 𐒻𐒼𐓂 Lab at Emory University. Free to use, and always will be.
            Matches are automated and unconfirmed until a person reviews them.
          </p>
        </div>
        <Link href="/dashboard" className={styles.cta}>
          Open the monitor →
        </Link>
      </footer>
    </main>
  );
}
