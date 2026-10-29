import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// Admin-only: add a paid upgrade to a Live Vote event at no charge. Does the same thing the Stripe
// webhook does after a purchase, but with no payment, so nothing shows up in Purchases or revenue.
//   pro          Live Vote Pro
//   super_votes  unlock Super Votes
//   time         extra days on the clock (1 to 14)
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const { data: prof } = await supabase.from("profiles").select("is_admin").eq("id", u.user.id).maybeSingle();
  if (!prof?.is_admin) return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as { eventId?: string; upgrade?: string; days?: number } | null;
  const eventId = body?.eventId;
  if (!eventId || !/^[0-9a-f-]{36}$/i.test(eventId)) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const admin = createAdminClient();
  const { data: ev } = await admin.from("live_vote_events").select("id, title, pro_enabled, super_votes_enabled").eq("id", eventId).maybeSingle();
  if (!ev) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  // No checkout reference is written for Pro / Super Votes: that column marks an event as having a real
  // payment, which blocks deleting or purging it. The log line below is the record of the free grant.
  const ref = `admin-comp-${crypto.randomUUID()}`;
  let closesAt: string | null | undefined;

  if (body?.upgrade === "pro") {
    if (ev.pro_enabled) return NextResponse.json({ error: "This event already has Pro." }, { status: 409 });
    const { error } = await admin.from("live_vote_events").update({ pro_enabled: true }).eq("id", eventId);
    if (error) return fail(error);
  } else if (body?.upgrade === "super_votes") {
    if (ev.super_votes_enabled) return NextResponse.json({ error: "Super Votes is already on for this event." }, { status: 409 });
    const { error } = await admin.from("live_vote_events").update({ super_votes_enabled: true }).eq("id", eventId);
    if (error) return fail(error);
  } else if (body?.upgrade === "time") {
    const days = Number(body.days);
    if (!Number.isInteger(days) || days < 1 || days > 14) return NextResponse.json({ error: "Choose 1 to 14 days." }, { status: 400 });
    const { error } = await admin.rpc("apply_live_vote_time_addon", { p_event_id: eventId, p_days: days, p_session_id: ref });
    if (error) return fail(error);
    // The add-on function records the list price; this one was free.
    await admin.from("live_vote_time_addons").update({ amount_cents: 0 }).eq("stripe_checkout_session_id", ref);
    const { data: after } = await admin.from("live_vote_events").select("closes_at").eq("id", eventId).maybeSingle();
    closesAt = after?.closes_at ?? null;
  } else {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  console.log("admin comp upgrade", { by: u.user.email ?? u.user.id, eventId, upgrade: body.upgrade, ref });
  return NextResponse.json({ ok: true, closesAt });
}

function fail(e: { message: string }) {
  console.error("admin comp upgrade failed", e.message);
  return NextResponse.json({ error: "Could not add the upgrade." }, { status: 500 });
}
