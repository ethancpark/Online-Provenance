import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase";
import { buildReportWorkbook, countRows } from "@/lib/reportWorkbook";
import {
  WEEKLY_WINDOW_DAYS,
  fetchReportRows,
  periodOf,
  reportId,
  weeklyHtml,
  weeklySubject,
  weeklyText,
} from "@/lib/weeklyReport";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Emails each opted-in account its nation's weekly listings report, with the
 * spreadsheet attached for leadership's weekly meeting. Triggered by
 * .github/workflows/weekly-report.yml on Mondays, the day after the scan.
 *
 * Same guards as the monthly digest, for the same reasons:
 *  - Shared secret in the Authorization header; this can mail every
 *    registered tribal staffer and is not a Vercel Cron path.
 *  - Only `active` accounts with a nation (their own, or the one a lab admin
 *    follows on /account).
 *  - Nothing new means no email.
 *  - weekly_report_last_sent_at only advances after a send succeeds, so a
 *    failure is retried next run and a missed week leaves no gap.
 *
 * `?dry=1` builds everything and reports recipients without sending.
 * `?preview=<nation name>` returns that nation's last-7-days spreadsheet as a
 * download, whether or not anyone subscribes — check the file before the
 * first real run.
 */
type Subscriber = {
  id: string;
  email: string;
  tribe_id: string | null;
  monthly_email_tribe_id: string | null;
  weekly_report_last_sent_at: string | null;
};

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const DAY = 24 * 60 * 60 * 1000;

async function sendViaResend(
  to: string,
  subject: string,
  html: string,
  text: string,
  attachment: { filename: string; content: Buffer },
) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM ?? "Online Provenance <onboarding@resend.dev>";
  if (!key) throw new Error("RESEND_API_KEY is not set");

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to,
      subject,
      html,
      text,
      attachments: [{ filename: attachment.filename, content: attachment.content.toString("base64") }],
    }),
  });
  if (!resp.ok) throw new Error(`Resend ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
}

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = new URL(req.url).searchParams;
  const dry = params.get("dry") === "1";
  const preview = params.get("preview");
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://onlineprovenance.com";
  const admin = getServerClient();
  const now = new Date();

  if (preview) {
    const { data: tribe } = await admin.from("tribes").select("id,name").ilike("name", preview).maybeSingle();
    if (!tribe) {
      return NextResponse.json({ error: `No nation matching "${preview}".` }, { status: 404 });
    }
    const since = new Date(now.getTime() - WEEKLY_WINDOW_DAYS * DAY);
    const rows = await fetchReportRows(admin, tribe.id, since, now);
    const { start, end } = periodOf(since, now);
    const id = reportId(tribe.name, start);
    const file = await buildReportWorkbook(rows, { nation: tribe.name, reportId: id, periodStart: start, periodEnd: end });
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "content-type": XLSX,
        "content-disposition": `attachment; filename="${id}.xlsx"`,
        "cache-control": "no-store",
      },
    });
  }

  const { data, error } = await admin
    .from("profiles")
    // No tribes(name) embed: profiles has two foreign keys to tribes, which
    // PostgREST cannot disambiguate. Names are resolved per nation below.
    .select("id,email,tribe_id,monthly_email_tribe_id,weekly_report_last_sent_at")
    .eq("weekly_report", true)
    .eq("status", "active");

  if (error) {
    return NextResponse.json({ error: `Could not read subscribers: ${error.message}` }, { status: 500 });
  }

  const subscribers = (data ?? []) as unknown as Subscriber[];
  const names = new Map<string, string>();
  const sent: string[] = [];
  const skipped: string[] = [];
  const failed: { email: string; reason: string }[] = [];

  for (const sub of subscribers) {
    // Own nation wins, so a tribal account cannot redirect its report elsewhere.
    const tribeId = sub.tribe_id ?? sub.monthly_email_tribe_id;
    if (!tribeId) {
      skipped.push(`${sub.email} (no nation set)`);
      continue;
    }
    try {
      if (!names.has(tribeId)) {
        const { data: t } = await admin.from("tribes").select("name").eq("id", tribeId).maybeSingle();
        names.set(tribeId, t?.name ?? "your nation");
      }
      const nation = names.get(tribeId)!;
      const since = sub.weekly_report_last_sent_at
        ? new Date(sub.weekly_report_last_sent_at)
        : new Date(now.getTime() - WEEKLY_WINDOW_DAYS * DAY);
      const rows = await fetchReportRows(admin, tribeId, since, now);

      if (rows.length === 0) {
        skipped.push(`${sub.email} (nothing new)`);
        continue;
      }
      if (!dry) {
        const { start, end } = periodOf(since, now);
        const id = reportId(nation, start);
        const mail = { nation, start, end, counts: countRows(rows), rows, siteUrl: site };
        const file = await buildReportWorkbook(rows, { nation, reportId: id, periodStart: start, periodEnd: end });
        await sendViaResend(sub.email, weeklySubject(mail), weeklyHtml(mail), weeklyText(mail), {
          filename: `${id}.xlsx`,
          content: file,
        });
        // Only after the send actually succeeded.
        await admin.from("profiles").update({ weekly_report_last_sent_at: now.toISOString() }).eq("id", sub.id);
      }
      sent.push(`${sub.email} (${rows.length} new)`);
    } catch (e) {
      failed.push({ email: sub.email, reason: e instanceof Error ? e.message : String(e) });
    }
  }

  return NextResponse.json(
    { ok: failed.length === 0, dryRun: dry, subscribers: subscribers.length, sent, skipped, failed },
    { status: failed.length ? 207 : 200 },
  );
}
