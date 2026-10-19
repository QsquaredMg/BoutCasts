import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/server";
import { createClient } from "@/lib/supabase/server";
import { TIME_ADDON } from "@/lib/liveVoteEvents/tiers";

// Organizer buys extra days of voting for one live event ($25 per day).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const eventId = body?.eventId;
  const days = Number(body?.days);
  if (typeof eventId !== "string" || !Number.isInteger(days) || days < 1 || days > TIME_ADDON.maxDays) {
    return NextResponse.json({ error: `Choose between 1 and ${TIME_ADDON.maxDays} days.` }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const { data: event } = await supabase
    .from("live_vote_events")
    .select("id, organizer_id, title, status, closes_at")
    .eq("id", eventId)
    .maybeSingle();
  if (!event || event.organizer_id !== userData.user.id) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  if (event.status !== "live" || !event.closes_at) {
    return NextResponse.json({ error: "Time can be added while a vote with an end time is live." }, { status: 400 });
  }

  const origin = req.headers.get("origin") ?? new URL(req.url).origin;
  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card", "cashapp"],
      customer_email: userData.user.email ?? undefined,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: `${days} extra day${days === 1 ? "" : "s"} of voting`, description: event.title },
            unit_amount: TIME_ADDON.centsPerDay,
          },
          quantity: days,
        },
      ],
      success_url: `${origin}/live-vote/${event.id}?checkout=time_success`,
      cancel_url: `${origin}/live-vote/${event.id}?checkout=cancelled`,
      metadata: { kind: "time_addon", event_id: event.id, days: String(days) },
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("checkout/time-addon: Stripe error", err);
    return NextResponse.json({ error: "Checkout is unavailable right now. Please try again." }, { status: 502 });
  }
}
