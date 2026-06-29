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
        <div
          key={c.label}
          className="rounded-[2px] px-5 py-4"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <div className="op-eyebrow">{c.label}</div>
          <div className="op-data mt-1.5 text-4xl" style={{ fontWeight: 500, color: c.color }}>
            {c.value}
          </div>
        </div>
      ))}
    </div>
  );
}
