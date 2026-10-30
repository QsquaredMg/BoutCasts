import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** For admin-only API routes: the signed-in admin, or the error response to return. */
export async function requireAdmin(): Promise<{ email: string } | { response: NextResponse }> {
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { response: NextResponse.json({ error: "Sign in required" }, { status: 401 }) };
  const { data: prof } = await supabase.from("profiles").select("is_admin").eq("id", u.user.id).maybeSingle();
  if (!prof?.is_admin) return { response: NextResponse.json({ error: "Admins only" }, { status: 403 }) };
  return { email: u.user.email ?? u.user.id };
}
