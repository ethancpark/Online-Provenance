import ExcelJS from "exceljs";

/**
 * The listings report a nation's leadership takes into its weekly meeting.
 *
 * Two sheets, following the layout the Osage office was shown: a one-page
 * Summary that prints for the meeting, and a Listings sheet with one row per
 * listing. The summary counts are live formulas over the Listings sheet, so
 * when someone changes a row's Status during the meeting ("Report filed",
 * "Removed") the summary updates with it. That is also the only place filing
 * is recorded today — nothing in the app tracks it yet.
 *
 * Same ink/paper/clay palette as the site and the digest email, so the file
 * reads as coming from the same institution.
 */

export type ReportRow = {
  listingId: string; // ASIN for Amazon — what Amazon's form asks for
  detected: string; // YYYY-MM-DD
  marketplace: string; // display name
  title: string;
  url: string;
  seller: string | null;
  price: string | null; // kept as text: currencies vary
  matchedAsset: string | null;
  assetType: string | null; // Seal | Flag | Logo
  score: number; // 0–1
  confidence: string; // High | Medium | Low
  status: string; // see STATUSES
  reviewedOn: string | null;
};

export type ReportMeta = {
  nation: string;
  reportId: string;
  periodStart: string;
  periodEnd: string;
};

export const STATUSES = ["Awaiting review", "Confirmed", "Dismissed", "Report filed", "Removed"];
export const CONFIDENCES = ["High", "Medium", "Low"];
export const ASSET_TYPES = ["Seal", "Flag", "Logo"];
export const MARKETPLACES = ["Amazon", "Temu"];

const INK = "FF2B2622";
const ON_INK = "FFF7F1E7";
const CLAY = "FFA8462C";
const CREAM = "FFFDF6EE";
const PAPER_WARM = "FFF5EFE4";
const RULE = "FFE2DACB";
const MUTED = "FF6B6259";

const FIRST_ROW = 5;
const MIN_LAST_ROW = 211; // room to add rows by hand without breaking the formulas

const COLUMNS: { header: string; width: number }[] = [
  { header: "Listing ID", width: 14 },
  { header: "Date Detected", width: 13 },
  { header: "Marketplace", width: 12 },
  { header: "Listing Title", width: 46 },
  { header: "Listing Link", width: 13 },
  { header: "Seller", width: 20 },
  { header: "Price", width: 10 },
  { header: "Matched Asset", width: 26 },
  { header: "Asset Type", width: 10 },
  { header: "Match Score", width: 10 },
  { header: "Confidence", width: 11 },
  { header: "Status", width: 17 },
  { header: "Reviewed On", width: 12 },
  { header: "Meeting Notes", width: 40 },
];

const fill = (argb: string): ExcelJS.Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const line = { style: "thin" as const, color: { argb: RULE } };
const box: Partial<ExcelJS.Borders> = { top: line, bottom: line, left: line, right: line };
const SERIF = "Georgia";

export type ReportCounts = {
  total: number;
  byStatus: Record<string, number>;
  byMarketplace: Record<string, number>;
  byConfidence: Record<string, number>;
  byAssetType: Record<string, number>;
};

function tally(rows: ReportRow[], pick: (r: ReportRow) => string | null, labels: string[]) {
  const out: Record<string, number> = Object.fromEntries(labels.map((l) => [l, 0]));
  for (const r of rows) {
    const v = pick(r);
    if (v && v in out) out[v]++;
  }
  return out;
}

export function countRows(rows: ReportRow[]): ReportCounts {
  const markets = [...new Set([...MARKETPLACES, ...rows.map((r) => r.marketplace)])];
  return {
    total: rows.length,
    byStatus: tally(rows, (r) => r.status, STATUSES),
    byMarketplace: tally(rows, (r) => r.marketplace, markets),
    byConfidence: tally(rows, (r) => r.confidence, CONFIDENCES),
    byAssetType: tally(rows, (r) => r.assetType, ASSET_TYPES),
  };
}

export async function buildReportWorkbook(rows: ReportRow[], meta: ReportMeta): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Online Provenance";
  wb.created = new Date();
  wb.calcProperties.fullCalcOnLoad = true;

  const counts = countRows(rows);
  const lastRow = Math.max(MIN_LAST_ROW, FIRST_ROW + rows.length - 1);
  const range = (col: string) => `Listings!$${col}$${FIRST_ROW}:$${col}$${lastRow}`;

  summarySheet(wb.addWorksheet("Summary", { views: [{ showGridLines: false }] }), rows, meta, counts, range);
  listingsSheet(wb.addWorksheet("Listings", { views: [{ state: "frozen", ySplit: 4 }] }), rows, meta, lastRow);

  return Buffer.from(await wb.xlsx.writeBuffer());
}

