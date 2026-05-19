import type { TribeSummary } from "@/lib/types";

type Props = { summary: TribeSummary | null };

export default function StatsHeader({ summary }: Props) {
  const cards = [
    { label: "Listings flagged", value: summary?.listings_flagged ?? 0, color: "text-zinc-100" },
    { label: "Awaiting review", value: summary?.awaiting_review ?? 0, color: "text-amber-300" },
    { label: "Notices sent", value: summary?.notices_sent ?? 0, color: "text-sky-300" },
    { label: "Removed", value: summary?.removed ?? 0, color: "text-emerald-300" },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3"
        >
          <div className="text-xs uppercase tracking-wide text-zinc-400">{c.label}</div>
          <div className={`mt-1 text-3xl font-semibold ${c.color}`}>{c.value}</div>
        </div>
      ))}
    </div>
  );
}
