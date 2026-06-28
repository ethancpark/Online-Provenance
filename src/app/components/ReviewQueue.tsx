"use client";

import { ShoppingCart, Package, Circle } from "lucide-react";
import type { MatchRow, ConfidenceBand } from "@/lib/types";

type Props = {
  matches: MatchRow[];
  selectedMatchId: string | null;
  onSelect: (id: string) => void;
};

// Signal palette (design.md §4): high → vermillion, medium → amber, low → neutral.
const BAND_STYLE: Record<ConfidenceBand, React.CSSProperties> = {
  high: { background: "var(--signal-high-tint-bg)", color: "var(--signal-high-tint-text)" },
  medium: { background: "var(--signal-med-tint-bg)", color: "var(--signal-med-tint-text)" },
  low: { background: "var(--color-parchment)", color: "var(--color-text-muted)", border: "1px solid var(--color-border)" },
};

function BandBadge({ band, confidence }: { band: ConfidenceBand; confidence: number }) {
  const pct = Math.round(confidence * 100);
  const label = band.charAt(0).toUpperCase() + band.slice(1);
  return (
    <span
      className="op-data inline-flex items-center rounded-full px-2.5 py-0.5 text-xs"
      style={BAND_STYLE[band]}
    >
      {label} match · {pct}%
    </span>
  );
}

function MarketplaceIcon({ mp }: { mp: string }) {
  const cls = "inline h-3 w-3 align-[-1px]";
  if (mp === "amazon") return <ShoppingCart className={cls} />;
  if (mp === "temu") return <Package className={cls} />;
  return <Circle className={cls} />;
}

export default function ReviewQueue({ matches, selectedMatchId, onSelect }: Props) {
  return (
    <div
      className="rounded-xl"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
        <h2 className="text-sm" style={{ fontFamily: "var(--font-display)", fontWeight: 500 }}>
          Review queue
        </h2>
        <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          Amazon, Temu
        </span>
      </div>

      <div className="max-h-[560px] overflow-y-auto">
        {matches.length === 0 && (
          <div className="px-5 py-12 text-center text-sm" style={{ color: "var(--color-text-muted)" }}>
            No flagged listings yet. The daily scan populates this queue.
          </div>
        )}

        {matches.map((m) => {
          const isSelected = m.id === selectedMatchId;
          const listing = m.listings;
          return (
            <button
              key={m.id}
              onClick={() => onSelect(m.id)}
              className="block w-full px-5 py-3 text-left transition-colors"
              style={{
                borderBottom: "1px solid var(--color-border)",
                borderLeft: isSelected ? "2px solid var(--color-navy)" : "2px solid transparent",
                background: isSelected ? "var(--color-parchment)" : "transparent",
              }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="flex h-12 w-12 flex-none items-center justify-center overflow-hidden rounded-md"
                  style={{ border: "1px solid var(--color-border)", background: "var(--color-parchment)" }}
                >
                  {listing.image_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={listing.image_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                      img
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{listing.title}</div>
                  <div className="mt-0.5 truncate text-xs" style={{ color: "var(--color-text-muted)" }}>
                    <MarketplaceIcon mp={listing.marketplace} /> {listing.marketplace}
                    {listing.seller ? ` · ${listing.seller}` : ""}
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <BandBadge band={m.confidence_band} confidence={m.confidence} />
                    {isSelected && (
                      <span className="text-xs" style={{ color: "var(--color-navy)" }}>
                        Selected
                      </span>
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
