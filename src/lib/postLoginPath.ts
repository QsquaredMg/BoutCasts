import type { SupabaseClient, User } from "@supabase/supabase-js";

// Where someone lands after signing in without a specific destination: their own profile.
// (Same rule the password form and the email-link callback use.)
export async function postLoginPath(supabase: SupabaseClient, user: User, next: string, hasNext: boolean): Promise<string> {
  if (hasNext) return next;
  const { data: profile } = await supabase.from("profiles").select("username").eq("id", user.id).maybeSingle();
  if (profile?.username) return `/profile/${encodeURIComponent(profile.username)}`;
  return next;
}
