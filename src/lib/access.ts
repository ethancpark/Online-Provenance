/**
 * Who may prepare an infringement report — one source of truth for the gate.
 *
 * The reporting flow is not a generic app feature. The notice it produces is
 * signed under penalty of perjury and asserts authority to act for a sovereign
 * government, so it belongs to the nation whose mark is being used, and to
 * nobody else. A signed-in account is not sufficient on its own: the account
 * has to belong to the nation currently on screen.
 *
 * This is a product gate over data that is already public (listings and matches
 * are readable by anyone — that is deliberate, the record is public). The
 * security boundary for private data remains RLS in the database. What this
 * prevents is a stranger, or staff of a different nation, walking away with a
 * notice that speaks in that nation's name.
 */

export type Viewer = {
  role: "lab_admin" | "tribal_admin" | "tribal_staff";
  tribe_id: string | null;
  nation: string | null;
} | null;

export type ReportAccess =
  /** Cleared to prepare a notice. */
  | { allowed: true }
  /** No account at all. */
  | { allowed: false; reason: "signed_out" }
  /** Signed in, but the account is not attached to any nation. */
  | { allowed: false; reason: "no_nation" }
  /** Signed in for a different nation than the one being viewed. */
  | { allowed: false; reason: "other_nation"; userNation: string | null };

/**
 * `lab_admin` is unrestricted here, exactly as it is everywhere else in the app
 * (the /admin console, the invite and role APIs, and every RLS policy). It
 * operates the tool, supports nations through a first filing, and is the only
 * role that can test the flow end to end, so it sees the nation's view without
 * qualification. The notice still signs with the filer's own name and email —
 * this widens who may open the flow, never who the notice claims to be.
 *
 * Every other role is scoped to its own nation.
 */
export function reportAccess(viewer: Viewer, tribeId: string | null | undefined): ReportAccess {
  if (!viewer) return { allowed: false, reason: "signed_out" };
  if (viewer.role === "lab_admin") return { allowed: true };
  if (!viewer.tribe_id) return { allowed: false, reason: "no_nation" };
  if (!tribeId || viewer.tribe_id !== tribeId) {
    return { allowed: false, reason: "other_nation", userNation: viewer.nation };
  }
  return { allowed: true };
}
