"use client";

import { useState } from "react";
import { FileText, Landmark, Flag, Check, X, ExternalLink } from "lucide-react";
import type { MatchRow } from "@/lib/types";

type Props = { match: MatchRow | null };

type Reporter = {
  name: string;
  title: string;
  organization: string;
  address: string;
  email: string;
  phone: string;
};

const EMPTY_REPORTER: Reporter = {
  name: "",
  title: "",
  organization: "",
  address: "",
  email: "",
  phone: "",
};

const REPORTER_STORAGE_KEY = "online-provenance:reporter";

function loadStoredReporter(): Reporter {
  if (typeof window === "undefined") return EMPTY_REPORTER;
  try {
    const raw = window.localStorage.getItem(REPORTER_STORAGE_KEY);
    if (!raw) return EMPTY_REPORTER;
    const parsed = JSON.parse(raw) as Partial<Reporter>;
    return { ...EMPTY_REPORTER, ...parsed };
  } catch {
    return EMPTY_REPORTER;
  }
}

function marketplaceLabel(mp: string) {
  if (mp === "amazon") return "Amazon US";
  if (mp === "temu") return "Temu";
  return mp;
}

function bandTextColor(band: string) {
  if (band === "high") return "var(--signal-high-tint-text)";
  if (band === "medium") return "var(--signal-med-tint-text)";
  return "var(--color-text-muted)";
}

// Shared button styles (design.md §7)
const secondaryBtn: React.CSSProperties = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  color: "var(--color-ink)",
};
const eyebrow: React.CSSProperties = {
  color: "var(--color-text-muted)",
  letterSpacing: "0.04em",
  fontWeight: 500,
};

