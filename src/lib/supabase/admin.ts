import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Server-side only. Uses the service role key, which bypasses Row Level
// Security. NEVER import this from client components, and never expose
// SUPABASE_SERVICE_ROLE_KEY to the browser (no NEXT_PUBLIC_ prefix).
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set"
    );
  }
  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
