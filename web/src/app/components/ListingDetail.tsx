"use client";

import { useState } from "react";
import type { MatchRow, Tribe } from "@/lib/types";
import { getTribalLegalContact } from "@/lib/tribalLegal";

type Props = { match: MatchRow | null; tribe: Tribe | null };

type DraftPreview = {
  title: string;
  recipientLabel: string;
  email: string | null;
  phone: string | null;
  contactUrl: string | null;
  contactNote: string | null;
  subject: string;
  body: string;
};

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

const REPORTER_STORAGE_KEY = "indigenous-scraper:reporter";

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
  if (mp === "alibaba") return "Alibaba";
  return mp;
}

function bandColor(band: string) {
  if (band === "high") return "text-rose-300";
  if (band === "medium") return "text-amber-300";
  return "text-zinc-400";
}

// Open Gmail's web compose window pre-filled — no native mail client involved.
function openInGmail(draft: DraftPreview) {
  const params = new URLSearchParams({ view: "cm", fs: "1" });
  if (draft.email) params.set("to", draft.email);
  if (draft.subject) params.set("su", draft.subject);
  if (draft.body) params.set("body", draft.body);
  window.open(
    `https://mail.google.com/mail/?${params.toString()}`,
    "_blank",
    "noopener,noreferrer",
  );
}

