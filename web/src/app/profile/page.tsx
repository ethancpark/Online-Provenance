import Link from "next/link";
import { getServerClient } from "@/lib/supabase";
import type { Tribe, TribeSummary } from "@/lib/types";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ tribe?: string }>;
};

export default async function ProfilePage({ searchParams }: PageProps) {
  const { tribe: tribeName } = await searchParams;
  const supabase = getServerClient();

  let tribe: Tribe | null = null;
  let summary: TribeSummary | null = null;

  if (tribeName) {
    const { data: tribeRow } = await supabase
      .from("tribes")
      .select("*")
      .eq("name", tribeName)
      .maybeSingle();
    tribe = (tribeRow as Tribe | null) ?? null;

    if (tribe) {
      const { data: summaryRow } = await supabase
        .from("tribe_summary")
        .select("*")
        .eq("tribe_id", tribe.id)
        .maybeSingle();
      summary = (summaryRow as TribeSummary | null) ?? null;
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/" className="text-sm text-sky-400 hover:underline">
            ‹ Back to dashboard
          </Link>
          <Link href="/" className="text-xs text-zinc-500 hover:text-zinc-300">
            Sign out
          </Link>
        </div>

        {!tribe ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-8 text-center text-sm text-zinc-400">
            No tribe selected. <Link href="/login" className="text-sky-400 hover:underline">Sign in</Link> to view a profile.
          </div>
        ) : (
          <>
            <div className="mb-6 flex items-center gap-4">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-full border border-sky-700 bg-sky-900/60 text-lg font-semibold text-sky-300"
                aria-hidden
              >
                {tribe.name.charAt(0)}
              </div>
              <div>
                <h1 className="text-2xl font-semibold">{tribe.name}</h1>
                <p className="text-sm text-zinc-400">
                  Acting on behalf of this tribe in the Indigenous Scraper review queue.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Card title="Tribe">
                <Row label="Name" value={tribe.name} />
                <Row label="Canonical name" value={tribe.canonical_name} />
                <Row label="Rank" value={tribe.rank?.toString() ?? "—"} />
              </Card>

              <Card title="USPTO status">
                <Row
                  label="Registered mark"
                  value={tribe.has_registered_mark ? "Yes" : "No"}
                />
                <Row label="Status" value={tribe.uspto_status ?? "—"} />
                {tribe.uspto_notes && <Row label="Notes" value={tribe.uspto_notes} />}
                {tribe.uspto_search_url && (
                  <Row
                    label="Search"
                    value={
                      <a
                        href={tribe.uspto_search_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sky-400 hover:underline"
                      >
                        USPTO record →
                      </a>
                    }
                  />
                )}
              </Card>

              <Card title="Review activity">
                <Row
                  label="Listings flagged"
                  value={summary?.listings_flagged?.toString() ?? "0"}
                />
                <Row
                  label="Awaiting review"
                  value={summary?.awaiting_review?.toString() ?? "0"}
                />
                <Row
                  label="Notices sent"
                  value={summary?.notices_sent?.toString() ?? "0"}
                />
                <Row
                  label="Listings removed"
                  value={summary?.removed?.toString() ?? "0"}
                />
              </Card>

              <Card title="Session">
                <Row label="Authenticated as" value="Tribal representative" />
                <Row label="Auth source" value="Demo (no real auth yet)" />
                <p className="mt-3 text-xs text-zinc-500">
                  Real authentication and tribal-rep verification are not yet wired up.
                  This profile reflects the tribe selected at sign-in.
                </p>
              </Card>
            </div>

            <p className="mt-8 text-center text-xs text-zinc-500">
              To switch tribes, sign out and sign back in with a different selection.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <h2 className="mb-3 text-xs uppercase tracking-wide text-zinc-400">{title}</h2>
      <dl className="flex flex-col gap-2 text-sm">{children}</dl>
    </div>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="text-right text-zinc-100">{value}</dd>
    </div>
  );
}
