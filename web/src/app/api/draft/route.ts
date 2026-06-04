import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getServerClient } from "@/lib/supabase";
import { getTribalLegalContact, type TribalLegalContact } from "@/lib/tribalLegal";

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
Write a concise, professional email alerting ${ctx.ag_office ?? "the tribe's own Attorney General / legal office"}
that the tribe's own mark is being sold without authorization, so their counsel can act.
The recipient IS the tribe's legal office — write to them as an ally flagging an
issue with THEIR mark, not as an outside complainant.

STRICT REQUIREMENTS:
- Under 150 words. Tight and scannable. No filler, no hedging, no restating the obvious.
- Open with a one-line greeting, then ONE sentence stating what was found.
- Include a compact, labeled block listing: Product, Marketplace, Seller, Listing, Match confidence.
- One sentence on suggested next step: a marketplace takedown / cease-and-desist${ctx.uspto_registered ? ", citing the tribe's USPTO trademark registration" : ""}.
- One short closing line noting this was auto-flagged and should be human-verified before action.
- Sign off as "Indigenous Scraper — automated IP monitoring".
- Plain text only. No subject line (it's sent separately). No [placeholders].

FACTS:
Tribe: ${ctx.tribe_name}
Recipient: ${ctx.ag_office ?? "Office of the Attorney General"}
Reproduced asset: ${ctx.asset_description}
Product: ${ctx.listing_title}
Listing URL: ${ctx.listing_url}
Marketplace: ${ctx.marketplace}
Seller: ${ctx.seller ?? "unknown"}
Match confidence: ${Math.round(ctx.confidence * 100)}%
USPTO registered: ${ctx.uspto_registered ? "yes" : "no"}
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
  ag_office: string | null;
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
      "*, listings!inner(*, tribes!inner(name, canonical_name, has_registered_mark)), reference_assets!inner(description)"
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
      tribes: {
        name: string;
        canonical_name: string | null;
        has_registered_mark: boolean;
      };
    };
    reference_assets: { description: string };
    confidence: number;
  };
  const listing = m.listings;
  const tribe = listing.tribes;
  const asset = m.reference_assets;

  // Resolve the tribe's OWN legal office for AG notifications
  const agContact: TribalLegalContact | null =
    body.draft_type === "ag_notification" ? getTribalLegalContact(tribe) : null;

  const ctx: DraftContext = {
    tribe_name: tribe.name,
    uspto_registered: tribe.has_registered_mark,
    asset_description: asset.description,
    listing_title: listing.title,
    listing_url: listing.listing_url,
    marketplace: listing.marketplace,
    seller: listing.seller,
    confidence: match.confidence,
    ag_office: agContact?.office ?? null,
  };

  const prompt = PROMPTS[body.draft_type](ctx);

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  let draftBody: string;
  try {
    const resp = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 700,
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
      recipient:
        body.draft_type === "marketplace_takedown"
          ? listing.marketplace
          : agContact?.email ?? agContact?.office ?? "tribal_legal_office",
      body: draftBody,
      status: "draft",
    })
    .select()
    .single();

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }
  return NextResponse.json({
    ok: true,
    draft,
    ag_contact: agContact,
    subject:
      body.draft_type === "ag_notification"
        ? `Notice of unauthorized commercial use of ${tribe.name} intellectual property`
        : `Takedown request: unauthorized use of ${tribe.name} mark`,
  });
}
