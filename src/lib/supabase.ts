import { createClient } from "@supabase/supabase-js";
import { createBrowserClient, createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Browser client — carries the signed-in user's session via cookies. All
// queries made with it are subject to row-level security.
export function getBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

// Server client for Server Components / route handlers — reads the session
// from cookies and runs AS THE USER, so RLS applies. Use this for anything
// touching accounts or per-nation data.
export async function getUserClient() {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (list) => {
          try {
            list.forEach(({ name, value, options }) => store.set(name, value, options));
          } catch {
            // called from a Server Component — middleware refreshes instead
          }
        },
      },
    },
  );
}

// Service-role client — BYPASSES row-level security entirely.
// Only for the scan pipeline and admin actions that have already checked the
// caller is a lab_admin. Never expose to a Client Component, and never use it
// to serve data that RLS is supposed to be scoping.
export function getServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}
