import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getServerClient } from "@/lib/supabase";

type Body = {
  match_id: string;
  draft_type: "marketplace_takedown" | "ag_notification";
};

const PROMPTS = {
  marketplace_takedown: (ctx: DraftContext) => `
You are drafting a marketplace takedown notice on behalf of a federally
recognized tribe whose intellectual property (seal, flag, or other tribal mark)
is being reproduced on a product listing without authorization.

Draft a takedown notice addressed to ${ctx.marketplace === "amazon" ? "Amazon's Brand Protection team" : "the marketplace's IP infringement team"}.

Be professional, factual, and concise. Include:
- The tribe's name and federally recognized status
- The infringing product (title, URL, ASIN/product ID)
- The reproduced asset (the tribe's ${ctx.asset_description})
- A clear request for removal
${ctx.uspto_registered ? "- Reference the tribe's USPTO trademark registration" : ""}
- A statement that this notice is submitted in good faith

Tribe: ${ctx.tribe_name}
USPTO registered: ${ctx.uspto_registered ? "yes" : "no"}
Asset reproduced: ${ctx.asset_description}
Product: ${ctx.listing_title}
Listing URL: ${ctx.listing_url}
Marketplace: ${ctx.marketplace}
Seller: ${ctx.seller ?? "unknown"}
Match confidence: ${Math.round(ctx.confidence * 100)}%

Output the notice as plain text ready to be reviewed and sent. Do not include
placeholders like [insert name] — write it as if from a tribal IP representative.
  `.trim(),

  ag_notification: (ctx: DraftContext) => `
You are drafting a notification letter to a state Attorney General's office about
potential unauthorized commercial use of a federally recognized tribe's
intellectual property (seal, flag, or other tribal mark) on an online marketplace.

Be professional and factual. Include:
- The tribe's name and federally recognized status
- A description of the reproduced asset
- Details of the listing(s) involved
- A request that the AG's office consider whether action is warranted under
  state consumer protection and trademark laws
- A statement that this is a notification, not a formal complaint

Tribe: ${ctx.tribe_name}
USPTO registered: ${ctx.uspto_registered ? "yes" : "no"}
Asset reproduced: ${ctx.asset_description}
Product: ${ctx.listing_title}
Listing URL: ${ctx.listing_url}
Marketplace: ${ctx.marketplace}
Seller: ${ctx.seller ?? "unknown"}

Output the letter as plain text ready to be reviewed and sent.
  `.trim(),
};

type DraftContext = {
  tribe_name: string;
  uspto_registered: boolean;
  asset_description: string;
  listing_title: string;
  listing_url: string;
  marketplace: string;
  seller: string | null;
  confidence: number;
};

export async function POST(req: Request) {
  const body = (await req.json()) as Body;
  if (!body.match_id || !["marketplace_takedown", "ag_notification"].includes(body.draft_type)) {
    return NextResponse.json({ error: "bad payload" }, { status: 400 });
  }

  const supabase = getServerClient();

  // Pull all the context we need to write a good draft
  const { data: match, error: matchErr } = await supabase
    .from("matches")
    .select(
      "*, listings!inner(*, tribes!inner(*)), reference_assets!inner(description)"
    )
    .eq("id", body.match_id)
    .maybeSingle();

  if (matchErr || !match) {
    return NextResponse.json({ error: matchErr?.message ?? "match not found" }, { status: 404 });
  }

  // The nested-join shape isn't in the generated types
  const m = match as unknown as {
    listings: {
      title: string;
      listing_url: string;
      marketplace: string;
      seller: string | null;
      tribes: { name: string; has_registered_mark: boolean };
    };
    reference_assets: { description: string };
    confidence: number;
  };
  const listing = m.listings;
  const tribe = listing.tribes;
  const asset = m.reference_assets;

  const ctx: DraftContext = {
    tribe_name: tribe.name,
    uspto_registered: tribe.has_registered_mark,
    asset_description: asset.description,
    listing_title: listing.title,
    listing_url: listing.listing_url,
    marketplace: listing.marketplace,
    seller: listing.seller,
    confidence: match.confidence,
  };

  const prompt = PROMPTS[body.draft_type](ctx);

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  let draftBody: string;
  try {
    const resp = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });
    draftBody = resp.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("\n");
  } catch (e) {
    return NextResponse.json(
      { error: `Anthropic call failed: ${(e as Error).message}` },
      { status: 502 },
    );
  }

  const { data: draft, error: insertErr } = await supabase
    .from("takedown_drafts")
    .insert({
      match_id: body.match_id,
      draft_type: body.draft_type,
      recipient: body.draft_type === "marketplace_takedown" ? listing.marketplace : "state_ag",
      body: draftBody,
      status: "draft",
    })
    .select()
    .single();

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, draft });
}
