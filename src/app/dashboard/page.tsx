import { getPublicClient } from "@/lib/supabase";
import { getSessionUser } from "@/lib/auth";
import type { Tribe, MatchRow, TribeSummary } from "@/lib/types";
import Dashboard from "../components/Dashboard";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ tribe?: string }>;
};

export default async function Home({ searchParams }: PageProps) {
  const { tribe: tribeParam } = await searchParams;
  const supabase = getPublicClient();
  const sessionUser = await getSessionUser();

  // All tribes for the dropdown
  const { data: tribes } = await supabase
    .from("tribes")
    .select("*")
    .order("rank", { ascending: true });

  const tribeList = (tribes ?? []) as Tribe[];

  // Which nation this page opens on, in order of who is asking:
  //   1. the URL — someone followed a link or used the dropdown
  //   2. the signed-in person's own nation — this is their desk, and landing
  //      on somebody else's nation is both confusing and the wrong default for
  //      a tool where acting on a nation's behalf is scoped to that nation
  //   3. the busiest nation, so a signed-out visitor still sees real evidence
  let selectedTribe: Tribe | null = null;
  if (tribeParam) {
    selectedTribe = tribeList.find((t) => t.name === tribeParam) ?? null;
  }

  if (!selectedTribe && sessionUser?.tribe_id) {
    selectedTribe = tribeList.find((t) => t.id === sessionUser.tribe_id) ?? null;
  }

  // Otherwise fall back to the tribe with the most matches
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
      sessionUser={sessionUser}
    />
  );
}
