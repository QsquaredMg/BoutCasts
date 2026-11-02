import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// Admin-only: give an organizer the Student Roles plan at no charge ("comp"), or take a comp plan away.
// Paid plans are never touched here: those are managed by Stripe.
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const { data: prof } = await supabase.from("profiles").select("is_admin").eq("id", u.user.id).maybeSingle();
  if (!prof?.is_admin) return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as { username?: string; userId?: string; action?: string } | null;
  const action = body?.action;
  if (action !== "grant" && action !== "revoke") return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const admin = createAdminClient();
  let userId = body?.userId && /^[0-9a-f-]{36}$/i.test(body.userId) ? body.userId : null;
  if (!userId) {
    const name = String(body?.username ?? "").trim().replace(/^@/, "");
    if (!name) return NextResponse.json({ error: "Enter a username." }, { status: 400 });
    const { data: p } = await admin.from("profiles").select("id").ilike("username", name).maybeSingle();
    if (!p) return NextResponse.json({ error: "No user with that username." }, { status: 404 });
    userId = p.id;
  }

  const { data: cur } = await admin.from("school_role_plans").select("status").eq("user_id", userId).maybeSingle();
  if (action === "grant") {
    if (cur && cur.status !== "comp" && ["active", "trialing", "past_due"].includes(cur.status)) {
      return NextResponse.json({ error: "This organizer already has a paid plan." }, { status: 409 });
    }
    const { error } = await admin.from("school_role_plans").upsert({ user_id: userId, status: "comp", updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) return NextResponse.json({ error: "Could not grant the plan." }, { status: 500 });
  } else {
    if (!cur || cur.status !== "comp") return NextResponse.json({ error: "Only free (comp) plans can be removed here." }, { status: 409 });
    const { error } = await admin.from("school_role_plans").update({ status: "canceled", updated_at: new Date().toISOString() }).eq("user_id", userId);
    if (error) return NextResponse.json({ error: "Could not remove the plan." }, { status: 500 });
  }
  console.log("admin role plan", { by: u.user.email ?? u.user.id, userId, action });
  return NextResponse.json({ ok: true });
}
