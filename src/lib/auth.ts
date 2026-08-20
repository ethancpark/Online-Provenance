import { getUserClient } from "./supabase";

export type UserRole = "lab_admin" | "tribal_admin" | "tribal_staff";
export type AccountStatus = "invited" | "active" | "suspended";

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  job_title: string | null;
  role: UserRole;
  tribe_id: string | null;
  status: AccountStatus;
};

/** The signed-in user's profile, or null. Suspended accounts resolve to null. */
export async function getProfile(): Promise<Profile | null> {
  const supabase = await getUserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id,email,full_name,job_title,role,tribe_id,status")
    .eq("id", user.id)
    .maybeSingle();

  const profile = (data as Profile | null) ?? null;
  if (!profile || profile.status === "suspended") return null;
  return profile;
}

export async function requireProfile(): Promise<Profile> {
  const p = await getProfile();
  if (!p) throw new Error("Not authenticated");
  return p;
}

export async function requireLabAdmin(): Promise<Profile> {
  const p = await requireProfile();
  if (p.role !== "lab_admin") throw new Error("Forbidden");
  return p;
}

/**
 * Records an action in the nation's audit trail.
 *
 * This is the nation's own record of what its staff did — it is surfaced back
 * to them, not used to profile users. Keep the fields minimal: no IP, no user
 * agent, no page-by-page tracking.
 */
export async function logAction(
  action: string,
  opts: { targetType?: string; targetId?: string } = {},
): Promise<void> {
  const p = await getProfile();
  if (!p) return;
  const supabase = await getUserClient();
  await supabase.from("audit_log").insert({
    actor_id: p.id,
    tribe_id: p.tribe_id,
    action,
    target_type: opts.targetType ?? null,
    target_id: opts.targetId ?? null,
  });
}

/** Normalises an email to its domain, lowercased. */
export function emailDomain(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at < 0) return null;
  const d = email.slice(at + 1).trim().toLowerCase();
  return /^[a-z0-9][a-z0-9\-.]*\.[a-z]{2,}$/.test(d) ? d : null;
}