function summarySheet(
  ws: ExcelJS.Worksheet,
  rows: ReportRow[],
  meta: ReportMeta,
  c: ReportCounts,
  range: (col: string) => string,
) {
  ws.columns = [{ width: 3 }, { width: 26 }, { width: 14 }, { width: 4 }, { width: 26 }, { width: 14 }];
  ws.pageSetup = { orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 1 };

  ws.mergeCells("B2:F2");
  ws.getCell("B2").value = "Online Provenance";
  ws.getCell("B2").font = { name: SERIF, size: 18, color: { argb: INK } };
  ws.mergeCells("B3:F3");
  ws.getCell("B3").value = "Marketplace Listings Report: Summary";
  ws.getCell("B3").font = { name: SERIF, size: 12, color: { argb: CLAY } };

  const info: [string, string][] = [
    ["Prepared for", meta.nation],
    ["Report ID", meta.reportId],
    ["Reporting period", `${meta.periodStart} to ${meta.periodEnd}`],
  ];
  info.forEach(([label, value], i) => {
    const r = 5 + i;
    ws.getCell(`B${r}`).value = label;
    ws.getCell(`B${r}`).font = { bold: true, color: { argb: INK } };
    ws.mergeCells(`C${r}:F${r}`);
    ws.getCell(`C${r}`).value = value;
  });

  const high = c.byConfidence["High"] ?? 0;
  const tiles: [string, string, string, number][] = [
    ["B", "Listings found", `COUNTA(${range("A")})`, c.total],
    ["C", "High confidence", `COUNTIF(${range("K")},"High")`, high],
    ["E", "Awaiting review", `COUNTIF(${range("L")},"Awaiting review")`, c.byStatus["Awaiting review"] ?? 0],
    ["F", "Report filed", `COUNTIF(${range("L")},"Report filed")`, c.byStatus["Report filed"] ?? 0],
  ];
  for (const [col, label, formula, result] of tiles) {
    const h = ws.getCell(`${col}9`);
    h.value = label;
    h.font = { bold: true, color: { argb: CREAM } };
    h.fill = fill(CLAY);
    h.alignment = { horizontal: "center", wrapText: true };
    const v = ws.getCell(`${col}10`);
    v.value = { formula, result };
    v.font = { name: SERIF, size: 16, color: { argb: INK } };
    v.fill = fill(PAPER_WARM);
    v.alignment = { horizontal: "center" };
  }
  ws.getRow(10).height = 28;

  // A small two-column count table; returns the row its Total landed on.
  const table = (top: number, col: "B" | "E", title: string, src: string, tallies: Record<string, number>) => {
    const n = col === "B" ? "C" : "F";
    for (const [cc, text] of [[col, title], [n, "Count"]] as const) {
      const cell = ws.getCell(`${cc}${top}`);
      cell.value = text;
      cell.font = { bold: true, color: { argb: ON_INK } };
      cell.fill = fill(INK);
    }
    const labels = Object.keys(tallies);
    labels.forEach((label, i) => {
      const r = top + 1 + i;
      ws.getCell(`${col}${r}`).value = label;
      ws.getCell(`${n}${r}`).value = { formula: `COUNTIF(${range(src)},${col}${r})`, result: tallies[label] };
      ws.getCell(`${col}${r}`).border = box;
      ws.getCell(`${n}${r}`).border = box;
    });
    const t = top + 1 + labels.length;
    ws.getCell(`${col}${t}`).value = "Total";
    ws.getCell(`${n}${t}`).value = {
      formula: `SUM(${n}${top + 1}:${n}${t - 1})`,
      result: labels.reduce((s, l) => s + tallies[l], 0),
    };
    for (const cc of [col, n]) {
      ws.getCell(`${cc}${t}`).font = { bold: true };
      ws.getCell(`${cc}${t}`).fill = fill(PAPER_WARM);
    }
    return t;
  };

  const a = table(13, "B", "By Status", "L", c.byStatus);
  const b = table(13, "E", "By Confidence", "K", c.byConfidence);
  const second = Math.max(a, b) + 2;
  const d = table(second, "B", "By Marketplace", "C", c.byMarketplace);
  const e = table(second, "E", "By Asset Type", "I", c.byAssetType);

  let r = Math.max(d, e) + 2;
  ws.mergeCells(`B${r}:F${r}`);
  ws.getCell(`B${r}`).value = "How to use this report";
  ws.getCell(`B${r}`).font = { name: SERIF, bold: true, color: { argb: INK } };
  const notes = [
    rows.length === 0
      ? "•  No new listings were found in this reporting period."
      : "•  Each row on the Listings tab is one marketplace listing that carries the nation's seal or flag.",
    "•  These are automated matches, not confirmed infringements. Whoever files a notice signs it under penalty of perjury, so check each listing first.",
    "•  Match Score is how closely the product photo matches the registered mark. Confidence also weighs the listing title.",
    "•  For Amazon, the Listing ID is the ASIN their report form asks for. Temu asks for the listing link instead.",
    "•  Change a row's Status as you act on it (Report filed, Removed); the counts above update automatically.",
  ];
  for (const text of notes) {
    r++;
    ws.mergeCells(`B${r}:F${r}`);
    ws.getCell(`B${r}`).value = text;
    ws.getCell(`B${r}`).alignment = { wrapText: true, vertical: "top" };
    ws.getCell(`B${r}`).font = { color: { argb: MUTED } };
    ws.getRow(r).height = text.length > 95 ? 30 : 16;
  }
}

