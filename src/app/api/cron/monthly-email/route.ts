import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase";
import { buildDigest, digestHtml, digestSubject, digestText, windowStart } from "@/lib/monthlyDigest";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Sends the monthly digest to everyone who opted in. Triggered by the cron in
 * .github/workflows/monthly-email.yml on the 1st of each month.
 *
 * Guards worth keeping:
 *  - A shared secret in the Authorization header. This endpoint can send mail
 *    to every registered tribal staffer, so it must never be callable by a
 *    passer-by. It is not a Vercel Cron path, so nothing authenticates it for
 *    us.
 *  - Only `active` accounts with a nation. An invited-but-never-activated
 *    account has not confirmed its mailbox yet.
 *  - A nation with nothing new is skipped entirely. A monthly "nothing found"
 *    note is how people learn to ignore the message that matters.
 *  - monthly_email_last_sent_at only advances on a send that succeeded, so a
 *    failure retries next run instead of silently swallowing a month.
 *
 * `?dry=1` builds and reports everything without sending — use it to check
 * content and recipient counts before the first real run.
 */
type Subscriber = {
  id: string;
  email: string;
  tribe_id: string | null;
  monthly_email_tribe_id: string | null;
  monthly_email_last_sent_at: string | null;
  tribes: { name: string } | null;
};

async function sendViaResend(to: string, subject: string, html: string, text: string) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM ?? "Online Provenance <onboarding@resend.dev>";
  if (!key) throw new Error("RESEND_API_KEY is not set");

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html, text }),
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
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://onlineprovenance.vercel.app";
  const admin = getServerClient();

  // ?preview=<nation> renders the mail in the browser for any nation, whether
  // or not anyone has subscribed. Reviewing an email by reading its source is
  // how bad ones ship, and nothing here sends.
  if (preview) {
    const { data: tribe } = await admin
      .from("tribes")
      .select("id,name")
      .ilike("name", preview)
      .maybeSingle();
    if (!tribe) {
      return NextResponse.json({ error: `No nation matching "${preview}".` }, { status: 404 });
    }
    const since = windowStart(null);
    const digest = await buildDigest(admin, tribe.id, tribe.name, since);
    if (digest.newCount === 0) {
      return NextResponse.json(
        { error: `Nothing new for ${tribe.name} in the last 31 days — no email would be sent.` },
        { status: 404 },
      );
    }
    return new NextResponse(digestHtml(digest, site), {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  const { data, error } = await admin
    .from("profiles")
    .select("id,email,tribe_id,monthly_email_tribe_id,monthly_email_last_sent_at,tribes(name)")
    .eq("monthly_email", true)
    .eq("status", "active");

  if (error) {
    return NextResponse.json({ error: `Could not read subscribers: ${error.message}` }, { status: 500 });
  }

  const subscribers = (data ?? []) as unknown as Subscriber[];
  const now = new Date();
  const sent: string[] = [];
  const skipped: string[] = [];
  const failed: { email: string; reason: string }[] = [];

  for (const sub of subscribers) {
    // Own nation wins, so a tribal account cannot redirect its digest
    // elsewhere; the followed nation is only for accounts without one.
    const tribeId = sub.tribe_id ?? sub.monthly_email_tribe_id;
    if (!tribeId) {
      skipped.push(`${sub.email} (no nation set)`);
      continue;
    }
    try {
      const { data: t } = await admin.from("tribes").select("name").eq("id", tribeId).maybeSingle();
      const nation = sub.tribes?.name ?? t?.name ?? "your nation";
      const since = windowStart(sub.monthly_email_last_sent_at, now);
      const digest = await buildDigest(admin, tribeId, nation, since);

      if (digest.newCount === 0) {
        skipped.push(`${sub.email} (nothing new)`);
        continue;
      }
      if (!dry) {
        await sendViaResend(
          sub.email,
          digestSubject(digest),
          digestHtml(digest, site),
          digestText(digest, site),
        );
        // Only after the send actually succeeded.
        await admin
          .from("profiles")
          .update({ monthly_email_last_sent_at: now.toISOString() })
          .eq("id", sub.id);
      }
      sent.push(`${sub.email} (${digest.newCount} new)`);
    } catch (e) {
      failed.push({ email: sub.email, reason: e instanceof Error ? e.message : String(e) });
    }
  }

  return NextResponse.json(
    {
      ok: failed.length === 0,
      dryRun: dry,
      subscribers: subscribers.length,
      sent,
      skipped,
      failed,
    },
    { status: failed.length ? 207 : 200 },
  );
}