export default function ListingDetail({ match, tribe }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftPreview | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [reporterModalOpen, setReporterModalOpen] = useState(false);
  const [reporter, setReporter] = useState<Reporter>(EMPTY_REPORTER);
  const agContact = tribe ? getTribalLegalContact(tribe) : null;

  if (!match) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-8 text-center text-sm text-zinc-500">
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

  // Generate a draft and show it in an in-app preview with copy buttons.
  // No mail client involved — the user copies and sends however they like.
  async function generateDraft(
    draftType: "ag_notification" | "marketplace_takedown",
  ) {
    if (!match) return;
    const key = `/api/draft:${draftType}`;
    setBusy(key);
    setFeedback(null);
    try {
      const resp = await fetch("/api/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ match_id: match.id, draft_type: draftType }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      const data = (await resp.json()) as {
        draft?: { body?: string };
        ag_contact?: {
          email: string | null;
          office: string;
          contactUrl: string;
          phone?: string | null;
          note?: string;
        } | null;
        subject?: string;
      };
      const bodyText = data.draft?.body ?? "";
      const subject = data.subject ?? "";

      if (draftType === "ag_notification") {
        const c = data.ag_contact ?? null;
        setDraft({
          title: "Tribal legal-office notification",
          recipientLabel: c?.office ?? "Tribe's legal office",
          email: c?.email ?? null,
          phone: c?.phone ?? null,
          contactUrl: c?.contactUrl ?? null,
          contactNote: c?.note ?? null,
          subject,
          body: bodyText,
        });
      } else {
        setDraft({
          title: "Marketplace takedown notice",
          recipientLabel: `${marketplaceLabel(listing.marketplace)} — Brand Protection / IP team`,
          email: null,
          phone: null,
          contactUrl: listing.listing_url,
          contactNote: null,
          subject,
          body: bodyText,
        });
      }
    } catch (e) {
      setFeedback(`Failed: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    } catch {
      setCopied(null);
    }
  }

  // Friend's feature: file a DMCA / IPP report to the marketplace itself.
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
          `Notice copied to clipboard. Alibaba's IPP portal opened in a new tab — paste into the complaint form.`,
        );
      }
    } catch (e) {
      setFeedback(`Failed: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h2 className="text-sm font-medium">Listing detail</h2>
      </div>

      <div className="p-4">
        <div className="aspect-[16/9] w-full overflow-hidden rounded-md border border-zinc-700 bg-zinc-800">
          {listing.image_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={listing.image_url}
              alt={listing.title}
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-zinc-600">
              no image
            </div>
          )}
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-zinc-400">Marketplace</dt>
          <dd className="text-right">{marketplaceLabel(listing.marketplace)}</dd>

          <dt className="text-zinc-400">Asset matched</dt>
          <dd className="text-right">{asset.description}</dd>

          <dt className="text-zinc-400">Match confidence</dt>
          <dd className={`text-right font-medium ${bandColor(match.confidence_band)}`}>
            {pct}% · {match.confidence_band}
          </dd>

          <dt className="text-zinc-400">Seller</dt>
          <dd className="truncate text-right">{listing.seller ?? "—"}</dd>

          <dt className="text-zinc-400">Price</dt>
          <dd className="text-right">{listing.price ?? "—"}</dd>

          <dt className="text-zinc-400">Listing URL</dt>
          <dd className="truncate text-right">
            <a
              href={listing.listing_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sky-400 hover:underline"
            >
              {listing.listing_url.replace(/^https?:\/\//, "").slice(0, 36)}…
            </a>
          </dd>
        </dl>

        {/* Generate a draft notice (in-app preview + Gmail/copy) */}
        <div className="mt-5">
          <div className="mb-2 text-xs uppercase tracking-wide text-zinc-400">
            Generate response
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              disabled={busy !== null}
              onClick={() => generateDraft("marketplace_takedown")}
              className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700 disabled:opacity-50"
            >
              {busy === "/api/draft:marketplace_takedown"
                ? "Drafting…"
                : "📄 Draft marketplace takedown"}
            </button>
            <button
              disabled={busy !== null}
              onClick={() => generateDraft("ag_notification")}
              className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700 disabled:opacity-50"
            >
              {busy === "/api/draft:ag_notification"
                ? "Drafting…"
                : "✉ Draft tribal legal notice"}
            </button>
          </div>
          {agContact && (
            <p className="mt-2 text-xs text-zinc-500">
              Recipient: {agContact.office}
              {agContact.email
                ? ` · ${agContact.email}`
                : agContact.phone
                  ? ` · ${agContact.phone} (no public email)`
                  : " · no public email"}
            </p>
          )}
        </div>

        {/* Report straight to the marketplace (DMCA email / IPP portal) */}
        <div className="mt-5">
          <div className="mb-2 text-xs uppercase tracking-wide text-zinc-400">
            Report to marketplace
          </div>
          <button
            disabled={busy !== null}
            onClick={() => {
              setFeedback(null);
              setReporter(loadStoredReporter());
              setReporterModalOpen(true);
            }}
            className="w-full rounded-md border border-rose-700 bg-rose-900/30 px-3 py-2 text-sm text-rose-200 hover:bg-rose-900/50 disabled:opacity-50"
          >
            {busy === "/api/report"
              ? "Preparing notice…"
              : listing.marketplace === "amazon"
                ? "🚩 Report to Amazon (DMCA email)"
                : listing.marketplace === "alibaba"
                  ? "🚩 Report to Alibaba (IPP portal)"
                  : "🚩 Report to marketplace"}
          </button>
          <p className="mt-1 text-xs text-zinc-500">
            {listing.marketplace === "amazon"
              ? "Opens your email client with a DMCA notice addressed to notice@amazon.com. Review before sending."
              : listing.marketplace === "alibaba"
                ? "Copies the complaint to your clipboard and opens the Alibaba IPP portal in a new tab."
                : "Prepares a complaint for this marketplace."}
          </p>
        </div>

        <div className="mt-3">
          <button
            disabled={busy !== null}
            onClick={() =>
              action(
                "/api/match-action",
                { match_id: match.id, status: "dismissed" },
                "Dismissed",
              )
            }
            className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700 disabled:opacity-50"
          >
            ✕ Dismiss
          </button>
        </div>

        {feedback && (
          <div className="mt-3 rounded-md bg-zinc-800 px-3 py-2 text-sm text-zinc-300">
            {feedback}
          </div>
        )}

        <p className="mt-4 text-xs text-zinc-500">
          Drafts and notices are prepared for your review — nothing is sent until you
          confirm in your email client or the marketplace portal.
        </p>
      </div>

      {draft && (
        <DraftModal
          draft={draft}
          copied={copied}
          onCopy={copy}
          onClose={() => setDraft(null)}
        />
      )}

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

function DraftModal({
  draft,
  copied,
  onCopy,
  onClose,
}: {
  draft: DraftPreview;
  copied: string | null;
  onCopy: (text: string, key: string) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-2xl flex-col rounded-lg border border-zinc-700 bg-zinc-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-zinc-800 px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">{draft.title}</h3>
            <p className="mt-1 text-xs text-zinc-400">
              To: <span className="text-zinc-300">{draft.recipientLabel}</span>
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              {draft.email ? (
                <span className="text-emerald-300">{draft.email}</span>
              ) : (
                <span className="text-amber-300">no public email</span>
              )}
              {draft.phone && <span className="text-zinc-400">{draft.phone}</span>}
              {draft.contactUrl && (
                <a
                  href={draft.contactUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-400 hover:underline"
                >
                  contact page ↗
                </a>
              )}
            </div>
            {draft.contactNote && (
              <p className="mt-1 text-xs text-zinc-500">{draft.contactNote}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800"
          >
            ✕ Close
          </button>
        </div>

        {/* Subject */}
        <div className="border-b border-zinc-800 px-5 py-3">
          <div className="text-[11px] uppercase tracking-wide text-zinc-500">Subject</div>
          <div className="mt-0.5 text-sm text-zinc-200">{draft.subject || "—"}</div>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <textarea
            readOnly
            value={draft.body}
            className="h-72 w-full resize-none rounded-md border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs leading-relaxed text-zinc-200 focus:border-zinc-600 focus:outline-none"
          />
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 border-t border-zinc-800 px-5 py-4">
          <button
            onClick={() => openInGmail(draft)}
            className="rounded-md border border-rose-700 bg-rose-900/30 px-3 py-2 text-sm font-medium text-rose-200 hover:bg-rose-900/50"
          >
            ✉ Open in Gmail
          </button>
          <button
            onClick={() => onCopy(draft.body, "body")}
            className="rounded-md border border-sky-700 bg-sky-900/30 px-3 py-2 text-sm text-sky-200 hover:bg-sky-900/50"
          >
            {copied === "body" ? "✓ Copied" : "📋 Copy letter"}
          </button>
          {draft.email && (
            <button
              onClick={() => onCopy(draft.email!, "email")}
              className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700"
            >
              {copied === "email" ? "✓ Copied" : "📋 Copy address"}
            </button>
          )}
          <button
            onClick={() => onCopy(draft.subject, "subject")}
            className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700"
          >
            {copied === "subject" ? "✓ Copied" : "📋 Copy subject"}
          </button>
          <span className="ml-auto text-xs text-zinc-500">
            Saved to drafts · review before sending
          </span>
        </div>
      </div>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-lg border border-zinc-700 bg-zinc-900 p-5 shadow-xl"
      >
        <h3 className="text-sm font-medium">Claimant info</h3>
        <p className="mt-1 text-xs text-zinc-500">
          This is signed under penalty of perjury and pasted into the notice. Saved in
          your browser so you only enter it once.
        </p>

        <div className="mt-4 space-y-3">
          <Field label="Full name *" value={draft.name} onChange={(v) => update("name", v)} />
          <Field label="Title" value={draft.title} onChange={(v) => update("title", v)} />
          <Field
            label="Organization"
            value={draft.organization}
            onChange={(v) => update("organization", v)}
          />
          <Field
            label="Mailing address *"
            value={draft.address}
            onChange={(v) => update("address", v)}
          />
          <Field
            label="Email *"
            value={draft.email}
            type="email"
            onChange={(v) => update("email", v)}
          />
          <Field
            label="Phone"
            value={draft.phone}
            type="tel"
            onChange={(v) => update("phone", v)}
          />
        </div>

        {error && (
          <div className="mt-3 rounded-md border border-rose-800 bg-rose-900/30 px-3 py-2 text-xs text-rose-200">
            {error}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-md border border-rose-700 bg-rose-900/40 px-3 py-2 text-sm text-rose-200 hover:bg-rose-900/60"
          >
            Save & continue
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
      <span className="block text-xs text-zinc-400">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-100 focus:border-zinc-500 focus:outline-none"
      />
    </label>
  );
}
