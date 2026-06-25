"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Tribe, MatchRow, TribeSummary } from "@/lib/types";
import AboutProject from "./AboutProject";
import StatsHeader from "./StatsHeader";
import ReviewQueue from "./ReviewQueue";
import ListingDetail from "./ListingDetail";

type Props = {
  tribes: Tribe[];
  selectedTribe: Tribe | null;
  summary: TribeSummary | null;
  matches: MatchRow[];
};

export default function Dashboard({ tribes, selectedTribe, summary, matches }: Props) {
  const router = useRouter();
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(
    matches[0]?.id ?? null,
  );

  // Tribes listed alphabetically in the dropdown
  const sortedTribes = [...tribes].sort((a, b) => a.name.localeCompare(b.name));

  // Re-sync if a different tribe is selected
  const visibleMatches = matches;
  const selectedMatch = useMemo(
    () => visibleMatches.find((m) => m.id === selectedMatchId) ?? visibleMatches[0] ?? null,
    [visibleMatches, selectedMatchId],
  );

  function handleTribeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const name = e.target.value;
    router.push(`/dashboard?tribe=${encodeURIComponent(name)}`);
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-7xl px-6 py-6">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Infringement monitor</h1>
            <div className="mt-1 flex items-center gap-3 text-sm text-zinc-400">
              <select
                value={selectedTribe?.name ?? ""}
                onChange={handleTribeChange}
                className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-100 focus:border-zinc-500 focus:outline-none"
              >
                {sortedTribes.map((t) => (
                  <option key={t.id} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
              <span>·</span>
              <span>tribal seal &amp; flag protection</span>
              {selectedTribe?.has_registered_mark && (
                <>
                  <span>·</span>
                  <span className="rounded-md bg-emerald-900/40 px-2 py-0.5 text-emerald-300">
                    USPTO registered
                  </span>
                </>
              )}
              {selectedTribe?.uspto_search_url && (
                <>
                  <span>·</span>
                  <a
                    href={selectedTribe.uspto_search_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sky-400 hover:underline"
                    title={selectedTribe.uspto_notes ?? "USPTO trademark records"}
                  >
                    {selectedTribe.uspto_search_url.includes("tsdr.uspto.gov")
                      ? "USPTO seal registration ↗"
                      : "USPTO trademark records ↗"}
                  </a>
                </>
              )}
            </div>
          </div>
          <div className="text-right text-xs text-zinc-500">
            Auto-updated daily
          </div>
        </div>

        {/* About this project */}
        <AboutProject />

        {/* KPI cards */}
        <StatsHeader summary={summary} />

        {/* Two-column body */}
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ReviewQueue
            matches={visibleMatches}
            selectedMatchId={selectedMatch?.id ?? null}
            onSelect={setSelectedMatchId}
          />
          <ListingDetail match={selectedMatch} />
        </div>

        <p className="mt-8 text-center text-xs text-zinc-500">
          Indigenous Scraper — research prototype. Drafts are queued for human review before
          anything is sent. Nothing files automatically.
        </p>
      </div>
    </div>
  );
}
