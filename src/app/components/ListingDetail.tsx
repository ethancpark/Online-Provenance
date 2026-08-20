"use client";

import { useState } from "react";
import type { MatchRow, Tribe } from "@/lib/types";
import type { SessionUser } from "./AccountNav";
import type { ReportAccess } from "@/lib/access";
import ReportLock from "./ReportLock";
import { buildNotice, noticeSubject, marketplaceName, submissionRoute, type NoticeInput } from "@/lib/notice";
import styles from "./Dashboard.module.css";

type Props = {
  match: MatchRow | null;
  tribe: Tribe | null;
  sessionUser?: SessionUser;
  /** Decided in lib/access.ts — a denied result renders the lock instead. */
  access: ReportAccess;
};

function marketplaceLabel(mp: string) {
  if (mp === "amazon") return "Amazon US";
  if (mp === "temu") return "Temu";
  return mp;
}

/** Empty values read as "Not listed", never an em dash. */
function Value({ children }: { children: string | null | undefined }) {
  if (!children) return <span className={styles.fieldEmpty}>Not listed</span>;
  return <span className={styles.fieldValue}>{children}</span>;
}

export default function ListingDetail({ match, tribe, sessionUser, access }: Props) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showNotice, setShowNotice] = useState(false);

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

  // The claimant block comes from the signed-in profile, so the notice is
  // complete rather than leaving blanks for someone to fill in by hand.
  const noticeInput: NoticeInput = {
    claimant: {
      full_name: sessionUser?.full_name ?? sessionUser?.email?.split("@")[0] ?? "",
      job_title: null,
      email: sessionUser?.email ?? "",
      nation: sessionUser?.nation ?? tribeName,
    },
    nation: tribeName,
    usptoRegistered: tribe?.has_registered_mark ?? false,
    usptoUrl: tribe?.uspto_search_url ?? null,
    assetDescription: asset.description,
    listingTitle: listing.title,
    listingUrl: listing.listing_url,
    marketplaceId: listing.marketplace_id,
    marketplace: listing.marketplace,
    seller: listing.seller,
    confidencePct: pct,
  };

  const route = submissionRoute(noticeInput);
  // No notice is built for someone who may not file one.
  const noticeText = access.allowed ? buildNotice(noticeInput) : "";

  async function copyNotice() {
    try {
      await navigator.clipboard.writeText(`${noticeSubject(noticeInput)}\n\n${noticeText}`);
      setFeedback("Notice copied. Paste it into the form on the next screen.");
    } catch {
      setFeedback("Couldn't copy automatically — select the text above and copy it.");
    }
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

      {!access.allowed ? (
        <ReportLock
          access={access}
          nation={tribeName}
          marketplaces={[listing.marketplace]}
          count={1}
          variant="inline"
        />
      ) : !showNotice ? (
        <button type="button" className={styles.report} onClick={() => setShowNotice(true)}>
          <span>
            <span className={styles.reportTitle}>Prepare notice for {mpName}</span>
            <span className={styles.reportSub}>
              {route.note}
            </span>
          </span>
          <span className={styles.reportArrow}>→</span>
        </button>
      ) : (
        <div className={styles.noticeBox}>
          <div className={styles.noticeHead}>
            <span className={styles.detailLabel}>Review this notice before filing</span>
            <button type="button" className={styles.noticeClose} onClick={() => setShowNotice(false)}>
              Close
            </button>
          </div>
          {access.asLabAdmin && (
            <p className={styles.labNote}>
              You&rsquo;re viewing this as 𐒻𐒼𐓂 Lab staff, not as {tribeName}. A notice for this
              nation has to be filed and signed by someone at the nation itself.
            </p>
          )}
          <div className={styles.noticeSubject}>{noticeSubject(noticeInput)}</div>
          <pre className={styles.noticeBody}>{noticeText}</pre>
          <div className={styles.noticeActions}>
            <button type="button" className={styles.noticeCopy} onClick={copyNotice}>
              Copy notice
            </button>
            <a
              className={styles.noticeFile}
              href={route.primary}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open {route.primaryLabel} ↗
            </a>
          </div>
          {route.requirement && <p className={styles.noticeReq}>{route.requirement}</p>}
          {route.alternative && (
            <p className={styles.noticeAlt}>
              {route.alternative.note}{" "}
              <a href={route.alternative.url} target="_blank" rel="noopener noreferrer">
                {route.alternative.label} ↗
              </a>
            </p>
          )}
        </div>
      )}

      {feedback && <div className={styles.feedback}>{feedback}</div>}

      <p className={styles.disclaimer}>
        Nothing is sent from this site. You review the notice, then file it yourself — these are
        automated, unconfirmed matches, and whoever files a notice is responsible for its accuracy
        and signs it under penalty of perjury.
      </p>
    </div>
  );
}
