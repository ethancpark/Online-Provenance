import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { getServerClient } from "@/lib/supabase";
import AdminUsers, { type AdminRow } from "./AdminUsers";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const me = await getProfile();
  // Anyone who isn't a lab admin sees the same thing as a signed-out visitor.
  if (!me) redirect("/login?next=/admin");
  if (me.role !== "lab_admin") redirect("/dashboard");

  // Safe: we have already established the caller is a lab_admin.
  const admin = getServerClient();
  const { data } = await admin
    .from("profiles")
    .select("id,email,full_name,job_title,role,status,created_at,tribes(name)")
    .order("created_at", { ascending: false });

  const rows = (data ?? []).map((r) => {
    const t = r as unknown as { tribes: { name: string } | null };
    return { ...(r as unknown as AdminRow), nation: t.tribes?.name ?? null };
  }) as AdminRow[];

  return <AdminUsers rows={rows} />;
}
