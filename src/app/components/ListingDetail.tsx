"use client";

import { useState } from "react";
import { Award, ExternalLink, Flag, Image as ImageIcon, Landmark, Zap } from "lucide-react";
import type { MatchRow, Tribe } from "@/lib/types";
import { getTribalLegalContact } from "@/lib/tribalLegal";

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

// Confidence badge — reuse the signal palette (design.md §4): high → vermillion,
// medium → amber, low → neutral.
function bandBadgeStyle(band: string): React.CSSProperties {
  if (band === "high") return { background: "var(--signal-high-tint-bg)", color: "var(--signal-high-tint-text)" };
  if (band === "medium") return { background: "var(--signal-med-tint-bg)", color: "var(--signal-med-tint-text)" };
  return { background: "var(--color-parchment)", color: "var(--color-text-muted)" };
}

const eyebrow: React.CSSProperties = {
  color: "var(--color-text-muted)",
  letterSpacing: "0.04em",
  fontWeight: 500,
};

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

// Notice to the tribe's own attorney general / legal office so their counsel can act
// on the infringement of their mark.
function buildAgNotice(a: NoticeArgs, office: string, email: string | null, contactUrl: string) {
  const subject = `Notice of unauthorized commercial use of ${a.tribeName} intellectual property`;
  const body = [
    `To: ${office}`,
    email ? null : `Suggested recipient — confirm current contact: ${contactUrl}`,
    ``,
    `Hello,`,
    ``,
    `An automated marketplace scan flagged a product reproducing ${a.tribeName}'s ${a.assetDescription} without authorization.`,
    ``,
    `Product: ${a.listingTitle}`,
    `Marketplace: ${marketplaceName(a.marketplace)}`,
    `Seller: ${a.seller ?? "unknown"}`,
    `Listing: ${a.listingUrl}`,
    `Match confidence: ${a.confidencePct}%`,
    ``,
    `Suggested next step: a marketplace takedown or cease-and-desist${a.usptoRegistered ? ", citing the tribe's USPTO trademark registration" : ""}.`,
    ``,
    `This match was auto-flagged and should be human-verified before any action.`,
    ``,
    `— Online Provenance, automated IP monitoring`,
  ]
    .filter((line): line is string => line !== null)
    .join("\r\n");
  return { subject, body, recipient: email ?? "" };
}

function openMailto(recipient: string, subject: string, body: string) {
  const href = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.location.href = href;
}

