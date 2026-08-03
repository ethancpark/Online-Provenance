import { getServerClient } from "@/lib/supabase";
import LandingPage from "./components/LandingPage";

export const dynamic = "force-dynamic";

type Row = { name: string; listings: { id: string; image_url: string | null }[] };

export default async function Home() {
  const supabase = getServerClient();
  const { data } = await supabase.from("tribes").select("name, listings(id, image_url)");
  const rows = (data ?? []) as unknown as Row[];

  const tribeCounts = rows
    .map((t) => ({ name: t.name, count: (t.listings ?? []).length }))
    .filter((t) => t.count > 0);

  const totalListings = tribeCounts.reduce((n, t) => n + t.count, 0);

  // Real product photos from flagged listings — the hero imagery is the
  // infringement itself, not stock or Native imagery. Interleave across tribes
  // (round-robin) so the wall shows many nations rather than 60 of one.
  const perTribe = rows
    .map((t) => (t.listings ?? []).map((l) => l.image_url).filter((u): u is string => Boolean(u)))
    .filter((imgs) => imgs.length > 0);
  const heroImages: string[] = [];
  for (let i = 0; heroImages.length < 60 && i < 40; i++) {
    for (const imgs of perTribe) {
      if (i < imgs.length && heroImages.length < 60) heroImages.push(imgs[i]);
    }
  }

  return (
    <LandingPage
      tribesMonitored={rows.length}
      tribesAffected={tribeCounts.length}
      totalListings={totalListings}
      tribeCounts={tribeCounts}
      heroImages={heroImages}
    />
  );
}
