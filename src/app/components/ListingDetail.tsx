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

// DMCA-style notice to the marketplace. The complaining-party block is left
// blank for the sender to complete in their email client before sending.
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

/** Empty values read as "Not listed", never an em dash. */
function Value({ children }: { children: string | null | undefined }) {
  if (!children) return <span className={styles.fieldEmpty}>Not listed</span>;
  return <span className={styles.fieldValue}>{children}</span>;
}

export default function ListingDetail({ match, tribe }: Props) {
  const [feedback, setFeedback] = useState<string | null>(null);

  if (!match) {
    return (
      <div className={styles.panel}>
        <div className={styles.emptyDetail}>
          Nothing to review for this nation right now.
        </div>
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

  function handleReport() {
    const n = buildMarketplaceNotice(noticeArgs);
    openMailto(n.recipient, n.subject, n.body);
    setFeedback(
      n.recipient
        ? `Opened your email client with a draft to ${n.recipient}.`
        : `Opened your email client — add the ${mpName} recipient before sending.`,
    );
  }

  return (
    <div className={`${styles.panel} ${styles.detail}`}>
      <span className={styles.detailLabel}>Compare to the registered seal</span>

      <div>
        <div className={styles.compare}>
          <div>
            <div className={styles.frame}>
              {asset.image_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={asset.image_url} alt={asset.description} />
              ) : (
                <span className={styles.frameEmpty}>No reference image</span>
              )}
            </div>
            <div className={styles.caption}>Registered seal</div>
          </div>
          <div>
            <div className={`${styles.frame} ${styles.frameFlagged}`}>
              {listing.image_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={listing.image_url} alt={listing.title} />
              ) : (
                <span className={styles.frameEmpty}>No listing photo</span>
              )}
            </div>
            <div className={`${styles.caption} ${styles.captionFlagged}`}>Flagged listing</div>
          </div>
        </div>
      </div>

      <div className={styles.confidence}>
        <div>
          <div className={styles.confLabel}>Match confidence</div>
          <div className={styles.confTrack}>
            <div className={styles.confFill} style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className={styles.confPct}>{pct}%</div>
      </div>

      <div className={styles.fields}>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>Marketplace</span>
          <Value>{marketplaceLabel(listing.marketplace)}</Value>
        </div>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>Asset matched</span>
          <Value>{asset.description}</Value>
        </div>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>Price</span>
          <Value>{listing.price}</Value>
        </div>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>Seller</span>
          <Value>{listing.seller}</Value>
        </div>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>Listing</span>
          <span className={styles.fieldValue}>
            <a
              className={styles.fieldLink}
              href={listing.listing_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              View on {mpName}
            </a>
          </span>
        </div>
      </div>

      <button type="button" className={styles.report} onClick={handleReport}>
        <span>
          <span className={styles.reportTitle}>Report to {mpName}</span>
          <span className={styles.reportSub}>Drafts a DMCA takedown email to the marketplace</span>
        </span>
        <span className={styles.reportArrow}>↗</span>
      </button>

      {feedback && <div className={styles.feedback}>{feedback}</div>}

      <p className={styles.disclaimer}>
        The button opens your email client with a pre-filled notice. Nothing is sent until you
        review and send it yourself. These are automated, unconfirmed matches, and whoever sends a
        notice is responsible for its accuracy.
      </p>
    </div>
  );
}