export default function ListingDetail({ match, tribe }: Props) {
  const [feedback, setFeedback] = useState<string | null>(null);

  if (!match) {
    return (
      <div
        className="rounded-xl p-8 text-center text-sm"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}
      >
        Select a listing to see details.
      </div>
    );
  }

  const listing = match.listings;
  const asset = match.reference_assets;
  const pct = Math.round(match.confidence * 100);
  const tribeName = tribe?.name ?? "the tribe";
  const hasSeal = Boolean(asset.image_url);
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

  function handleNotifyAg() {
    const contact = tribe ? getTribalLegalContact(tribe) : null;
    const office = contact?.office ?? "Office of the attorney general";
    const n = buildAgNotice(noticeArgs, office, contact?.email ?? null, contact?.contactUrl ?? "");
    openMailto(n.recipient, n.subject, n.body);
    setFeedback(
      n.recipient
        ? `Opened your email client with a draft to ${office}.`
        : `Opened your email client — add the recipient for ${office} before sending.`,
    );
  }

  return (
    <div
      className="rounded-xl p-6"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      {/* 1. Comparison */}
      <div className="mb-3 text-xs" style={eyebrow}>
        Compare to the registered seal
      </div>
      <div className={hasSeal ? "grid grid-cols-2 gap-4" : "grid grid-cols-1"}>
        {hasSeal && (
          <Frame
            label="registered seal"
            labelColor="var(--signal-ok-tint-text)"
            imageUrl={asset.image_url}
            alt={asset.description}
            fallbackIcon={<Award className="h-10 w-10" style={{ color: "var(--color-text-muted)" }} />}
          />
        )}
        <Frame
          label="flagged listing"
          labelColor="var(--signal-high-tint-text)"
          imageUrl={listing.image_url}
          alt={listing.title}
          fallbackIcon={<ImageIcon className="h-10 w-10" style={{ color: "var(--color-text-muted)" }} />}
        />
      </div>

      {/* 2. Record */}
      <dl className="mt-6">
        <Row label="Match confidence">
          <span
            className="op-data inline-flex items-center rounded-full px-2.5 py-0.5 text-xs"
            style={{ ...bandBadgeStyle(match.confidence_band), fontWeight: 500 }}
          >
            {pct}% · {match.confidence_band}
          </span>
        </Row>
        <Row label="Marketplace">
          <span className="op-data text-sm">{marketplaceLabel(listing.marketplace)}</span>
        </Row>
        <Row label="Asset matched">
          <span className="op-data text-sm">{asset.description}</span>
        </Row>
        <Row label="Seller">
          <span className="op-data text-sm">{listing.seller ?? "—"}</span>
        </Row>
        <Row label="Price">
          <span className="op-data text-sm">{listing.price ?? "—"}</span>
        </Row>
        <Row label="Listing" last>
          <a
            href={listing.listing_url}
            target="_blank"
            rel="noopener noreferrer"
            className="op-data inline-flex items-center gap-1 text-sm hover:underline"
            style={{ color: "var(--color-navy)" }}
          >
            View on {mpName}
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </Row>
      </dl>

      {/* 3. Take action */}
      <div className="mt-6">
        <div className="mb-3 flex items-center gap-1.5 text-xs" style={eyebrow}>
          <Zap className="h-3.5 w-3.5" />
          Take action
        </div>

        <div className="flex flex-col" style={{ gap: 10 }}>
          <ActionButton
            background="var(--signal-high-solid-bg)"
            textColor="var(--signal-high-solid-text)"
            icon={<Flag className="h-5 w-5" />}
            label={`Report to ${mpName}`}
            description="Drafts a DMCA takedown email to the marketplace"
            onClick={handleReportMarketplace}
          />
          <ActionButton
            background="var(--color-navy)"
            textColor="var(--color-on-navy-strong)"
            descColor="var(--color-on-navy)"
            icon={<Landmark className="h-5 w-5" />}
            label="Notify the attorney general"
            description="Drafts a notice to the state AG's office"
            onClick={handleNotifyAg}
          />
        </div>
      </div>

      {feedback && (
        <div
          className="mt-3 rounded-md px-3 py-2 text-sm"
          style={{ background: "var(--color-parchment)", color: "var(--color-text-secondary)", border: "1px solid var(--color-border)" }}
        >
          {feedback}
        </div>
      )}

      {/* Shared disclaimer */}
      <p className="mt-4 text-xs" style={{ color: "var(--color-text-muted)", lineHeight: 1.5 }}>
        Each button opens your email client with a pre-filled notice. Nothing is sent until you
        review and send it yourself. These are automated, unconfirmed matches, and whoever sends a
        notice is responsible for its accuracy.
      </p>
    </div>
  );
}

type FrameProps = {
  label: string;
  labelColor: string;
  imageUrl: string | null;
  alt: string;
  fallbackIcon: React.ReactNode;
};

function Frame({ label, labelColor, imageUrl, alt, fallbackIcon }: FrameProps) {
  return (
    <figure>
      <div
        className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-md"
        style={{ border: "1px solid var(--color-border)", background: "var(--color-parchment)" }}
      >
        {imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={imageUrl} alt={alt} className="h-full w-full object-contain" />
        ) : (
          fallbackIcon
        )}
      </div>
      <figcaption className="op-data mt-2 text-center text-sm" style={{ color: labelColor }}>
        {label}
      </figcaption>
    </figure>
  );
}

function Row({ label, children, last }: { label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div
      className="flex items-center justify-between gap-4 py-2.5"
      style={last ? undefined : { borderBottom: "1px solid var(--color-border)" }}
    >
      <dt className="text-sm" style={{ color: "var(--color-text-muted)" }}>
        {label}
      </dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

type ActionButtonProps = {
  background: string;
  textColor: string;
  descColor?: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick: () => void;
};

function ActionButton({ background, textColor, descColor, icon, label, description, onClick }: ActionButtonProps) {
  const descStyle: React.CSSProperties = descColor
    ? { color: descColor }
    : { color: textColor, opacity: 0.82 };
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg px-4 text-left transition-opacity hover:opacity-90"
      style={{ background, color: textColor, paddingTop: 14, paddingBottom: 14, minHeight: 56 }}
    >
      <span className="flex-none">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs" style={descStyle}>
          {description}
        </span>
      </span>
      <ExternalLink className="h-4 w-4 flex-none" style={descStyle} />
    </button>
  );
}
