import type { SupabaseClient, User } from "@supabase/supabase-js";

// Where someone lands after signing in without a specific destination: organizers on their
// events, everyone else on their own profile. (Same rule the password form uses.)
export async function postLoginPath(supabase: SupabaseClient, user: User, next: string, hasNext: boolean): Promise<string> {
  if (hasNext) return next;
  const [{ data: profile }, { count: events }] = await Promise.all([
    supabase.from("profiles").select("username").eq("id", user.id).maybeSingle(),
    supabase.from("live_vote_events").select("id", { count: "exact", head: true }).eq("organizer_id", user.id),
  ]);
  if ((events ?? 0) > 0) return "/live-vote";
  if (profile?.username) return `/profile/${encodeURIComponent(profile.username)}`;
  return next;
}
