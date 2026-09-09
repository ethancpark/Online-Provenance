import { getPublicClient } from "@/lib/supabase";
import { getSessionUser } from "@/lib/auth";
import LandingPage from "./components/LandingPage";

export const dynamic = "force-dynamic";

type Summary = { tribe_name: string; listings_flagged: number };

export default async function Home() {
  const supabase = getPublicClient();
  const sessionUser = await getSessionUser();

  // Counted from tribe_summary, the same view the dashboard reads. Counting
  // rows in `listings` instead overstated it: a listing stays on record after
  // its match is removed, so a nation with nothing currently flagged still
  // contributed to the headline number. Delaware Tribe of Indians read 8 on
  // the home page and 0 on its own dashboard.
  const [{ data: summary }, { count: monitored }] = await Promise.all([
    supabase.from("tribe_summary").select("tribe_name, listings_flagged"),
    supabase.from("tribes").select("id", { count: "exact", head: true }),
  ]);

  const tribeCounts = ((summary ?? []) as Summary[])
    .map((t) => ({ name: t.tribe_name, count: t.listings_flagged ?? 0 }))
    .filter((t) => t.count > 0);

  const totalListings = tribeCounts.reduce((n, t) => n + t.count, 0);

  // The hero wall is a single pre-composed image per orientation, imported by
  // the component from src/lib/heroImages.ts. Refresh it with:
  //   cd pipeline && python3 -m scripts.build_hero_images
  return (
    <LandingPage
      tribesMonitored={monitored ?? 0}
      tribesAffected={tribeCounts.length}
      totalListings={totalListings}
      tribeCounts={tribeCounts}
      sessionUser={sessionUser}
    />
  );
}
