import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { LIVE_VOTE_TIERS, isLiveVoteTier } from "@/lib/liveVoteEvents/tiers";
import type Stripe from "stripe";

export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json(
      { error: "Missing signature or webhook secret" },
      { status: 400 }
    );
  }

  const rawBody = await req.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${message}` },
      { status: 400 }
    );
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const metadata = session.metadata ?? {};

    if (metadata.kind === "sponsorship") {
      const admin = createAdminClient();

      const { data: existing } = await admin
        .from("sponsor_applications")
        .select("id")
        .eq("stripe_checkout_session_id", session.id)
        .maybeSingle();

      if (!existing) {
        const { error } = await admin.from("sponsor_applications").insert({
          company_name: metadata.company_name,
          website_url: metadata.website_url || null,
          contact_email: metadata.contact_email,
          tier: metadata.tier,
          plan_name: metadata.plan_name || null,
          message: metadata.message || null,
          stripe_checkout_session_id: session.id,
          stripe_subscription_id: typeof session.subscription === "string" ? session.subscription : null,
          amount_paid: session.amount_total ?? 0,
          opportunity_type: metadata.opportunity_type || null,
          category_id: metadata.category_id || null,
          banner_style: metadata.banner_style || null,
        });

        if (error) {
          console.error("Stripe webhook: failed to insert sponsor application", error);
          return NextResponse.json(
            { error: "Failed to record sponsor application" },
            { status: 500 }
          );
        }
      }

      return NextResponse.json({ received: true });
    }

    if (metadata.kind === "live_vote_event") {
      const admin = createAdminClient();
      const eventId = metadata.event_id;
      const tier = metadata.tier;

      if (!eventId || !isLiveVoteTier(tier)) {
        console.error("Stripe webhook: live_vote_event metadata missing/invalid", metadata);
        return NextResponse.json({ error: "Invalid live_vote_event metadata" }, { status: 400 });
      }

      const tierConfig = LIVE_VOTE_TIERS[tier];
      const startsAt = new Date();
      const closesAt = new Date(startsAt.getTime() + tierConfig.durationMs);

      // Guarded by status = 'draft' so a duplicate webhook delivery for the
      // same session is a no-op the second time through (idempotent).
      const { data: updated, error } = await admin
        .from("live_vote_events")
        .update({
          status: "live",
          starts_at: startsAt.toISOString(),
          closes_at: closesAt.toISOString(),
          stripe_checkout_session_id: session.id,
        })
        .eq("id", eventId)
        .eq("status", "draft")
        .select("id")
        .maybeSingle();

      if (error) {
        console.error("Stripe webhook: failed to activate live vote event", error);
        return NextResponse.json(
          { error: "Failed to activate live vote event" },
          { status: 500 }
        );
      }

      if (!updated) {
        // Either already activated by an earlier delivery of this event,
        // or the draft was deleted/changed — either way, nothing to do.
        console.warn("Stripe webhook: live_vote_event already processed or missing", eventId);
      }

      return NextResponse.json({ received: true });
    }
  }

  return NextResponse.json({ received: true });
}
