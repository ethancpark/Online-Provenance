import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReportCounts, ReportRow } from "./reportWorkbook";

/**
 * The weekly report: listings found for one nation in a window, shaped for the
 * spreadsheet leadership takes into its weekly meeting.
 *
 * Same data as the dashboard queue — matches joined to their listing and the
 * reference asset they matched — windowed on when the listing was scraped.
 */

export const WEEKLY_WINDOW_DAYS = 7;

const MARKETPLACE: Record<string, string> = { amazon: "Amazon", temu: "Temu" };
const STATUS: Record<string, string> = {
  awaiting_review: "Awaiting review",
  confirmed: "Confirmed",
  dismissed: "Dismissed",
};
const cap = (s: string | null | undefined) => (s ? s[0].toUpperCase() + s.slice(1) : null);
const ymd = (d: Date | string) => new Date(d).toISOString().slice(0, 10);

type Raw = {
  confidence: number;
  confidence_band: string;
  status: string;
  reviewed_at: string | null;
  listings: {
    id: string;
    marketplace: string;
    marketplace_id: string | null;
    title: string;
    seller: string | null;
    price: string | null;
    listing_url: string;
    scraped_at: string;
  };
  reference_assets: { asset_type: string; description: string } | null;
};

/** Listings for a nation scraped in [since, until), most confident first, one row per listing. */
export async function fetchReportRows(
  supabase: SupabaseClient,
  tribeId: string,
  since: Date,
  until: Date,
): Promise<ReportRow[]> {
  const all: Raw[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase
      .from("matches")
      .select(
        "confidence, confidence_band, status, reviewed_at, " +
          "listings!inner(id, marketplace, marketplace_id, title, seller, price, listing_url, scraped_at, tribe_id), " +
          "reference_assets(asset_type, description)",
      )
      .eq("listings.tribe_id", tribeId)
      .gte("listings.scraped_at", since.toISOString())
      .lt("listings.scraped_at", until.toISOString())
      .order("confidence", { ascending: false })
      .range(from, from + page - 1);
    if (error) throw new Error(`Could not read listings: ${error.message}`);
    all.push(...((data ?? []) as unknown as Raw[]));
    if (!data || data.length < page) break;
  }

  // One listing can match more than one reference asset; keep its best match.
  const seen = new Set<string>();
  const rows: ReportRow[] = [];
  for (const m of all) {
    const l = m.listings;
    if (seen.has(l.id)) continue;
    seen.add(l.id);
    rows.push({
      listingId: l.marketplace_id ?? l.id.slice(0, 8),
      detected: ymd(l.scraped_at),
      marketplace: MARKETPLACE[l.marketplace] ?? cap(l.marketplace) ?? "",
      title: l.title,
      url: l.listing_url,
      seller: l.seller,
      price: l.price,
      matchedAsset: m.reference_assets?.description ?? null,
      assetType: cap(m.reference_assets?.asset_type),
      score: Number(m.confidence),
      confidence: cap(m.confidence_band) ?? "",
      status: STATUS[m.status] ?? cap(m.status) ?? "",
      reviewedOn: m.reviewed_at ? ymd(m.reviewed_at) : null,
    });
  }
  // Chronological reads best in a meeting; the email lists the strongest first.
  return rows.sort((a, b) => a.detected.localeCompare(b.detected) || b.score - a.score);
}

/** OP-OSAGENATION-20261102 — stable per nation and period, so a re-run names the same file. */
export function reportId(nation: string, start: string): string {
  return `OP-${nation.replace(/[^a-z0-9]+/gi, "").toUpperCase().slice(0, 24)}-${start.replace(/-/g, "")}`;
}

export function periodOf(since: Date, until: Date) {
  // `until` is exclusive; the last day covered is the one before it.
  return { start: ymd(since), end: ymd(new Date(until.getTime() - 1)) };
}

// ---------------------------------------------------------------- email

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

type Mail = { nation: string; start: string; end: string; counts: ReportCounts; rows: ReportRow[]; siteUrl: string };

export function weeklySubject({ nation, counts }: Mail): string {
  const n = counts.total;
  return `Weekly report: ${n} new listing${n === 1 ? "" : "s"} using the ${nation} seal`;
}

function facts({ counts }: Mail): string[] {
  const m = Object.entries(counts.byMarketplace).filter(([, v]) => v > 0).map(([k, v]) => `${v} on ${k}`);
  return [
    `${counts.total} new listing${counts.total === 1 ? "" : "s"}${m.length ? ` (${m.join(", ")})` : ""}`,
    `${counts.byConfidence["High"] ?? 0} high confidence`,
    `${counts.byStatus["Awaiting review"] ?? 0} awaiting review`,
  ];
}

