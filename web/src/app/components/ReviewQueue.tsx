"use client";

import type { MatchRow, ConfidenceBand } from "@/lib/types";

type Props = {
  matches: MatchRow[];
  selectedMatchId: string | null;
  onSelect: (id: string) => void;
};

function bandBadge(band: ConfidenceBand, confidence: number) {
  const pct = Math.round(confidence * 100);
  const styles: Record<ConfidenceBand, string> = {
    high: "bg-rose-900/40 text-rose-300 border-rose-800",
    medium: "bg-amber-900/40 text-amber-300 border-amber-800",
    low: "bg-zinc-800 text-zinc-400 border-zinc-700",
  };
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs ${styles[band]}`}>
      {band.charAt(0).toUpperCase() + band.slice(1)} match {pct}%
    </span>
  );
}

function marketplaceIcon(mp: string) {
  if (mp === "amazon") return "🛒";
  if (mp === "temu") return "📦";
  return "•";
}

export default function ReviewQueue({ matches, selectedMatchId, onSelect }: Props) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <h2 className="text-sm font-medium">Review queue</h2>
        <span className="text-xs text-zinc-500">Amazon, Temu</span>
      </div>

      <div className="max-h-[560px] overflow-y-auto">
        {matches.length === 0 && (
          <div className="px-4 py-12 text-center text-sm text-zinc-500">
            No flagged listings yet. Run a scan to populate the queue.
          </div>
        )}

        {matches.map((m) => {
          const isSelected = m.id === selectedMatchId;
          const listing = m.listings;
          return (
            <button
              key={m.id}
              onClick={() => onSelect(m.id)}
              className={`block w-full border-b border-zinc-800 px-4 py-3 text-left transition ${
                isSelected
                  ? "bg-sky-950/50 ring-1 ring-inset ring-sky-700"
                  : "hover:bg-zinc-800/40"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 flex-none items-center justify-center overflow-hidden rounded-md border border-zinc-700 bg-zinc-800">
                  {listing.image_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={listing.image_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-zinc-600">img</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    “{listing.title}”
                  </div>
                  <div className="mt-0.5 truncate text-xs text-zinc-400">
                    {marketplaceIcon(listing.marketplace)} {listing.marketplace}
                    {listing.seller ? ` · seller ${listing.seller}` : ""}
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    {bandBadge(m.confidence_band, m.confidence)}
                    {isSelected && (
                      <span className="text-xs text-sky-300">Selected</span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
