import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The monthly digest: what appeared on the marketplaces for one nation since
 * that nation's last email.
 *
 * Windowed on the last successful send rather than on the calendar, so a retry
 * cannot send the same listings twice and a missed month cannot leave a gap.
 * A nation with nothing new gets no email at all — a monthly "nothing found"
 * message trains people to ignore the one that matters.
 */

export const DEFAULT_WINDOW_DAYS = 31;

export type DigestListing = {
  title: string;
  marketplace: string;
  listing_url: string;
  seller: string | null;
  price: string | null;
  confidence: number;
};

export type Digest = {
  nation: string;
  since: Date;
  newCount: number;
  totalFlagged: number;
  listings: DigestListing[];
};

/** How far back this account's digest should reach. */
export function windowStart(lastSentAt: string | null, now = new Date()): Date {
  if (lastSentAt) return new Date(lastSentAt);
  return new Date(now.getTime() - DEFAULT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}

/** The listings a nation would be told about, most confident first. */
export async function buildDigest(
  supabase: SupabaseClient,
  tribeId: string,
  nation: string,
  since: Date,
  limit = 12,
): Promise<Digest> {
  const { data: rows } = await supabase
    .from("matches")
    .select("confidence, listings!inner(title, marketplace, listing_url, seller, price, tribe_id, scraped_at)")
    .eq("listings.tribe_id", tribeId)
    .gte("listings.scraped_at", since.toISOString())
    .order("confidence", { ascending: false });

  type Row = { confidence: number; listings: Omit<DigestListing, "confidence"> };
  const all = (rows ?? []) as unknown as Row[];

  // One listing can match more than one reference asset; show it once.
  const seen = new Set<string>();
  const listings: DigestListing[] = [];
  for (const r of all) {
    if (seen.has(r.listings.listing_url)) continue;
    seen.add(r.listings.listing_url);
    listings.push({ ...r.listings, confidence: r.confidence });
  }

  const { count: totalFlagged } = await supabase
    .from("matches")
    .select("id, listings!inner(tribe_id)", { count: "exact", head: true })
    .eq("listings.tribe_id", tribeId);

  return {
    nation,
    since,
    newCount: listings.length,
    totalFlagged: totalFlagged ?? 0,
    listings: listings.slice(0, limit),
  };
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

function monthLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function digestSubject(d: Digest): string {
  const n = d.newCount;
  return `${n} new listing${n === 1 ? "" : "s"} using the ${d.nation} seal`;
}

/**
 * Plain text alongside the HTML. Some tribal offices run mail clients that
 * strip HTML entirely, and this is a record they may need to forward.
 */
export function digestText(d: Digest, siteUrl: string): string {
  const lines = [
    `${d.newCount} new listing${d.newCount === 1 ? "" : "s"} carrying the ${d.nation} seal or flag`,
    `were found since ${monthLabel(d.since)}. ${d.totalFlagged} are on record in total.`,
    ``,
  ];
  d.listings.forEach((l, i) => {
    lines.push(
      `${i + 1}. ${l.title}`,
      `   ${l.marketplace} — ${Math.round(l.confidence * 100)}% match${l.price ? ` — ${l.price}` : ""}`,
      `   ${l.listing_url}`,
      ``,
    );
  });
  if (d.newCount > d.listings.length) {
    lines.push(`...and ${d.newCount - d.listings.length} more.`, ``);
  }
  lines.push(
    `Review them and prepare a report: ${siteUrl}/dashboard?tribe=${encodeURIComponent(d.nation)}`,
    ``,
    `You are receiving this because you turned on monthly updates.`,
    `Turn them off any time: ${siteUrl}/account`,
  );
  return lines.join("\n");
}

/**
 * The HTML mail. Inline styles only and a table layout, because mail clients
 * strip stylesheets — and in the project's own paper/ink palette so it reads
 * as the same institution as the site.
 */
export function digestHtml(d: Digest, siteUrl: string): string {
  const dash = `${siteUrl}/dashboard?tribe=${encodeURIComponent(d.nation)}`;
  const rows = d.listings
    .map(
      (l) => `
      <tr>
        <td style="padding:14px 0;border-bottom:1px solid #e2dacb;">
          <a href="${esc(l.listing_url)}" style="color:#2b2622;font-size:15px;line-height:1.45;text-decoration:none;font-weight:600;">${esc(l.title.slice(0, 120))}</a>
          <div style="margin-top:5px;font-size:13px;color:#6b6259;">
            ${esc(l.marketplace)} &middot; ${Math.round(l.confidence * 100)}% match${l.price ? ` &middot; ${esc(l.price)}` : ""}${l.seller ? ` &middot; ${esc(l.seller)}` : ""}
          </div>
        </td>
      </tr>`,
    )
    .join("");

  const more =
    d.newCount > d.listings.length
      ? `<p style="margin:16px 0 0;font-size:14px;color:#6b6259;">…and ${d.newCount - d.listings.length} more on the dashboard.</p>`
      : "";

  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#faf6ef;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf6ef;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fdfbf7;border:1px solid #e2dacb;">
  <tr><td style="padding:28px 28px 0;">
    <div style="font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#8a8073;">Online Provenance</div>
    <h1 style="margin:12px 0 0;font-family:Georgia,serif;font-size:26px;font-weight:500;color:#2b2622;line-height:1.25;">
      ${d.newCount} new listing${d.newCount === 1 ? "" : "s"} using the ${esc(d.nation)} seal
    </h1>
    <p style="margin:12px 0 0;font-size:14px;line-height:1.6;color:#4a433c;">
      Found since ${monthLabel(d.since)}. ${d.totalFlagged} listing${d.totalFlagged === 1 ? " is" : "s are"} on record in total.
      These are automated matches — review them before filing anything.
    </p>
  </td></tr>
  <tr><td style="padding:8px 28px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
    ${more}
  </td></tr>
  <tr><td style="padding:24px 28px 28px;">
    <a href="${dash}" style="display:inline-block;background:#2b2622;color:#fdf6ee;font-size:15px;font-weight:700;padding:13px 22px;text-decoration:none;">Review and prepare a report</a>
    <p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#8a8073;">
      You turned on monthly updates for ${esc(d.nation)}.
      <a href="${siteUrl}/account" style="color:#a8462c;">Turn them off</a> any time.
    </p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}
