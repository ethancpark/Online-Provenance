import { NextResponse } from "next/server";
import { getPublicClient, getServerClient } from "@/lib/supabase";
import { withinSendLimit, TOO_MANY } from "@/lib/rateLimit";

/**
 * Password reset. Without this, a member of staff who forgets their password
 * is locked out for good and someone has to fix it by hand in Supabase — a
 * worse obstacle than anything else in the sign-in flow.
 *
 * Two things are deliberate:
 *
 *  1. The response never says whether the address has an account. Telling the
 *     difference would turn this endpoint into a way to enumerate which Tribal
 *     nation staff are registered here.
 *  2. It is throttled on the same counters as signup, because it sends mail to
 *     the same inboxes. Supabase applies its own limits too; this one exists
 *     so the limit is ours and is visible in this repo.
 *
 * The reset mail is requested with the anon key — the same public auth
 * endpoint any client would use. The service role is only used for the attempt
 * counters, which RLS makes unreadable to anyone else.
 */
export async function POST(req: Request) {
  const body = (await req.json()) as { email?: string };
  const email = (body.email ?? "").trim().toLowerCase();

  if (!email.includes("@")) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  if (!(await withinSendLimit(getServerClient(), email, req))) {
    return NextResponse.json({ error: TOO_MANY }, { status: 429 });
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  await getPublicClient().auth.resetPasswordForEmail(email, {
    redirectTo: `${site}/set-password?mode=reset`,
  });

  // The same answer either way, including when Supabase itself errored.
  return NextResponse.json({
    ok: true,
    message:
      "If that address has an account, a link to set a new password is on its way. " +
      "It expires in 24 hours.",
  });
}
