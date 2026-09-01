import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase";
import { emailDomain } from "@/lib/auth";
import { withinSendLimit, TOO_MANY } from "@/lib/rateLimit";

type Body = { email: string; full_name?: string; job_title?: string };

/**
 * Named people who may sign up as lab staff, from an address that belongs to
 * no Tribal nation.
 *
 * Kept in the environment rather than the database or this file, for two
 * reasons. lab_admin can read every account on the system, so granting it
 * should require a deploy and not a click. And these are real people's
 * addresses, which do not belong in a public repository.
 *
 * Set LAB_ADMIN_EMAILS to a comma-separated list.
 */
function labAdminAllowlist(): string[] {
  return (process.env.LAB_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

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
  if (!(await withinSendLimit(admin, email, req))) {
    return NextResponse.json({ error: TOO_MANY }, { status: 429 });
  }

  // Lab staff first: they are named individually, so no domain can stand in
  // for the check. Everyone else has to belong to a nation.
  if (labAdminAllowlist().includes(email)) {
    const { data: created, error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/set-password`,
    });
    // A lab admin belongs to no nation — the profiles constraint requires
    // tribe_id to be null for this role.
    if (!error && created?.user) {
      await admin.from("profiles").insert({
        id: created.user.id,
        email,
        full_name: body.full_name ?? null,
        job_title: body.job_title ?? null,
        role: "lab_admin",
        tribe_id: null,
        status: "invited",
      });
    }
    // Same reply whether or not the account already existed.
    return NextResponse.json({
      ok: true,
      nation: null,
      message: "Check your email for a link to finish setting up your account.",
    });
  }

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
