import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for Client Components. Kept in its own module because
 * src/lib/supabase.ts imports next/headers, which cannot be pulled into a
 * client bundle.
 */
export function getBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
