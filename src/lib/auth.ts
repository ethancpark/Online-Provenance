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
  /** Opted in to the monthly digest. Off unless the person turned it on. */
  monthly_email: boolean;
  /** Nation to follow, for accounts that have none of their own (lab admins). */
  monthly_email_tribe_id: string | null;
};

/** The signed-in user's profile, or null. Suspended accounts resolve to null. */
export async function getProfile(): Promise<Profile | null> {
  const supabase = await getUserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const COLUMNS = "id,email,full_name,job_title,role,tribe_id,status";
  // monthly_email arrives with supabase/monthly-email.sql. Until that has been
  // run, asking for it errors and every signed-in person would look signed out,
  // so fall back to the columns that certainly exist. Deploy order stops being
  // load-bearing. Safe to simplify once the migration is applied everywhere.
  let { data } = await supabase
    .from("profiles")
    .select(`${COLUMNS},monthly_email,monthly_email_tribe_id`)
    .eq("id", user.id)
    .maybeSingle();
  if (!data) {
    ({ data } = await supabase.from("profiles").select(COLUMNS).eq("id", user.id).maybeSingle());
  }

  type Raw = Omit<Profile, "monthly_email" | "monthly_email_tribe_id"> & {
    monthly_email?: boolean;
    monthly_email_tribe_id?: string | null;
  };
  const raw = data as Raw | null;
  const profile: Profile | null = raw
    ? {
        ...raw,
        monthly_email: raw.monthly_email ?? false,
        monthly_email_tribe_id: raw.monthly_email_tribe_id ?? null,
      }
    : null;
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

/**
 * Profile shaped for the header nav and the reporting gate: the nation's
 * display name for people, and its id for the access check in `lib/access.ts`.
 */
export async function getSessionUser() {
  const p = await getProfile();
  if (!p) return null;
  let nation: string | null = null;
  if (p.tribe_id) {
    const supabase = await getUserClient();
    const { data } = await supabase.from("tribes").select("name").eq("id", p.tribe_id).maybeSingle();
    nation = (data as { name: string } | null)?.name ?? null;
  }
  return {
    full_name: p.full_name,
    email: p.email,
    role: p.role,
    tribe_id: p.tribe_id,
    nation,
    monthly_email: p.monthly_email,
  };
}
