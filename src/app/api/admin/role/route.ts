import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase";
import { requireLabAdmin, type UserRole } from "@/lib/auth";

type Body = { user_id: string; role?: UserRole; status?: "active" | "suspended" };

/** Change a user's role or status. Lab admins only. */
export async function POST(req: Request) {
  let me;
  try {
    me = await requireLabAdmin();
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { user_id, role, status } = (await req.json()) as Body;
  if (!user_id) return NextResponse.json({ error: "user_id required" }, { status: 400 });
  if (user_id === me.id && role && role !== "lab_admin") {
    // Don't let the last admin lock themselves out by accident.
    return NextResponse.json({ error: "You can't remove your own admin role." }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (role) patch.role = role;
  if (status) patch.status = status;
  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: "Nothing to change" }, { status: 400 });
  }

  const admin = getServerClient();
  const { error } = await admin.from("profiles").update(patch).eq("id", user_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
