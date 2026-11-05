import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { reportAccess } from "@/lib/access";
import { getPublicClient } from "@/lib/supabase";
import { buildReportWorkbook, reportCsv } from "@/lib/reportWorkbook";
import { fetchReportRows, reportId } from "@/lib/weeklyReport";

export const dynamic = "force-dynamic";

/**
 * GET /api/report?tribe=<id>&from=YYYY-MM-DD&to=YYYY-MM-DD[&format=csv]
 *
 * The listings found for one nation in a date range, as the meeting
 * spreadsheet (or CSV). Dates are whole UTC days, both ends inclusive.
 *
 * Gated like the reporting flow (lib/access.ts): the nation's own staff, or
 * lab_admin. The rows are public already; the gate is about who gets a
 * document titled as that nation's report. Reads go through the anon client,
 * so RLS still decides what is visible.
 */
const YMD = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 366;

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const tribeId = params.get("tribe");
  const from = params.get("from");
  const to = params.get("to");

  if (!tribeId || !from || !to || !YMD.test(from) || !YMD.test(to)) {
    return NextResponse.json({ error: "tribe, from and to (YYYY-MM-DD) are required." }, { status: 400 });
  }
  const since = new Date(`${from}T00:00:00Z`);
  const until = new Date(`${to}T00:00:00Z`);
  until.setUTCDate(until.getUTCDate() + 1); // inclusive end day
  if (Number.isNaN(since.getTime()) || Number.isNaN(until.getTime()) || since >= until) {
    return NextResponse.json({ error: "from must be on or before to." }, { status: 400 });
  }
  if (until.getTime() - since.getTime() > MAX_DAYS * 24 * 60 * 60 * 1000) {
    return NextResponse.json({ error: "Choose a range of a year or less." }, { status: 400 });
  }

  const viewer = await getSessionUser();
  const access = reportAccess(viewer, tribeId);
  if (!access.allowed) {
    return NextResponse.json(
      { error: "Reports are available to this nation's staff once signed in." },
      { status: access.reason === "signed_out" ? 401 : 403 },
    );
  }

  const supabase = getPublicClient();
  const { data: tribe } = await supabase.from("tribes").select("name").eq("id", tribeId).maybeSingle();
  if (!tribe) return NextResponse.json({ error: "Nation not found." }, { status: 404 });

  const rows = await fetchReportRows(supabase, tribeId, since, until);
  const id = reportId(tribe.name, from);

  if (params.get("format") === "csv") {
    return new NextResponse(reportCsv(rows), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${id}.csv"`,
        "cache-control": "no-store",
      },
    });
  }

  const file = await buildReportWorkbook(rows, { nation: tribe.name, reportId: id, periodStart: from, periodEnd: to });
  return new NextResponse(new Uint8Array(file), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${id}.xlsx"`,
      "cache-control": "no-store",
    },
  });
}
