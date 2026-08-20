import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase";
import { emailDomain } from "@/lib/auth";

// An unthrottled signup endpoint lets anyone make this project email Tribal
// nation staff over and over. Limits are per address and per caller.
const MAX_PER_EMAIL_PER_HOUR = 3;
const MAX_PER_IP_PER_HOUR = 10;

/** Hash the address — we need to count callers, not identify them. */
function hashIp(req: Request): string | null {
  const raw =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null;
  if (!raw) return null;
  return createHash("sha256").update(`${raw}:online-provenance`).digest("hex").slice(0, 32);
}

type Body = { email: string; full_name?: string; job_title?: string };

/**
 * Self-service signup, gated on the email domain belonging to a Tribal nation.
 *
 * Public signup is intentionally DISABLED in Supabase: the anon key cannot
 * create users. Accounts are only ever created here, after the domain has been
 * checked server-side, using the service-role admin API. That way the flow is
 * self-serve for the user but the gate cannot be bypassed by calling Supabase
 * directly.
 *
 * New accounts land as `tribal_staff`, which can read their nation's data and
 * draft notices. Acting on a nation's behalf requires `tribal_admin`, which a
 * human grants — domain control proves employment, not authority to speak for
 * a sovereign government.
 */
export async function POST(req: Request) {
  const body = (await req.json()) as Body;
  const email = (body.email ?? "").trim().toLowerCase();

  const domain = emailDomain(email);
  if (!domain) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const admin = getServerClient();

  // Throttle before doing anything that sends mail.
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const ipHash = hashIp(req);

  const { count: byEmail } = await admin
    .from("signup_attempts")
    .select("id", { count: "exact", head: true })
    .eq("email", email)
    .gte("created_at", since);

  let byIp = 0;
  if (ipHash) {
    const { count } = await admin
      .from("signup_attempts")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gte("created_at", since);
    byIp = count ?? 0;
  }

  if ((byEmail ?? 0) >= MAX_PER_EMAIL_PER_HOUR || byIp >= MAX_PER_IP_PER_HOUR) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in an hour, or contact the 𐒻𐒼𐓂 Lab." },
      { status: 429 },
    );
  }

  await admin.from("signup_attempts").insert({ email, ip_hash: ipHash });

  // Match the domain, or any subdomain of it (mail.cherokee.org).
  const { data: domains } = await admin
    .from("tribe_domains")
    .select("domain, tribe_id, tribes(name)");

  const hit = (domains ?? []).find((d: { domain: string }) => {
    const dd = d.domain.toLowerCase();
    return domain === dd || domain.endsWith(`.${dd}`);
  }) as { domain: string; tribe_id: string; tribes: { name: string } | null } | undefined;

  if (!hit) {
    return NextResponse.json(
      {
        error:
          "That email domain isn't registered to a Tribal nation we monitor. " +
          "If your nation should have access, contact the 𐒻𐒼𐓂 Lab and we'll add it.",
      },
      { status: 403 },
    );
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { data: created, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${site}/set-password`,
  });

  if (error) {
    // Never confirm whether an address already has an account — that would
    // let anyone enumerate which tribal staff are registered.
    return NextResponse.json({
      ok: true,
      nation: hit.tribes?.name ?? null,
      message: "Check your email for a link to finish setting up your account.",
    });
  }

  if (created?.user) {
    await admin.from("profiles").insert({
      id: created.user.id,
      email,
      full_name: body.full_name ?? null,
      job_title: body.job_title ?? null,
      role: "tribal_staff",
      tribe_id: hit.tribe_id,
      status: "invited",
    });
  }

  return NextResponse.json({
    ok: true,
    nation: hit.tribes?.name ?? null,
    message: "Check your email for a link to finish setting up your account.",
  });
}
