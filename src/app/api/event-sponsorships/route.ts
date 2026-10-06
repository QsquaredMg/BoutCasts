import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PACKAGE_MAX_CENTS, PACKAGE_MIN_CENTS } from "@/lib/eventSponsorships";

// Organizer actions for sponsor packages and sponsorships on their own event.
// Authorization is explicit here (the writes use the service role).
async function loadOwned(eventId: string, userId: string) {
  const admin = createAdminClient();
  const { data: ev } = await admin.from("live_vote_events").select("id, organizer_id, status").eq("id", eventId).maybeSingle();
  const { data: profile } = await admin.from("profiles").select("is_admin").eq("id", userId).maybeSingle();
  if (!ev || (ev.organizer_id !== userId && profile?.is_admin !== true)) return null;
  return { admin, ev };
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const action = body?.action;

  if (action === "create_package") {
    const owned = await loadOwned(String(body.eventId ?? ""), user.id);
    if (!owned) return NextResponse.json({ error: "Not your event." }, { status: 403 });
    if (owned.ev.status === "closed") return NextResponse.json({ error: "This event has ended." }, { status: 400 });
    const { data: gold } = await owned.admin.rpc("organizer_is_gold", { p_user: owned.ev.organizer_id });
    if (gold !== true) return NextResponse.json({ error: "Selling sponsors needs the Organizer Gold plan." }, { status: 403 });
    const price = Math.round(Number(body.priceCents));
    if (!Number.isFinite(price) || price < PACKAGE_MIN_CENTS || price > PACKAGE_MAX_CENTS) {
      return NextResponse.json({ error: "Price must be between $25 and $10,000." }, { status: 400 });
    }
    const { error } = await owned.admin.from("event_sponsor_packages").insert({
      event_id: owned.ev.id,
      name: String(body.name ?? "").trim().slice(0, 60),
      level: ["title", "gold", "supporter"].includes(body.level) ? body.level : "supporter",
      price_cents: price,
      slots: Math.min(20, Math.max(1, Math.round(Number(body.slots) || 1))),
      perks: body.perks ? String(body.perks).trim().slice(0, 500) : null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (action === "toggle_package") {
    const admin = createAdminClient();
    const { data: pk } = await admin.from("event_sponsor_packages").select("id, event_id").eq("id", String(body.packageId ?? "")).maybeSingle();
    const owned = pk ? await loadOwned(pk.event_id, user.id) : null;
    if (!pk || !owned) return NextResponse.json({ error: "Not your package." }, { status: 403 });
    await admin.from("event_sponsor_packages").update({ active: body.active === true }).eq("id", pk.id);
    return NextResponse.json({ ok: true });
  }

  if (action === "approve") {
    // The RPC checks that the caller is the organizer (or an admin).
    const { error } = await supabase.rpc("approve_event_sponsorship", { p_id: String(body.id ?? "") });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (action === "decline") {
    const admin = createAdminClient();
    const { data: s } = await admin.from("event_sponsorships").select("id, event_id, status, stripe_payment_intent").eq("id", String(body.id ?? "")).maybeSingle();
    const owned = s ? await loadOwned(s.event_id, user.id) : null;
    if (!s || !owned) return NextResponse.json({ error: "Not your sponsorship." }, { status: 403 });
    if (s.status !== "pending") return NextResponse.json({ error: "This sponsorship has already been handled." }, { status: 400 });
    // Claim the decline first so a double click can't refund twice.
    const { data: claimed } = await admin.from("event_sponsorships").update({ status: "declined" }).eq("id", s.id).eq("status", "pending").select("id").maybeSingle();
    if (!claimed) return NextResponse.json({ error: "This sponsorship has already been handled." }, { status: 400 });
    if (s.stripe_payment_intent) {
      await getStripe().refunds.create({ payment_intent: s.stripe_payment_intent }, { idempotencyKey: `event-sponsor-decline-${s.id}` });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
