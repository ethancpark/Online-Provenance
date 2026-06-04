import { NextResponse } from "next/server";

// Triggers the GitHub Actions "Infringement scan" workflow on demand, so the
// dashboard's "Run scan" button kicks off a real scan in the cloud (the heavy
// CLIP/scraping pipeline can't run on Vercel). Runs only when clicked → no
// scheduled Actions minutes are spent.
//
// Env (set in web/.env.local and on Vercel):
//   GITHUB_DISPATCH_TOKEN  fine-grained PAT, repo scope, Actions: read & write
//   GITHUB_REPO            "owner/repo" (default: iphonezoomcalll/Indigenous-Scraper)
//   GITHUB_REF             branch to run on (default: main)

type Body = {
  marketplace?: "amazon" | "alibaba" | "both";
  max_per_query?: string;
};

export async function POST(req: Request) {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "GITHUB_DISPATCH_TOKEN not configured" },
      { status: 500 },
    );
  }
  const repo = process.env.GITHUB_REPO ?? "iphonezoomcalll/Indigenous-Scraper";
  const ref = process.env.GITHUB_REF ?? "main";

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    // no body is fine — fall back to defaults
  }

  const resp = await fetch(
    `https://api.github.com/repos/${repo}/actions/workflows/scan.yml/dispatches`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ref,
        inputs: {
          marketplace: body.marketplace ?? "amazon",
          max_per_query: body.max_per_query ?? "10",
        },
      }),
    },
  );

  // GitHub returns 204 No Content on success.
  if (resp.status === 204) {
    return NextResponse.json({ ok: true });
  }
  const detail = await resp.text();
  return NextResponse.json(
    { error: `GitHub dispatch failed (${resp.status})`, detail },
    { status: 502 },
  );
}
