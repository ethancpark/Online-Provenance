import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Throttle for the two endpoints that put mail in a real person's inbox:
 * signup invitations and password resets.
 *
 * Both send to Tribal nation staff, so an unthrottled endpoint is not a
 * nuisance — it is a way to use this project to spam the people it exists to
 * help. The counts are shared across both actions deliberately: what matters
 * is how much mail one address or one caller can cause in an hour, not which
 * button caused it.
 *
 * Attempts are recorded in `signup_attempts`, which has RLS on with no
 * policies, so only the service role can read or write it. Caller addresses
 * are stored as a salted hash and pruned after 24 hours: enough to count, not
 * enough to build a record of who tried to sign in.
 */
const MAX_PER_EMAIL_PER_HOUR = 3;
const MAX_PER_IP_PER_HOUR = 10;

/** Hash the address — we need to count callers, not identify them. */
export function hashIp(req: Request): string | null {
  const raw =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null;
  if (!raw) return null;
  return createHash("sha256").update(`${raw}:online-provenance`).digest("hex").slice(0, 32);
}

/**
 * Records this attempt and reports whether it is over the limit. Call before
 * doing anything that sends mail; a `false` return means send nothing.
 */
export async function withinSendLimit(
  admin: SupabaseClient,
  email: string,
  req: Request,
): Promise<boolean> {
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

  if ((byEmail ?? 0) >= MAX_PER_EMAIL_PER_HOUR || byIp >= MAX_PER_IP_PER_HOUR) return false;

  await admin.from("signup_attempts").insert({ email, ip_hash: ipHash });
  return true;
}

export const TOO_MANY =
  "Too many attempts. Try again in an hour, or contact the 𐒻𐒼𐓂 Lab.";
