"use client";

import { useState } from "react";
import type { MatchRow, Tribe } from "@/lib/types";
import styles from "./Dashboard.module.css";

type Props = { match: MatchRow | null; tribe: Tribe | null };

function marketplaceLabel(mp: string) {
  if (mp === "amazon") return "Amazon US";
  if (mp === "temu") return "Temu";
  return mp;
}

// Short marketplace name for button copy and links ("Report to Amazon").
function marketplaceName(mp: string) {
  if (mp === "amazon") return "Amazon";
  if (mp === "temu") return "Temu";
  return mp.charAt(0).toUpperCase() + mp.slice(1);
}

type NoticeArgs = {
  tribeName: string;
  assetDescription: string;
  listingTitle: string;
  listingUrl: string;
  marketplace: string;
  seller: string | null;
  usptoRegistered: boolean;
  confidencePct: number;
};

// DMCA-style notice to the marketplace. The complaining-party block is left blank
// for the sender to complete in their email client before sending.
function buildMarketplaceNotice(a: NoticeArgs) {
  const mp = marketplaceName(a.marketplace);
  const today = new Date().toISOString().slice(0, 10);
  const subject = `DMCA takedown notice — unauthorized use of ${a.tribeName} intellectual property`;
  const body = [
    `To: ${mp} legal department / copyright agent`,
    `Date: ${today}`,
    ``,
    `To whom it may concern,`,
    ``,
    `This is a formal notification under the Digital Millennium Copyright Act (17 U.S.C. § 512) of infringement occurring on ${mp}.`,
    ``,
    `1. Work being infringed:`,
    `   ${a.assetDescription}, owned by ${a.tribeName}${a.usptoRegistered ? " (USPTO-registered mark)" : ""}.`,
    ``,
    `2. Infringing listing:`,
    `   Title: ${a.listingTitle}`,
    `   URL: ${a.listingUrl}`,
    `   Seller: ${a.seller ?? "unknown"}`,
    `   Match confidence: ${a.confidencePct}%`,
    ``,
    `3. Complaining party (complete before sending):`,
    `   Name:`,
    `   Title:`,
    `   Organization:`,
    `   Address:`,
    `   Email:`,
    `   Phone:`,
    ``,
    `I have a good-faith belief that the use described above is not authorized by the rights holder, its agent, or the law, and the information in this notice is accurate.`,
    ``,
    `Please remove or disable access to the listed material promptly.`,
  ].join("\r\n");
  return { subject, body, recipient: a.marketplace === "amazon" ? "notice@amazon.com" : "" };
}

// NOTE: the "Notify the attorney general" action was removed deliberately.
// Tribal seals and trademarks are a federal matter enforced by the Tribal
// Nation's own AG — state AGs have no jurisdiction here — and open users must
// not be able to email an AG's office from this tool. A future version may add
// tiered accounts so Tribal Nation AG staff can monitor directly.

function openMailto(recipient: string, subject: string, body: string) {
  const href = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.location.href = href;
}

export default function ListingDetail({ match, tribe }: Props) {
  const [feedback, setFeedback] = useState<string | null>(null);

  if (!match) {
    return (
      <div className={styles.card}>
        <div className={styles.empty}>Select a listing to see details.</div>
      </div>
    );
  }

  const listing = match.listings;
  const asset = match.reference_assets;
  const pct = Math.round(match.confidence * 100);
  const tribeName = tribe?.name ?? "the tribe";
  const mpName = marketplaceName(listing.marketplace);

  const noticeArgs: NoticeArgs = {
    tribeName,
    assetDescription: asset.description,
    listingTitle: listing.title,
    listingUrl: listing.listing_url,
    marketplace: listing.marketplace,
    seller: listing.seller,
    usptoRegistered: tribe?.has_registered_mark ?? false,
    confidencePct: pct,
  };

  function handleReportMarketplace() {
    const n = buildMarketplaceNotice(noticeArgs);
    openMailto(n.recipient, n.subject, n.body);
    setFeedback(
      n.recipient
        ? `Opened your email client with a draft to ${n.recipient}.`
        : `Opened your email client — add the ${mpName} recipient before sending.`,
    );
  }

  return (
    <div className={`${styles.card} ${styles.detail}`}>
      <span className={styles.eyebrow} style={{ display: "block", marginBottom: 14 }}>
        Compare to the registered seal
      </span>

      {/* Comparison */}
      <div className={styles.compare}>
        <div>
          <div className={styles.sealFrame}>
            {asset.image_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={asset.image_url} alt={asset.description} />
            ) : (
              <svg aria-hidden="true">
                <use href="#seal-line" />
              </svg>
            )}
          </div>
          <div className={styles.cap}>Registered seal</div>
        </div>
        <div>
          <div className={`${styles.sealFrame} ${styles.sealFrameFlag}`}>
            {listing.image_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={listing.image_url} alt={listing.title} />
            ) : (
              <svg aria-hidden="true">
                <use href="#seal-line" />
              </svg>
            )}
          </div>
          <div className={`${styles.cap} ${styles.capFlag}`}>Flagged listing</div>
        </div>
      </div>

      {/* Confidence focal */}
      <div className={styles.confidence}>
        <div className={styles.confTop}>
          <div>
            <div className={styles.lbl}>Match confidence</div>
          </div>
          <div className={styles.pct}>{pct}%</div>
        </div>
        <div className={styles.bar}>
          <i style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Record */}
      <div className={styles.fields}>
        <div className={styles.frow}>
          <span className={styles.k}>Marketplace</span>
          <span className={styles.v}>{marketplaceLabel(listing.marketplace)}</span>
        </div>
        <div className={styles.frow}>
          <span className={styles.k}>Asset matched</span>
          <span className={styles.v}>{asset.description}</span>
        </div>
        <div className={styles.frow}>
          <span className={styles.k}>Seller</span>
          <span className={`${styles.v} ${styles.mono}`}>{listing.seller ?? "—"}</span>
        </div>
        <div className={styles.frow}>
          <span className={styles.k}>Price</span>
          <span className={`${styles.v} ${styles.mono}`}>{listing.price ?? "—"}</span>
        </div>
        <div className={styles.frow}>
          <span className={styles.k}>Listing</span>
          <span className={styles.v}>
            <a href={listing.listing_url} target="_blank" rel="noopener noreferrer">
              View on {mpName} ↗
            </a>
          </span>
        </div>
      </div>

      {/* Take action */}
      <div className={styles.actions}>
        <span className={styles.eyebrow}>Take action</span>

        <button type="button" className={`${styles.act} ${styles.actReport}`} onClick={handleReportMarketplace}>
          <span className={styles.ico}>⚑</span>
          <span>
            <span className={styles.at}>Report to {mpName}</span>
            <span className={styles.as}>Drafts a DMCA takedown email to the marketplace</span>
          </span>
          <span className={styles.ext}>↗</span>
        </button>

        {feedback && <div className={styles.feedback}>{feedback}</div>}

        <p className={styles.note}>
          The button opens your email client with a pre-filled notice. Nothing is sent until you
          review and send it yourself. These are automated, unconfirmed matches, and whoever sends a
          notice is responsible for its accuracy.
        </p>
      </div>
    </div>
  );
}
