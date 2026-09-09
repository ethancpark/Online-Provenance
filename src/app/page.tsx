import { getPublicClient } from "@/lib/supabase";
import { getSessionUser } from "@/lib/auth";
import LandingPage from "./components/LandingPage";
import { HERO_IMAGES } from "@/lib/heroImages";

export const dynamic = "force-dynamic";

type Row = { name: string; listings: { id: string }[] };

export default async function Home() {
  const supabase = getPublicClient();
  const sessionUser = await getSessionUser();
  // Only counts are needed here now — the hero images are local.
  const { data } = await supabase.from("tribes").select("name, listings(id)");
  const rows = (data ?? []) as unknown as Row[];

  const tribeCounts = rows
    .map((t) => ({ name: t.name, count: (t.listings ?? []).length }))
    .filter((t) => t.count > 0);

  const totalListings = tribeCounts.reduce((n, t) => n + t.count, 0);

  // The hero tiles are served from public/hero/ rather than hotlinked from
  // Amazon's CDN. Twenty-five third-party requests on first paint left the top
  // rows still arriving six seconds in over LTE, and a delisted product broke
  // its tile permanently. Refresh the wall with:
  //   cd pipeline && python3 -m scripts.build_hero_images
  const heroImages = HERO_IMAGES;

  return (
    <LandingPage
      tribesMonitored={rows.length}
      tribesAffected={tribeCounts.length}
      totalListings={totalListings}
      tribeCounts={tribeCounts}
      heroImages={heroImages}
      sessionUser={sessionUser}
    />
  );
}
