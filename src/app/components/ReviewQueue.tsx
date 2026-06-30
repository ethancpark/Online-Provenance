"use client";

import type { MatchRow, ConfidenceBand } from "@/lib/types";
import styles from "./Dashboard.module.css";

type Props = {
  matches: MatchRow[];
  selectedMatchId: string | null;
  onSelect: (id: string) => void;
};

function bandTagClass(band: ConfidenceBand) {
  if (band === "high") return styles.tagHigh;
  if (band === "medium") return styles.tagMed;
  return styles.tagLow;
}

function bandLabel(band: ConfidenceBand) {
  return band.charAt(0).toUpperCase() + band.slice(1);
}

export default function ReviewQueue({ matches, selectedMatchId, onSelect }: Props) {
  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <span className={styles.eyebrow}>Review queue</span>
        <span className={styles.eyebrow}>Amazon · Temu</span>
      </div>

      {matches.length === 0 && (
        <div className={styles.empty}>No flagged listings yet. The daily scan populates this queue.</div>
      )}

      {matches.map((m) => {
        const isSelected = m.id === selectedMatchId;
        const listing = m.listings;
        const pct = Math.round(m.confidence * 100);
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onSelect(m.id)}
            className={`${styles.row} ${isSelected ? styles.rowSel : ""}`}
          >
            <div className={styles.thumb}>
              {listing.image_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={listing.image_url} alt="" />
              ) : (
                <svg aria-hidden="true">
                  <use href="#seal-line" />
                </svg>
              )}
            </div>
            <div>
              <div className={styles.name}>{listing.title}</div>
              <div className={styles.meta}>
                <span className={styles.mkt}>{listing.marketplace}</span>
                <span className={`${styles.tag} ${bandTagClass(m.confidence_band)}`}>
                  {bandLabel(m.confidence_band)} · {pct}%
                </span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