function listingsSheet(ws: ExcelJS.Worksheet, rows: ReportRow[], meta: ReportMeta, lastRow: number) {
  ws.columns = COLUMNS.map((col) => ({ width: col.width }));
  // Landscape, one page wide, header repeated: ready to print for the meeting.
  ws.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: "4:4" };

  ws.mergeCells("A1:N1");
  ws.getCell("A1").value = "Online Provenance  |  Marketplace Listings Report";
  ws.getCell("A1").font = { name: SERIF, bold: true, size: 14, color: { argb: ON_INK } };
  ws.getCell("A1").fill = fill(INK);
  ws.mergeCells("A2:N2");
  ws.getCell("A2").value =
    `Prepared for: ${meta.nation}    Report ID: ${meta.reportId}    Period: ${meta.periodStart} to ${meta.periodEnd}`;
  ws.getCell("A2").font = { color: { argb: CREAM } };
  ws.getCell("A2").fill = fill(CLAY);

  const head = ws.getRow(4);
  COLUMNS.forEach((col, i) => {
    const cell = head.getCell(i + 1);
    cell.value = col.header;
    cell.font = { bold: true, color: { argb: ON_INK } };
    cell.fill = fill(INK);
    cell.alignment = { wrapText: true, vertical: "middle" };
  });
  head.height = 30;

  rows.forEach((r, i) => {
    const row = ws.getRow(FIRST_ROW + i);
    row.values = [
      r.listingId,
      r.detected,
      r.marketplace,
      r.title,
      { text: "Open listing", hyperlink: r.url },
      r.seller ?? "",
      r.price ?? "",
      r.matchedAsset ?? "",
      r.assetType ?? "",
      r.score,
      r.confidence,
      r.status,
      r.reviewedOn ?? "",
      "",
    ];
    row.getCell(5).font = { color: { argb: CLAY }, underline: true };
    row.getCell(10).numFmt = "0%";
    row.getCell(4).alignment = { wrapText: true, vertical: "top" };
    row.getCell(14).alignment = { wrapText: true, vertical: "top" };
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = box;
    });
  });

  if (rows.length) ws.autoFilter = { from: "A4", to: `N${FIRST_ROW + rows.length - 1}` };

  // exceljs supports data validation at runtime; its typings leave it out.
  const dv = (ws as unknown as { dataValidations: { add(ref: string, v: ExcelJS.DataValidation): void } })
    .dataValidations;
  const list = (vals: string[]) => [`"${vals.join(",")}"`];
  dv.add(`L${FIRST_ROW}:L${lastRow}`, { type: "list", allowBlank: true, formulae: list(STATUSES) });
  dv.add(`K${FIRST_ROW}:K${lastRow}`, { type: "list", allowBlank: true, formulae: list(CONFIDENCES) });
}

/** CSV of the same rows, for anyone who wants the raw data. */
export function reportCsv(rows: ReportRow[]): string {
  const cell = (v: unknown) => {
    if (v === null || v === undefined) return "";
    let s = String(v);
    // Scraped titles are untrusted: stop a spreadsheet treating one as a formula.
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [COLUMNS.slice(0, 13).map((c) => c.header).join(",")];
  for (const r of rows) {
    lines.push(
      [r.listingId, r.detected, r.marketplace, r.title, r.url, r.seller, r.price, r.matchedAsset,
        r.assetType, r.score, r.confidence, r.status, r.reviewedOn].map(cell).join(","),
    );
  }
  return "﻿" + lines.join("\r\n"); // BOM so Excel reads UTF-8 (nation names)
}
