import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { money } from "@/lib/eventSponsorships";

// A business buys one of an organizer's sponsor packages. BoutCasts collects the
// payment; the webhook records it (record_event_sponsorship), which re-checks
// the slot count under a lock and refunds if the package sold out meanwhile.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const packageId = typeof body?.packageId === "string" ? body.packageId : "";
  const company = String(body?.company ?? "").trim().slice(0, 120);
  const email = String(body?.email ?? "").trim().slice(0, 200);
  const link = String(body?.link ?? "").trim();
  const logo = String(body?.logo ?? "").trim();
  if (!packageId) return NextResponse.json({ error: "Missing package" }, { status: 400 });
  if (!company) return NextResponse.json({ error: "Enter your company name." }, { status: 400 });
  if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  for (const [label, url] of [["website", link], ["logo", logo]] as const) {
    if (url && (!/^https:\/\//i.test(url) || url.length > 400)) {
      return NextResponse.json({ error: `The ${label} link must start with https:// and be under 400 characters.` }, { status: 400 });
    }
  }
  if (body?.accepted !== true) return NextResponse.json({ error: "Please accept the sponsorship terms." }, { status: 400 });

  const admin = createAdminClient();
  const { data: pk } = await admin
    .from("event_sponsor_packages")
    .select("id, event_id, name, price_cents, slots, active")
    .eq("id", packageId)
    .maybeSingle();
  if (!pk || !pk.active) return NextResponse.json({ error: "This package isn't available." }, { status: 400 });
  const { data: ev } = await admin.from("live_vote_events").select("id, title, status, organizer_id").eq("id", pk.event_id).maybeSingle();
  if (!ev || ev.status === "closed") return NextResponse.json({ error: "This event has ended." }, { status: 400 });
  const { data: gold } = await admin.rpc("organizer_is_gold", { p_user: ev.organizer_id });
  if (gold !== true) return NextResponse.json({ error: "Sponsorships aren't open for this event." }, { status: 400 });
  const { count } = await admin
    .from("event_sponsorships")
    .select("id", { count: "exact", head: true })
    .eq("package_id", pk.id)
    .neq("status", "declined");
  if ((count ?? 0) >= pk.slots) return NextResponse.json({ error: "This package is sold out." }, { status: 400 });

  const origin = req.headers.get("origin") ?? new URL(req.url).origin;
  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: email,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `${pk.name}: ${ev.title}`,
            description: `Sponsorship of a BoutCasts Live Vote. Refunded in full if the organizer declines your logo. ${money(pk.price_cents)}.`,
          },
          unit_amount: pk.price_cents,
        },
        quantity: 1,
      },
    ],
    success_url: `${origin}/live-vote/${ev.id}/sponsor?checkout=success`,
    cancel_url: `${origin}/live-vote/${ev.id}/sponsor?checkout=cancelled`,
    metadata: { kind: "event_sponsorship", package_id: pk.id, company_name: company, contact_email: email, logo_url: logo, link_url: link },
  });
  return NextResponse.json({ url: session.url });
}
