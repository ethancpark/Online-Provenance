"use client";

import { useMemo, useState } from "react";
import type { MatchRow, Tribe } from "@/lib/types";
import type { SessionUser } from "./AccountNav";
import {
  buildBatchNotice,
  batchIdList,
  batchChunks,
  marketplaceName,
  noticeSubject,
  submissionRoute,
  AMAZON_BATCH_LIMIT,
  type BatchInput,
  type BatchListing,
} from "@/lib/notice";
import styles from "./BulkReport.module.css";

type Props = { matches: MatchRow[]; tribe: Tribe | null; sessionUser: SessionUser };

/**
 * Filing one listing at a time means thirty forms for a nation like Choctaw.
 * Amazon accepts up to 50 listings per report as long as they share one
 * infringement type — and a nation's basis is uniform — so the whole queue
 * usually goes in a single submission.
 */
export default function BulkReport({ matches, tribe, sessionUser }: Props) {
  const [open, setOpen] = useState(false);
  const [marketplace, setMarketplace] = useState<string>("amazon");
  const [copied, setCopied] = useState<string | null>(null);

  const byMarketplace = useMemo(() => {
    const m = new Map<string, MatchRow[]>();
    for (const row of matches) {
      const key = row.listings.marketplace;
      m.set(key, [...(m.get(key) ?? []), row]);
    }
    return m;
  }, [matches]);

  const selected = byMarketplace.get(marketplace) ?? [];
  if (!tribe || matches.length === 0) return null;

  const listings: BatchListing[] = selected.map((m) => ({
    title: m.listings.title,
    url: m.listings.listing_url,
    marketplaceId: m.listings.marketplace_id,
    seller: m.listings.seller,
    confidencePct: Math.round(m.confidence * 100),
  }));

  const chunks = batchChunks(listings, AMAZON_BATCH_LIMIT);

  const input: BatchInput = {
    claimant: {
      full_name: sessionUser?.full_name ?? sessionUser?.email?.split("@")[0] ?? "",
      job_title: null,
      email: sessionUser?.email ?? "",
      nation: sessionUser?.nation ?? tribe.name,
    },
    nation: tribe.name,
    usptoRegistered: tribe.has_registered_mark,
    usptoUrl: tribe.uspto_search_url,
    assetDescription: selected[0]?.reference_assets.description ?? `${tribe.name} seal`,
    marketplace,
    listings,
  };

  const route = submissionRoute({ ...input, listingTitle: "", listingUrl: "", marketplaceId: null, seller: null, confidencePct: 0 });
  const mpName = marketplaceName(marketplace);

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 2500);
    } catch {
      setCopied("failed");
    }
  }

  if (!sessionUser) return null;

  return (
    <section className={styles.wrap}>
      {!open ? (
        <button type="button" className={styles.launch} onClick={() => setOpen(true)}>
          <span>
            <span className={styles.launchTitle}>
              Report all {matches.length} listing{matches.length === 1 ? "" : "s"} at once
            </span>
            <span className={styles.launchSub}>
              One form submission instead of {matches.length} — {mpName} accepts up to{" "}
              {AMAZON_BATCH_LIMIT} listings per report
            </span>
          </span>
          <span className={styles.launchArrow}>→</span>
        </button>
      ) : (
        <div className={styles.panel}>
          <div className={styles.head}>
            <h2 className={styles.title}>File one report for {tribe.name}</h2>
            <button type="button" className={styles.close} onClick={() => setOpen(false)}>
              Close
            </button>
          </div>

          {byMarketplace.size > 1 && (
            <div className={styles.tabs}>
              {[...byMarketplace.entries()].map(([mp, rows]) => (
                <button
                  key={mp}
                  type="button"
                  className={mp === marketplace ? `${styles.tab} ${styles.tabOn}` : styles.tab}
                  onClick={() => setMarketplace(mp)}
                >
                  {marketplaceName(mp)} ({rows.length})
                </button>
              ))}
            </div>
          )}

          <ol className={styles.steps}>
            <li>
              <div className={styles.stepTitle}>Sign in to {mpName} first</div>
              <p className={styles.stepBody}>
                {route.requirement ?? `${mpName} requires an account to accept a report.`} Open it
                in another tab, sign in, then come back.
              </p>
              <a className={styles.stepLink} href={route.primary} target="_blank" rel="noopener noreferrer">
                Open {route.primaryLabel} ↗
              </a>
            </li>

            <li>
              <div className={styles.stepTitle}>Paste the listing IDs</div>
              <p className={styles.stepBody}>
                The form has a field for ASINs or product URLs. Paste all {listings.length} at once.
              </p>
              <pre className={styles.ids}>{batchIdList(listings) || "No IDs recorded"}</pre>
              <button
                type="button"
                className={styles.copyBtn}
                onClick={() => copy(batchIdList(listings), "ids")}
              >
                {copied === "ids" ? "Copied ✓" : `Copy ${listings.length} IDs`}
              </button>
            </li>

            <li>
              <div className={styles.stepTitle}>Paste the notice</div>
              <p className={styles.stepBody}>
                Put this in the form&rsquo;s description field. It names every listing and carries
                the sworn statement the form requires.
              </p>
              <details className={styles.preview}>
                <summary>Read the full notice before filing</summary>
                <div className={styles.noticeSubject}>{noticeSubject({ ...input, listingTitle: "", listingUrl: "", marketplaceId: null, seller: null, confidencePct: 0 })}</div>
                <pre className={styles.noticeBody}>{buildBatchNotice({ ...input, listings: chunks[0] ?? [] })}</pre>
              </details>
              <button
                type="button"
                className={styles.copyBtn}
                onClick={() => copy(buildBatchNotice({ ...input, listings: chunks[0] ?? [] }), "notice")}
              >
                {copied === "notice" ? "Copied ✓" : "Copy notice"}
              </button>
            </li>
          </ol>

          {chunks.length > 1 && (
            <p className={styles.warn}>
              {listings.length} listings exceeds the {AMAZON_BATCH_LIMIT}-per-report limit, so this
              needs {chunks.length} submissions. The buttons above cover the first{" "}
              {chunks[0].length}.
            </p>
          )}

          {route.alternative && (
            <p className={styles.alt}>
              {route.alternative.note}{" "}
              <a href={route.alternative.url} target="_blank" rel="noopener noreferrer">
                {route.alternative.label} ↗
              </a>
            </p>
          )}

          <p className={styles.disclaimer}>
            You file this yourself and sign it under penalty of perjury. Review every listing above
            first — these are automated matches, and whoever files is responsible for accuracy.
          </p>
        </div>
      )}
    </section>
  );
}
