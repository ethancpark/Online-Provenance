import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase";

type Reporter = {
  name: string;
  title: string;
  organization: string;
  address: string;
  email: string;
  phone: string;
};

type Body = { match_id: string; reporter: Reporter };

type NoticeContext = {
  tribe_name: string;
  uspto_registered: boolean;
  asset_description: string;
  listing_title: string;
  listing_url: string;
  marketplace: "amazon" | "temu" | string;
  seller: string | null;
};

function normalizeReporter(input: unknown): Reporter | null {
  if (!input || typeof input !== "object") return null;
  const r = input as Record<string, unknown>;
  const str = (k: string) => (typeof r[k] === "string" ? (r[k] as string).trim() : "");
  return {
    name: str("name"),
    title: str("title"),
    organization: str("organization"),
    address: str("address"),
    email: str("email"),
    phone: str("phone"),
  };
}

function reporterMissingFields(r: Reporter): string[] {
  const required: (keyof Reporter)[] = ["name", "address", "email"];
  return required.filter((k) => !r[k] || r[k].trim() === "");
}

function buildAmazonNotice(ctx: NoticeContext, r: Reporter): string {
  const today = new Date().toISOString().slice(0, 10);
  return [
    `Subject: DMCA Takedown Notice — Unauthorized Use of ${ctx.tribe_name} Intellectual Property`,
    ``,
    `To: Amazon.com Legal Department / Copyright Agent`,
    `Date: ${today}`,
    ``,
    `To whom it may concern,`,
    ``,
    `This is a formal notification under the Digital Millennium Copyright Act (17 U.S.C. § 512(c)) of copyright infringement occurring on Amazon.com.`,
    ``,
    `1. Identification of the copyrighted work:`,
    `   ${ctx.asset_description}, owned by ${ctx.tribe_name}${ctx.uspto_registered ? " (USPTO-registered mark)" : ""}.`,
    ``,
    `2. Identification of the infringing material and its location:`,
    `   Product listing: ${ctx.listing_title}`,
    `   URL: ${ctx.listing_url}`,
    `   Seller: ${ctx.seller ?? "unknown"}`,
    ``,
    `3. Contact information of the complaining party:`,
    `   Name: ${r.name}`,
    r.title ? `   Title: ${r.title}` : null,
    r.organization ? `   Organization: ${r.organization}` : null,
    `   Address: ${r.address}`,
    `   Email: ${r.email}`,
    r.phone ? `   Phone: ${r.phone}` : null,
    ``,
    `4. I have a good faith belief that use of the material described above is not authorized by the copyright owner, its agent, or the law.`,
    ``,
    `5. I swear, under penalty of perjury, that the information in this notification is accurate and that I am authorized to act on behalf of the owner of the rights being infringed.`,
    ``,
    `Please remove or disable access to the listed material promptly.`,
    ``,
    `Signed,`,
    `${r.name}`,
    r.title ? `${r.title}` : null,
    r.organization ? `${r.organization}` : null,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

function buildTemuNotice(ctx: NoticeContext, r: Reporter): string {
  const today = new Date().toISOString().slice(0, 10);
  return [
    `Subject: Intellectual Property Infringement Complaint — ${ctx.tribe_name}`,
    ``,
    `To: Temu Intellectual Property Protection Team`,
    `Date: ${today}`,
    ``,
    `Rights holder: ${ctx.tribe_name}${ctx.uspto_registered ? " (USPTO-registered mark)" : ""}`,
    `Protected asset: ${ctx.asset_description}`,
    ``,
    `Allegedly infringing listing:`,
    `  Title: ${ctx.listing_title}`,
    `  URL: ${ctx.listing_url}`,
    `  Seller: ${ctx.seller ?? "unknown"}`,
    ``,
    `Complaint:`,
    `The above listing reproduces ${ctx.tribe_name}'s ${ctx.asset_description} without authorization. We request that the listing be removed pursuant to Temu's intellectual property protection policies.`,
    ``,
    `Complainant information:`,
    `  Name: ${r.name}`,
    r.title ? `  Title: ${r.title}` : null,
    r.organization ? `  Organization: ${r.organization}` : null,
    `  Address: ${r.address}`,
    `  Email: ${r.email}`,
    r.phone ? `  Phone: ${r.phone}` : null,
    ``,
    `I declare in good faith that the information above is accurate and that the listed material is not authorized by the rights holder, their agent, or the law.`,
    ``,
    `Signed,`,
    `${r.name}`,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

type Dispatch =
  | {
      method: "mailto";
      recipient: string;
      subject: string;
      body: string;
    }
  | {
      method: "portal";
      portal_url: string;
      subject: string;
      body: string;
    };

export async function POST(req: Request) {
  const body = (await req.json()) as Body;
  if (!body.match_id) {
    return NextResponse.json({ error: "missing match_id" }, { status: 400 });
  }

  const reporter = normalizeReporter(body.reporter);
  if (!reporter) {
    return NextResponse.json({ error: "missing reporter object" }, { status: 400 });
  }
  const missing = reporterMissingFields(reporter);
  if (missing.length > 0) {
    return NextResponse.json(
      {
        error: `Claimant info incomplete. Provide: ${missing.join(", ")}`,
      },
      { status: 400 },
    );
  }

  const supabase = getServerClient();

  const { data: match, error: matchErr } = await supabase
    .from("matches")
    .select(
      "*, listings!inner(*, tribes!inner(*)), reference_assets!inner(description)",
    )
    .eq("id", body.match_id)
    .maybeSingle();

  if (matchErr || !match) {
    return NextResponse.json(
      { error: matchErr?.message ?? "match not found" },
      { status: 404 },
    );
  }

  const m = match as unknown as {
    listings: {
      title: string;
      listing_url: string;
      marketplace: "amazon" | "temu" | string;
      seller: string | null;
      tribes: { name: string; has_registered_mark: boolean };
    };
    reference_assets: { description: string };
  };

  const ctx: NoticeContext = {
    tribe_name: m.listings.tribes.name,
    uspto_registered: m.listings.tribes.has_registered_mark,
    asset_description: m.reference_assets.description,
    listing_title: m.listings.title,
    listing_url: m.listings.listing_url,
    marketplace: m.listings.marketplace,
    seller: m.listings.seller,
  };

  let dispatch: Dispatch;
  let recipientLabel: string;

  if (ctx.marketplace === "amazon") {
    const noticeBody = buildAmazonNotice(ctx, reporter);
    const subject = `DMCA Takedown Notice — Unauthorized Use of ${ctx.tribe_name} Intellectual Property`;
    dispatch = {
      method: "mailto",
      recipient: "notice@amazon.com",
      subject,
      body: noticeBody,
    };
    recipientLabel = "amazon:notice@amazon.com";
  } else if (ctx.marketplace === "temu") {
    const noticeBody = buildTemuNotice(ctx, reporter);
    const subject = `IP Infringement Complaint — ${ctx.tribe_name}`;
    dispatch = {
      method: "portal",
      // Temu's IP complaint portal — verify the exact submission URL.
      portal_url: "https://www.temu.com/intellectual-property-and-takedown-policy.html",
      subject,
      body: noticeBody,
    };
    recipientLabel = "temu:ip_portal";
  } else {
    return NextResponse.json(
      { error: `Unsupported marketplace: ${ctx.marketplace}` },
      { status: 400 },
    );
  }

  const { error: insertErr } = await supabase.from("takedown_drafts").insert({
    match_id: body.match_id,
    draft_type: "marketplace_takedown",
    recipient: recipientLabel,
    body: dispatch.body,
    status: "draft",
  });

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, dispatch });
}
