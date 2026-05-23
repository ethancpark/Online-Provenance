"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Tribe, MatchRow, TribeSummary } from "@/lib/types";
import StatsHeader from "./StatsHeader";
import ReviewQueue from "./ReviewQueue";
import ListingDetail from "./ListingDetail";

type Props = {
  tribes: Tribe[];
  selectedTribe: Tribe | null;
  summary: TribeSummary | null;
  matches: MatchRow[];
  signedIn: boolean;
};

export default function Dashboard({
  tribes,
  selectedTribe,
  summary,
  matches,
  signedIn,
}: Props) {
  const router = useRouter();
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(
    matches[0]?.id ?? null,
  );

  // Re-sync if a different tribe is selected
  const visibleMatches = matches;
  const selectedMatch = useMemo(
    () => visibleMatches.find((m) => m.id === selectedMatchId) ?? visibleMatches[0] ?? null,
    [visibleMatches, selectedMatchId],
  );

  function handleTribeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const name = e.target.value;
    router.push(`/?tribe=${encodeURIComponent(name)}`);
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
                {tribes.map((t) => (
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
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm hover:bg-zinc-800">
              ↻ Run scan
            </button>
            <button className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm hover:bg-zinc-800">
              ⚙ Tribes &amp; assets
            </button>
            <span className="mx-1 h-5 w-px bg-zinc-800" aria-hidden />
            {signedIn && selectedTribe ? (
              <>
                <Link
                  href={`/profile?tribe=${encodeURIComponent(selectedTribe.name)}`}
                  className="flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm hover:bg-zinc-800"
                >
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-900/60 text-[10px] font-semibold text-sky-300"
                    aria-hidden
                  >
                    {selectedTribe.name.charAt(0)}
                  </span>
                  <span className="hidden sm:inline">{selectedTribe.name}</span>
                  <span className="text-xs text-zinc-500">· Profile</span>
                </Link>
                <Link
                  href="/"
                  className="text-xs text-zinc-500 hover:text-zinc-300"
                >
                  Sign out
                </Link>
              </>
            ) : (
              <Link
                href="/login"
                className="rounded-md border border-sky-700 bg-sky-900/40 px-3 py-1.5 text-sm font-medium text-sky-300 hover:bg-sky-900/60"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>

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
