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
  image_url: string | null;
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
    .select(
      "confidence, listings!inner(title, marketplace, listing_url, image_url, seller, price, tribe_id, scraped_at)",
    )
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

const MARKETPLACE: Record<string, string> = { amazon: "Amazon", temu: "Temu" };

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
 * The HTML mail.
 *
 * Table layout and inline styles only, because mail clients strip stylesheets
 * and most ignore flexbox. Three things drive the design:
 *
 *  1. The product photo carries the message. Reading "Great Seal of the
 *     Chickasaw Nation Sticker" is abstract; seeing the seal on a bumper
 *     sticker is not. Every row leads with the image.
 *  2. Most clients block remote images until the reader allows them, so every
 *     row has to still make sense as text. The thumbnail cell keeps its width
 *     and carries alt text, and nothing but decoration is lost.
 *  3. Same paper/ink/clay palette as the site, so it reads as the same
 *     institution rather than a generic notification.
 */
export function digestHtml(d: Digest, siteUrl: string): string {
  const dash = `${siteUrl}/dashboard?tribe=${encodeURIComponent(d.nation)}`;

  const rows = d.listings
    .map((l) => {
      const pct = Math.round(l.confidence * 100);
      const facts = [MARKETPLACE[l.marketplace] ?? l.marketplace, l.price, l.seller]
        .filter(Boolean)
        .map((x) => esc(String(x)))
        .join(" &middot; ");
      const thumb = l.image_url
        ? `<img src="${esc(l.image_url)}" width="64" height="64" alt="${esc(l.title.slice(0, 60))}"
             style="display:block;width:64px;height:64px;object-fit:cover;border:1px solid #e2dacb;background:#f1eadd;">`
        : `<div style="width:64px;height:64px;border:1px solid #e2dacb;background:#f1eadd;"></div>`;
      return `
      <tr>
        <td style="padding:16px 0;border-bottom:1px solid #ede6da;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td width="64" valign="top" style="width:64px;padding-right:14px;">${thumb}</td>
              <td valign="top">
                <a href="${esc(l.listing_url)}"
                   style="color:#2b2622;font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:1.4;text-decoration:none;">
                  ${esc(l.title.slice(0, 110))}${l.title.length > 110 ? "&hellip;" : ""}
                </a>
                <div style="margin-top:6px;font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#6b6259;">
                  ${facts}
                </div>
                <div style="margin-top:6px;">
                  <span style="display:inline-block;font-family:Helvetica,Arial,sans-serif;font-size:11px;font-weight:bold;
                               color:#8c3620;background:#f5efe4;border:1px solid #e2dacb;padding:3px 7px;">
                    ${pct}% match to the ${esc(d.nation)} mark
                  </span>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>`;
    })
    .join("");

  const more =
    d.newCount > d.listings.length
      ? `<p style="margin:16px 0 0;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#6b6259;">
           and ${d.newCount - d.listings.length} more on the dashboard.
         </p>`
      : "";

  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>${esc(digestSubject(d))}</title></head>
<body style="margin:0;padding:0;background:#faf6ef;">
<!-- Shown in the inbox preview line, next to the subject. -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">
  ${d.newCount} new on ${d.listings.map((l) => MARKETPLACE[l.marketplace] ?? l.marketplace).filter((v, i, a) => a.indexOf(v) === i).join(" and ")}. Review before filing.
</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf6ef;padding:28px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
       style="max-width:600px;background:#fdfbf7;border:1px solid #e2dacb;">

  <tr><td style="padding:14px 28px;background:#2b2622;">
    <span style="font-family:Georgia,'Times New Roman',serif;font-size:17px;color:#f7f1e7;">Online Provenance</span>
    <span style="float:right;font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#b5ab9e;">${monthLabel(new Date())}</span>
  </td></tr>

  <tr><td style="padding:28px 28px 0;">
    <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:25px;font-weight:normal;color:#2b2622;line-height:1.28;">
      ${d.newCount} new listing${d.newCount === 1 ? "" : "s"} using the ${esc(d.nation)} seal
    </h1>
    <p style="margin:12px 0 0;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:#4a433c;">
      Found since ${monthLabel(d.since)}. ${d.totalFlagged} ${d.totalFlagged === 1 ? "is" : "are"} on record in total.
    </p>
  </td></tr>

  <tr><td style="padding:16px 28px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
    ${more}
  </td></tr>

  <tr><td style="padding:24px 28px 8px;">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td style="background:#a8462c;">
        <a href="${dash}" style="display:inline-block;padding:14px 24px;font-family:Helvetica,Arial,sans-serif;
           font-size:15px;font-weight:bold;color:#fdf6ee;text-decoration:none;">Review and prepare a report</a>
      </td>
    </tr></table>
    <p style="margin:14px 0 0;font-family:Helvetica,Arial,sans-serif;font-size:12.5px;line-height:1.6;color:#6b6259;">
      These are automated matches, not confirmed infringements. Whoever files a notice signs it
      under penalty of perjury, so check each listing first.
    </p>
  </td></tr>

  <tr><td style="padding:18px 28px 26px;border-top:1px solid #ede6da;">
    <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:11.5px;line-height:1.6;color:#8a8073;">
      You turned on monthly updates for ${esc(d.nation)}.
      <a href="${siteUrl}/account" style="color:#a8462c;">Turn them off</a> any time &mdash;
      this is the only email we send.
    </p>
  </td></tr>

</table>
</td></tr></table>
</body></html>`;
}