export default function ListingDetail({ match }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [reporterModalOpen, setReporterModalOpen] = useState(false);
  const [reporter, setReporter] = useState<Reporter>(EMPTY_REPORTER);

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

  async function action(path: string, body: object, successMsg: string) {
    setBusy(path);
    setFeedback(null);
    try {
      const resp = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!resp.ok) throw new Error(await resp.text());
      setFeedback(successMsg);
      setTimeout(() => window.location.reload(), 600);
    } catch (e) {
      setFeedback(`Failed: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  async function reportToMarketplace(reporterToSend: Reporter) {
    setBusy("/api/report");
    setFeedback(null);
    try {
      const resp = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ match_id: match!.id, reporter: reporterToSend }),
      });
      const json = (await resp.json()) as
        | {
            ok: true;
            dispatch:
              | { method: "mailto"; recipient: string; subject: string; body: string }
              | { method: "portal"; portal_url: string; subject: string; body: string };
          }
        | { error: string };
      if (!resp.ok || "error" in json) {
        throw new Error("error" in json ? json.error : "unknown error");
      }
      const d = json.dispatch;
      if (d.method === "mailto") {
        const href = `mailto:${encodeURIComponent(d.recipient)}?subject=${encodeURIComponent(
          d.subject,
        )}&body=${encodeURIComponent(d.body)}`;
        window.location.href = href;
        setFeedback(
          `Opened your email client with a pre-filled DMCA notice to ${d.recipient}. Review before sending.`,
        );
      } else {
        try {
          await navigator.clipboard.writeText(d.body);
        } catch {
          /* clipboard may be unavailable; user can still paste from the portal page */
        }
        window.open(d.portal_url, "_blank", "noopener,noreferrer");
        setFeedback(
          `Notice copied to clipboard. Temu's IP portal opened in a new tab — paste into the complaint form.`,
        );
      }
    } catch (e) {
      setFeedback(`Failed: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      className="rounded-xl"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <div className="px-5 py-3" style={{ borderBottom: "1px solid var(--color-border)" }}>
        <h2 className="text-sm" style={{ fontFamily: "var(--font-display)", fontWeight: 500 }}>
          Listing detail
        </h2>
      </div>

      <div className="p-5">
        <div
          className="aspect-[16/9] w-full overflow-hidden rounded-md"
          style={{ border: "1px solid var(--color-border)", background: "var(--color-parchment)" }}
        >
          {listing.image_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={listing.image_url} alt={listing.title} className="h-full w-full object-contain" />
          ) : (
            <div className="flex h-full items-center justify-center text-sm" style={{ color: "var(--color-text-muted)" }}>
              no image
            </div>
          )}
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-y-2 text-sm">
          <dt style={{ color: "var(--color-text-muted)" }}>Marketplace</dt>
          <dd className="text-right">{marketplaceLabel(listing.marketplace)}</dd>

          <dt style={{ color: "var(--color-text-muted)" }}>Asset matched</dt>
          <dd className="text-right">{asset.description}</dd>

          <dt style={{ color: "var(--color-text-muted)" }}>Match confidence</dt>
          <dd className="op-data text-right" style={{ color: bandTextColor(match.confidence_band), fontWeight: 500 }}>
            {pct}% · {match.confidence_band}
          </dd>

          <dt style={{ color: "var(--color-text-muted)" }}>Seller</dt>
          <dd className="truncate text-right">{listing.seller ?? "—"}</dd>

          <dt style={{ color: "var(--color-text-muted)" }}>Price</dt>
          <dd className="op-data text-right">{listing.price ?? "—"}</dd>

          <dt style={{ color: "var(--color-text-muted)" }}>Listing</dt>
          <dd className="truncate text-right">
            <a
              href={listing.listing_url}
              target="_blank"
              rel="noopener noreferrer"
              className="op-data inline-flex items-center gap-1 hover:underline"
              style={{ color: "var(--color-navy)" }}
            >
              {listing.listing_url.replace(/^https?:\/\//, "").slice(0, 30)}…
              <ExternalLink className="h-3 w-3" />
            </a>
          </dd>
        </dl>

        {/* Generate response — secondary actions */}
        <div className="mt-6">
          <div className="mb-2 text-xs" style={eyebrow}>
            Generate response
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              disabled={busy !== null}
              onClick={() =>
                action(
                  "/api/draft",
                  { match_id: match.id, draft_type: "marketplace_takedown" },
                  "Marketplace takedown drafted",
                )
              }
              className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-[var(--color-parchment)] disabled:opacity-50"
              style={secondaryBtn}
            >
              <FileText className="h-4 w-4" />
              {busy === "/api/draft" ? "Drafting…" : "Draft marketplace takedown"}
            </button>
            <button
              disabled={busy !== null}
              onClick={() =>
                action(
                  "/api/draft",
                  { match_id: match.id, draft_type: "ag_notification" },
                  "AG notification drafted",
                )
              }
              className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-[var(--color-parchment)] disabled:opacity-50"
              style={secondaryBtn}
            >
              <Landmark className="h-4 w-4" />
              Draft AG notification
            </button>
          </div>
        </div>

        {/* Report — primary enforcement action (vermillion) */}
        <div className="mt-5">
          <div className="mb-2 text-xs" style={eyebrow}>
            Report to marketplace
          </div>
          <button
            disabled={busy !== null}
            onClick={() => {
              setFeedback(null);
              setReporter(loadStoredReporter());
              setReporterModalOpen(true);
            }}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: "var(--signal-high-solid-bg)", color: "var(--signal-high-solid-text)" }}
          >
            <Flag className="h-4 w-4" />
            {busy === "/api/report"
              ? "Preparing notice…"
              : listing.marketplace === "amazon"
                ? "Report to Amazon (DMCA email)"
                : listing.marketplace === "temu"
                  ? "Report to Temu (IP portal)"
                  : "Report to marketplace"}
          </button>
          <p className="mt-1.5 text-xs" style={{ color: "var(--color-text-muted)" }}>
            {listing.marketplace === "amazon"
              ? "Opens your email client with a DMCA notice addressed to notice@amazon.com. Review before sending."
              : listing.marketplace === "temu"
                ? "Copies the complaint to your clipboard and opens the Temu IP portal in a new tab."
                : "Prepares a complaint for this marketplace."}
          </p>
        </div>

        {/* Review decision */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            disabled={busy !== null}
            onClick={() =>
              action("/api/match-action", { match_id: match.id, status: "confirmed" }, "Marked as infringing")
            }
            className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: "var(--signal-high-tint-bg)", color: "var(--signal-high-tint-text)", border: "1px solid var(--signal-high-tint-bg)" }}
          >
            <Check className="h-4 w-4" />
            Confirm infringing
          </button>
          <button
            disabled={busy !== null}
            onClick={() =>
              action("/api/match-action", { match_id: match.id, status: "dismissed" }, "Dismissed")
            }
            className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-[var(--color-parchment)] disabled:opacity-50"
            style={secondaryBtn}
          >
            <X className="h-4 w-4" />
            Dismiss
          </button>
        </div>

        {feedback && (
          <div
            className="mt-3 rounded-md px-3 py-2 text-sm"
            style={{ background: "var(--color-parchment)", color: "var(--color-text-secondary)", border: "1px solid var(--color-border)" }}
          >
            {feedback}
          </div>
        )}

        <p className="mt-4 text-xs" style={{ color: "var(--color-text-muted)" }}>
          The report button pre-fills the notice — nothing is sent until you confirm in your email
          client or the IP portal.
        </p>
      </div>

      {reporterModalOpen && (
        <ReporterModal
          initial={reporter}
          onCancel={() => setReporterModalOpen(false)}
          onSubmit={(r) => {
            try {
              window.localStorage.setItem(REPORTER_STORAGE_KEY, JSON.stringify(r));
            } catch {
              /* localStorage may be blocked; proceed anyway */
            }
            setReporter(r);
            setReporterModalOpen(false);
            reportToMarketplace(r);
          }}
        />
      )}
    </div>
  );
}

type ReporterModalProps = {
  initial: Reporter;
  onCancel: () => void;
  onSubmit: (r: Reporter) => void;
};

function ReporterModal({ initial, onCancel, onSubmit }: ReporterModalProps) {
  const [draft, setDraft] = useState<Reporter>(initial);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof Reporter>(key: K, value: string) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    const trimmed: Reporter = {
      name: draft.name.trim(),
      title: draft.title.trim(),
      organization: draft.organization.trim(),
      address: draft.address.trim(),
      email: draft.email.trim(),
      phone: draft.phone.trim(),
    };
    const missing = (["name", "address", "email"] as const).filter((k) => !trimmed[k]);
    if (missing.length > 0) {
      setError(`Required: ${missing.join(", ")}`);
      return;
    }
    onSubmit(trimmed);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(21, 23, 28, 0.55)" }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-xl p-6"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <h3 className="text-lg" style={{ fontFamily: "var(--font-display)", fontWeight: 500, color: "var(--color-navy)" }}>
          Claimant info
        </h3>
        <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
          This is signed under penalty of perjury and pasted into the notice. Saved in your browser
          so you only enter it once.
        </p>

        <div className="mt-4 space-y-3">
          <Field label="Full name *" value={draft.name} onChange={(v) => update("name", v)} />
          <Field label="Title" value={draft.title} onChange={(v) => update("title", v)} />
          <Field label="Organization" value={draft.organization} onChange={(v) => update("organization", v)} />
          <Field label="Mailing address *" value={draft.address} onChange={(v) => update("address", v)} />
          <Field label="Email *" value={draft.email} type="email" onChange={(v) => update("email", v)} />
          <Field label="Phone" value={draft.phone} type="tel" onChange={(v) => update("phone", v)} />
        </div>

        {error && (
          <div
            className="mt-3 rounded-md px-3 py-2 text-xs"
            style={{ background: "var(--signal-high-tint-bg)", color: "var(--signal-high-tint-text)" }}
          >
            {error}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-3 py-2 text-sm transition-colors hover:bg-[var(--color-parchment)]"
            style={secondaryBtn}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-lg px-3 py-2 text-sm font-medium transition-opacity hover:opacity-90"
            style={{ background: "var(--color-navy)", color: "var(--color-on-navy-strong)" }}
          >
            Save &amp; continue
          </button>
        </div>
      </form>
    </div>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
};

function Field({ label, value, onChange, type = "text" }: FieldProps) {
  return (
    <label className="block">
      <span className="block text-xs" style={{ color: "var(--color-text-muted)" }}>
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg px-2.5 py-1.5 text-sm focus:outline-none"
        style={{ background: "var(--color-parchment)", border: "1px solid var(--color-border)", color: "var(--color-ink)" }}
      />
    </label>
  );
}
