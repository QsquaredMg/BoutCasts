import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { queueFinishedResults } from "@/lib/social/collect";

// Admin button: queue any new launch or result posts right now instead of waiting for the hourly cron.
export async function POST() {
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const { data: prof } = await supabase.from("profiles").select("is_admin").eq("id", u.user.id).maybeSingle();
  if (!prof?.is_admin) return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const errors: string[] = [];
  try {
    const added = await queueFinishedResults(createAdminClient(), errors);
    return NextResponse.json({ added, errors });
  } catch (e) {
    return NextResponse.json({ added: 0, errors: [...errors, (e as Error).message] });
  }
}
