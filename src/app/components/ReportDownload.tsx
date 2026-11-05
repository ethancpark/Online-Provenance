"use client";

import { useState } from "react";
import styles from "./ReportDownload.module.css";

/** YYYY-MM-DD in UTC, matching how /api/report windows its days. */
const ymd = (d: Date) => d.toISOString().slice(0, 10);

function lastWeek() {
  const today = new Date();
  const monday = new Date(today);
  monday.setUTCDate(today.getUTCDate() - ((today.getUTCDay() + 6) % 7) - 7);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return { from: ymd(monday), to: ymd(sunday) };
}

/**
 * Download the meeting spreadsheet for any date range. Only rendered for
 * people cleared by lib/access.ts for the nation on screen; /api/report checks
 * again on the server.
 */
export default function ReportDownload({ tribeId, nation }: { tribeId: string; nation: string }) {
  const initial = lastWeek();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const valid = from && to && from <= to;
  const href = (format: "xlsx" | "csv") =>
    `/api/report?tribe=${encodeURIComponent(tribeId)}&from=${from}&to=${to}${format === "csv" ? "&format=csv" : ""}`;

  return (
    <section className={styles.bar} aria-label="Download a listings report">
      <div className={styles.text}>
        <div className={styles.title}>Listings report</div>
        <div className={styles.sub}>
          Spreadsheet of everything found for {nation} in a date range, formatted for a meeting.
        </div>
      </div>
      <div className={styles.controls}>
        <label className={styles.field}>
          <span>From</span>
          <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className={styles.field}>
          <span>To</span>
          <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </label>
        {valid ? (
          <>
            <a className={styles.primary} href={href("xlsx")}>
              Download (Excel)
            </a>
            <a className={styles.secondary} href={href("csv")}>
              CSV
            </a>
          </>
        ) : (
          <span className={styles.sub}>Choose a start date on or before the end date.</span>
        )}
      </div>
    </section>
  );
}
