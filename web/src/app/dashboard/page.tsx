import { getServerClient } from "@/lib/supabase";
import type { Tribe, MatchRow, TribeSummary } from "@/lib/types";
import Dashboard from "./components/Dashboard";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ tribe?: string }>;
};

export default async function Home({ searchParams }: PageProps) {
  const { tribe: tribeParam } = await searchParams;
  const supabase = getServerClient();

  // All tribes for the dropdown
  const { data: tribes } = await supabase
    .from("tribes")
    .select("*")
    .order("rank", { ascending: true });

  const tribeList = (tribes ?? []) as Tribe[];

  // Pick a default tribe — the URL param wins, otherwise the first tribe
  // that has any matches (so the demo isn't empty on first load).
  let selectedTribe: Tribe | null = null;
  if (tribeParam) {
    selectedTribe = tribeList.find((t) => t.name === tribeParam) ?? null;
  }

  // If no URL param, find the first tribe with matches
  if (!selectedTribe) {
    const { data: tribeWithMatches } = await supabase
      .from("tribe_summary")
      .select("tribe_id, tribe_name, listings_flagged")
      .gt("listings_flagged", 0)
      .order("listings_flagged", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (tribeWithMatches) {
      selectedTribe = tribeList.find((t) => t.id === tribeWithMatches.tribe_id) ?? null;
    }
  }

  if (!selectedTribe) {
    selectedTribe = tribeList[0] ?? null;
  }

  // Pull this tribe's summary counts + matches
  let summary: TribeSummary | null = null;
  let matches: MatchRow[] = [];
  if (selectedTribe) {
    const { data: summaryRow } = await supabase
      .from("tribe_summary")
      .select("*")
      .eq("tribe_id", selectedTribe.id)
      .maybeSingle();
    summary = (summaryRow as TribeSummary | null) ?? null;

    const { data: matchRows } = await supabase
      .from("matches")
      .select("*, listings!inner(*), reference_assets!inner(*)")
      .eq("listings.tribe_id", selectedTribe.id)
      .order("confidence", { ascending: false });
    matches = (matchRows ?? []) as unknown as MatchRow[];
  }

  return (
    <Dashboard
      tribes={tribeList}
      selectedTribe={selectedTribe}
      summary={summary}
      matches={matches}
    />
  );
}
