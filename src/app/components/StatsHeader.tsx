import type { TribeSummary } from "@/lib/types";

type Props = { summary: TribeSummary | null };

// Metric cards (design.md §7): muted label above, large Fraunces number below,
// subtle surface fill, no border. "Removed" reads in the green protected signal.
export default function StatsHeader({ summary }: Props) {
  const cards = [
    { label: "Listings flagged", value: summary?.listings_flagged ?? 0, color: "var(--color-navy)" },
    { label: "Removed", value: summary?.removed ?? 0, color: "var(--signal-ok-tint-text)" },
  ];

  return (
    <div className="grid grid-cols-2 gap-4">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl px-5 py-4" style={{ background: "var(--color-surface)" }}>
          <div
            className="text-xs"
            style={{ color: "var(--color-text-muted)", letterSpacing: "0.04em", fontWeight: 500 }}
          >
            {c.label}
          </div>
          <div
            className="mt-1 text-4xl"
            style={{ fontFamily: "var(--font-display)", fontWeight: 600, color: c.color }}
          >
            {c.value}
          </div>
        </div>
      ))}
    </div>
  );
}