/** Plain text alongside the HTML — some tribal offices' clients strip HTML, and this gets forwarded. */
export function weeklyText(m: Mail): string {
  const dash = `${m.siteUrl}/dashboard?tribe=${encodeURIComponent(m.nation)}`;
  const top = [...m.rows].sort((a, b) => b.score - a.score).slice(0, 5);
  return [
    `Online Provenance weekly report for ${m.nation}`,
    `Period: ${m.start} to ${m.end}`,
    ``,
    ...facts(m).map((f) => `- ${f}`),
    ``,
    `The full list is attached as a spreadsheet for this week's meeting.`,
    ``,
    `Strongest matches:`,
    ...top.flatMap((r, i) => [`${i + 1}. ${r.title}`, `   ${r.marketplace}, ${Math.round(r.score * 100)}% match`, `   ${r.url}`]),
    ``,
    `Review and prepare a report: ${dash}`,
    ``,
    `These are automated matches, not confirmed infringements. Check each listing before filing.`,
    `You turned on the weekly report. Turn it off any time: ${m.siteUrl}/account`,
  ].join("\n");
}

/** Table layout and inline styles only — mail clients strip stylesheets. Same palette as the digest. */
export function weeklyHtml(m: Mail): string {
  const dash = `${m.siteUrl}/dashboard?tribe=${encodeURIComponent(m.nation)}`;
  const top = [...m.rows].sort((a, b) => b.score - a.score).slice(0, 5);
  const sans = "font-family:Helvetica,Arial,sans-serif;";
  const serif = "font-family:Georgia,'Times New Roman',serif;";
  const rows = top
    .map(
      (r) => `
      <tr><td style="padding:12px 0;border-bottom:1px solid #ede6da;">
        <a href="${esc(r.url)}" style="${serif}font-size:15px;line-height:1.4;color:#2b2622;text-decoration:none;">
          ${esc(r.title.slice(0, 110))}${r.title.length > 110 ? "&hellip;" : ""}</a>
        <div style="margin-top:4px;${sans}font-size:12px;color:#6b6259;">
          ${esc(r.marketplace)} &middot; ${Math.round(r.score * 100)}% match${r.price ? ` &middot; ${esc(r.price)}` : ""}
        </div>
      </td></tr>`,
    )
    .join("");

  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>${esc(weeklySubject(m))}</title></head>
<body style="margin:0;padding:0;background:#faf6ef;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf6ef;padding:28px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fdfbf7;border:1px solid #e2dacb;">
  <tr><td style="padding:14px 28px;background:#2b2622;">
    <span style="${serif}font-size:17px;color:#f7f1e7;">Online Provenance</span>
    <span style="float:right;${sans}font-size:12px;color:#b5ab9e;">Weekly report</span>
  </td></tr>
  <tr><td style="padding:28px 28px 0;">
    <h1 style="margin:0;${serif}font-size:24px;font-weight:normal;color:#2b2622;line-height:1.3;">
      ${m.counts.total} new listing${m.counts.total === 1 ? "" : "s"} using the ${esc(m.nation)} seal
    </h1>
    <p style="margin:10px 0 0;${sans}font-size:14px;line-height:1.6;color:#4a433c;">${esc(m.start)} to ${esc(m.end)}</p>
    <ul style="margin:14px 0 0;padding-left:18px;${sans}font-size:14px;line-height:1.7;color:#4a433c;">
      ${facts(m).map((f) => `<li>${esc(f)}</li>`).join("")}
    </ul>
    <p style="margin:14px 0 0;padding:12px 14px;background:#f5efe4;border:1px solid #e2dacb;${sans}font-size:13.5px;color:#4a433c;">
      The full list is attached as a spreadsheet, formatted to print for this week&rsquo;s meeting.
    </p>
  </td></tr>
  <tr><td style="padding:18px 28px 0;">
    <div style="${sans}font-size:12px;font-weight:bold;color:#6b6259;text-transform:uppercase;letter-spacing:.04em;">Strongest matches</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
  </td></tr>
  <tr><td style="padding:24px 28px 8px;">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#a8462c;">
      <a href="${dash}" style="display:inline-block;padding:14px 24px;${sans}font-size:15px;font-weight:bold;color:#fdf6ee;text-decoration:none;">Review and prepare a report</a>
    </td></tr></table>
    <p style="margin:14px 0 0;${sans}font-size:12.5px;line-height:1.6;color:#6b6259;">
      These are automated matches, not confirmed infringements. Whoever files a notice signs it
      under penalty of perjury, so check each listing first.
    </p>
  </td></tr>
  <tr><td style="padding:18px 28px 26px;border-top:1px solid #ede6da;">
    <p style="margin:0;${sans}font-size:11.5px;line-height:1.6;color:#8a8073;">
      You turned on the weekly report for ${esc(m.nation)}.
      <a href="${m.siteUrl}/account" style="color:#a8462c;">Turn it off</a> any time.
    </p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}
