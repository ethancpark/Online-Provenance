"use client";

import type { MatchRow, ConfidenceBand } from "@/lib/types";
import styles from "./Dashboard.module.css";

type Props = {
  matches: MatchRow[];
  selectedMatchId: string | null;
  onSelect: (id: string) => void;
};

// Severity is legible at a glance: high is a solid clay fill, medium is
// outlined in clay, low is a neutral outline.
function chipClass(band: ConfidenceBand) {
  if (band === "high") return styles.chipHigh;
  if (band === "medium") return styles.chipMedium;
  return styles.chipLow;
}

function bandLabel(band: ConfidenceBand) {
  return band.charAt(0).toUpperCase() + band.slice(1);
}

export default function ReviewQueue({ matches, selectedMatchId, onSelect }: Props) {
  return (
    <div className={styles.panel}>
      <div className={styles.queueHead}>
        <span className={styles.queueTitle}>Review queue</span>
        <span className={styles.queueSources}>Amazon · Temu</span>
      </div>

      {matches.length === 0 && (
        <div className={styles.emptyQueue}>
          No infringements detected. This nation is checked every week.
        </div>
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
            className={`${styles.row} ${isSelected ? styles.rowSelected : ""}`}
            aria-current={isSelected}
          >
            <span className={styles.thumb}>
              {listing.image_url && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={listing.image_url} alt="" />
              )}
            </span>
            <span>
              <span className={styles.rowTitle}>{listing.title}</span>
              <span className={styles.rowMeta}>
                <span className={styles.marketplace}>{listing.marketplace}</span>
                <span className={`${styles.chip} ${chipClass(m.confidence_band)}`}>
                  {bandLabel(m.confidence_band)} · {pct}%
                </span>
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
