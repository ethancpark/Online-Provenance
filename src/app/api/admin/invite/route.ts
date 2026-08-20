import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase";
import { requireLabAdmin, emailDomain, type UserRole } from "@/lib/auth";

type Body = { email: string; tribe_id: string; role?: UserRole; full_name?: string; job_title?: string };

/**
 * Invite a tribal user. Two gates, deliberately:
 *   1. the caller must be a lab_admin (checked against the DB, not a header)
 *   2. the invitee's email domain must be an official domain for that nation
 * Domain match alone is not authorisation — it proves the address belongs to
 * the nation, and the lab_admin check is the human approval on top.
 */
export async function POST(req: Request) {
  try {
    await requireLabAdmin();
  } catch {
    // Same response for "not signed in" and "not an admin" — don't confirm
    // to an attacker that an admin endpoint exists and they merely lack rights.
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await req.json()) as Body;
  const email = (body.email ?? "").trim().toLowerCase();
  const tribeId = body.tribe_id;
  const role: UserRole = body.role === "tribal_admin" ? "tribal_admin" : "tribal_staff";

  if (!email || !tribeId) {
    return NextResponse.json({ error: "email and tribe_id are required" }, { status: 400 });
  }
  const domain = emailDomain(email);
  if (!domain) {
    return NextResponse.json({ error: "That doesn't look like an email address." }, { status: 400 });
  }

  const admin = getServerClient();

  const { data: tribe } = await admin.from("tribes").select("id,name").eq("id", tribeId).maybeSingle();
  if (!tribe) return NextResponse.json({ error: "Unknown nation" }, { status: 400 });

  const { data: allowed } = await admin
    .from("tribe_domains")
    .select("domain")
    .eq("tribe_id", tribeId);

  const domains = (allowed ?? []).map((d: { domain: string }) => d.domain.toLowerCase());
  // Accept the exact domain or a subdomain of it (mail.cherokee.org).
  const ok = domains.some((d) => domain === d || domain.endsWith(`.${d}`));
  if (!ok) {
    return NextResponse.json(
      {
        error: `${domain} is not a registered domain for ${tribe.name}.`,
        registered: domains,
      },
      { status: 403 },
    );
  }

  // Supabase sends the invite and owns the credential from here on.
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { data: invited, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${site}/set-password`,
  });
  if (error || !invited?.user) {
    return NextResponse.json({ error: error?.message ?? "Invite failed" }, { status: 500 });
  }

  const { error: pErr } = await admin.from("profiles").insert({
    id: invited.user.id,
    email,
    full_name: body.full_name ?? null,
    job_title: body.job_title ?? null,
    role,
    tribe_id: tribeId,
    status: "invited",
  });
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, email, nation: tribe.name, role });
}
