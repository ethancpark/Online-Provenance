"use client";

import { useState } from "react";
import type { MatchRow } from "@/lib/types";

type Props = { match: MatchRow | null };

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

export default function ListingDetail({ match }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

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
      // Refresh data
      setTimeout(() => window.location.reload(), 600);
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

        <div className="mt-5">
          <div className="mb-2 text-xs uppercase tracking-wide text-zinc-400">
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
              className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700 disabled:opacity-50"
            >
              {busy === "/api/draft" ? "Drafting…" : "📄 Draft marketplace takedown"}
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
              className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700 disabled:opacity-50"
            >
              📁 Draft AG notification
            </button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            disabled={busy !== null}
            onClick={() =>
              action(
                "/api/match-action",
                { match_id: match.id, status: "confirmed" },
                "Marked as infringing",
              )
            }
            className="rounded-md border border-emerald-700 bg-emerald-900/30 px-3 py-2 text-sm text-emerald-300 hover:bg-emerald-900/50 disabled:opacity-50"
          >
            ✓ Confirm infringing
          </button>
          <button
            disabled={busy !== null}
            onClick={() =>
              action(
                "/api/match-action",
                { match_id: match.id, status: "dismissed" },
                "Dismissed",
              )
            }
            className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700 disabled:opacity-50"
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
          Drafts are queued for human review before any notice is sent. Nothing files
          automatically.
        </p>
      </div>
    </div>
  );
}
