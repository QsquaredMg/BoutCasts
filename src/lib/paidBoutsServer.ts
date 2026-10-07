import { createClient } from "@/lib/supabase/server";

// Who is calling? Shared by the Paid Bouts API routes.
export async function getActor() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return { supabase, user: null, isAdmin: false };
  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
  return { supabase, user, isAdmin: profile?.is_admin === true };
}
