"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import type { Tribe, MatchRow, TribeSummary } from "@/lib/types";
import Seal from "./Seal";
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
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(matches[0]?.id ?? null);

  const sortedTribes = [...tribes].sort((a, b) => a.name.localeCompare(b.name));

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
    <div className="min-h-screen" style={{ background: "var(--color-parchment)", color: "var(--color-ink)" }}>
      <div className="mx-auto max-w-7xl px-6 py-6">
        {/* Wordmark bar */}
        <div className="mb-6 flex items-center gap-2" style={{ borderBottom: "1px solid var(--color-border)" }}>
          <div className="flex items-center gap-2 pb-4">
            <Seal size={26} />
            <span
              className="text-xs"
              style={{ fontFamily: "var(--font-display)", fontWeight: 600, letterSpacing: "0.13em", color: "var(--color-navy)" }}
            >
              ONLINE PROVENANCE
            </span>
          </div>
        </div>

        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl" style={{ fontFamily: "var(--font-display)", fontWeight: 600, color: "var(--color-navy)" }}>
              Infringement monitor
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm" style={{ color: "var(--color-text-secondary)" }}>
              <select
                value={selectedTribe?.name ?? ""}
                onChange={handleTribeChange}
                className="rounded-lg px-2.5 py-1.5 focus:outline-none"
                style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-ink)" }}
              >
                {sortedTribes.map((t) => (
                  <option key={t.id} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
              <span style={{ color: "var(--color-text-muted)" }}>tribal seal &amp; flag protection</span>
              {selectedTribe?.has_registered_mark && (
                <span
                  className="rounded-full px-2.5 py-0.5 text-xs"
                  style={{ background: "var(--signal-ok-tint-bg)", color: "var(--signal-ok-tint-text)" }}
                >
                  USPTO registered
                </span>
              )}
              {selectedTribe?.uspto_search_url && (
                <a
                  href={selectedTribe.uspto_search_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 hover:underline"
                  style={{ color: "var(--color-navy)" }}
                  title={selectedTribe.uspto_notes ?? "USPTO trademark records"}
                >
                  {selectedTribe.uspto_search_url.includes("tsdr.uspto.gov")
                    ? "USPTO seal registration"
                    : "USPTO trademark records"}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          </div>
          <div className="text-right text-xs" style={{ color: "var(--color-text-muted)" }}>
            Auto-updated daily
          </div>
        </div>

        {/* About this project */}
        <AboutProject />

        {/* Metric cards */}
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

        <p className="mt-8 text-center text-xs" style={{ color: "var(--color-text-muted)" }}>
          Online Provenance — research prototype. Drafts are queued for human review before
          anything is sent. Nothing files automatically.
        </p>
      </div>
    </div>
  );
}
