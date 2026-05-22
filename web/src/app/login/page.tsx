import { getServerClient } from "@/lib/supabase";
import type { Tribe } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const supabase = getServerClient();
  const { data: tribes } = await supabase
    .from("tribes")
    .select("*")
    .order("rank", { ascending: true });

  const tribeList = (tribes ?? []) as Tribe[];

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-zinc-100">
      <div className="w-full max-w-md rounded-lg border border-zinc-800 bg-zinc-900 p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 h-10 w-10 rounded-md border border-zinc-700 bg-zinc-800" />
          <h1 className="text-xl font-semibold">Indigenous Scraper</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Sign in to monitor and protect your tribe&apos;s marks
          </p>
        </div>

        {/*
          Submits GET to "/" so the selected tribe is forwarded to the dashboard as
          ?tribe=<name>, matching the dashboard's existing searchParams handling.
          Email + password inputs are presentational only until auth is wired up.
        */}
        <form action="/" method="get" className="flex flex-col gap-4">
          <Field label="Email">
            <input
              type="email"
              placeholder="attorney@nativebar.org"
              className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
            />
          </Field>

          <Field label="Password">
            <input
              type="password"
              placeholder="••••••••"
              className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
            />
          </Field>

          <Field label="Representing">
            <select
              name="tribe"
              defaultValue={tribeList[0]?.name ?? ""}
              className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:border-zinc-500 focus:outline-none"
            >
              {tribeList.length === 0 ? (
                <option value="">No tribes available</option>
              ) : (
                tribeList.map((t) => (
                  <option key={t.id} value={t.name}>
                    {t.name}
                  </option>
                ))
              )}
            </select>
          </Field>

          <button
            type="submit"
            className="mt-2 w-full rounded-md border border-sky-700 bg-sky-900/40 px-3 py-2.5 text-sm font-medium text-sky-300 hover:bg-sky-900/60"
          >
            Sign in
          </button>

          <p className="text-center text-xs text-zinc-500">
            Credentials verified against the federally recognized tribes registry.
          </p>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs uppercase tracking-wide text-zinc-400">
        {label}
      </span>
      {children}
    </label>
  );
}
