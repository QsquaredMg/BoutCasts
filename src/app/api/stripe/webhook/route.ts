import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { LIVE_VOTE_TIERS, SUPER_VOTES, isLiveVoteTier } from "@/lib/liveVoteEvents/tiers";
import type Stripe from "stripe";

// Mirror an Organizer Pro subscription into organizer_subscriptions.
// Billing periods live on the subscription item in this Stripe API version.
async function syncOrganizerSubscription(sub: Stripe.Subscription, fallbackUserId?: string | null) {
  const userId = sub.metadata?.user_id || fallbackUserId;
  const kind = sub.metadata?.kind;
  if (!userId || (kind && kind !== "organizer_pro" && kind !== "organizer_gold")) return;
  const item = sub.items?.data?.[0];
  const admin = createAdminClient();
  const { error } = await admin.from("organizer_subscriptions").upsert(
    {
      user_id: userId,
      stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
      stripe_subscription_id: sub.id,
      status: sub.status,
      plan: kind === "organizer_gold" ? "gold" : "pro",
      current_period_start: item?.current_period_start ? new Date(item.current_period_start * 1000).toISOString() : null,
      current_period_end: item?.current_period_end ? new Date(item.current_period_end * 1000).toISOString() : null,
      cancel_at_period_end: sub.cancel_at_period_end ?? false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) throw error;
}

// Mirror a school/league license subscription onto its organization row.
async function syncOrgLicense(sub: Stripe.Subscription, fallbackOrgId?: string | null) {
  const orgId = sub.metadata?.org_id || fallbackOrgId;
  if (!orgId) return;
  const item = sub.items?.data?.[0];
  const admin = createAdminClient();
  const { error } = await admin
    .from("organizations")
    .update({
      status: sub.status,
      stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
      stripe_subscription_id: sub.id,
      current_period_start: item?.current_period_start ? new Date(item.current_period_start * 1000).toISOString() : null,
      current_period_end: item?.current_period_end ? new Date(item.current_period_end * 1000).toISOString() : null,
      cancel_at_period_end: sub.cancel_at_period_end ?? false,
    })
    .eq("id", orgId)
    .neq("status", "comp");
  if (error) throw error;
}

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
          logo_url: metadata.logo_url || null,
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
          ...(metadata.pro === "1" ? { pro_enabled: true, pro_checkout_session_id: session.id } : {}),
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

    if (metadata.kind === "pred_bracket" || metadata.kind === "pred_bracket_upgrade") {
      const admin = createAdminClient();
      if (!metadata.bracket_id) {
        console.error("Stripe webhook: pred bracket metadata missing", metadata);
        return NextResponse.json({ error: "Invalid bracket metadata" }, { status: 400 });
      }
      // Both RPCs are idempotent: a repeated delivery changes nothing.
      const { error } =
        metadata.kind === "pred_bracket"
          ? await admin.rpc("activate_pred_bracket", {
              p_id: metadata.bracket_id,
              p_session: session.id,
              p_tier: metadata.tier === "season" ? "season" : "weekly",
            })
          : await admin.rpc("upgrade_pred_bracket", { p_id: metadata.bracket_id, p_session: session.id });
      if (error) {
        console.error("Stripe webhook: failed to open prediction bracket", error);
        return NextResponse.json({ error: "Failed to open bracket" }, { status: 500 });
      }
      return NextResponse.json({ received: true });
    }

    if (metadata.kind === "paid_bout_entry") {
      const admin = createAdminClient();
      const entryId = metadata.entry_id;
      const paymentIntent = typeof session.payment_intent === "string" ? session.payment_intent : null;
      if (!entryId || !paymentIntent) {
        console.error("Stripe webhook: paid bout entry metadata missing", metadata);
        return NextResponse.json({ error: "Invalid entry metadata" }, { status: 400 });
      }
      // Idempotent: a repeated delivery of an already-confirmed entry returns 'paid'.
      const { data: result, error } = await admin.rpc("paid_bout_confirm_entry", {
        p_entry: entryId,
        p_payment_intent: paymentIntent,
      });
      if (error) {
        console.error("Stripe webhook: failed to confirm paid bout entry", error);
        return NextResponse.json({ error: "Failed to confirm entry" }, { status: 500 });
      }
      if (result === "full" || result === "closed") {
        // The bout filled up or closed while they were paying: refund in full.
        await getStripe().refunds.create({ payment_intent: paymentIntent }, { idempotencyKey: `paid-bout-late-${entryId}` });
        await admin
          .from("paid_bout_entries")
          .update({ status: "refunded", refunded_at: new Date().toISOString() })
          .eq("id", entryId);
      }
      return NextResponse.json({ received: true });
    }

    if (metadata.kind === "live_vote_pro") {
      const admin = createAdminClient();
      const { error } = await admin
        .from("live_vote_events")
        .update({ pro_enabled: true, pro_checkout_session_id: session.id })
        .eq("id", metadata.event_id);
      if (error) {
        console.error("Stripe webhook: failed to enable Pro", error);
        return NextResponse.json({ error: "Failed to enable Pro" }, { status: 500 });
      }
      return NextResponse.json({ received: true });
    }

    if (metadata.kind === "super_votes_unlock") {
      const admin = createAdminClient();
      const { error } = await admin
        .from("live_vote_events")
        .update({ super_votes_enabled: true, super_votes_checkout_session_id: session.id })
        .eq("id", metadata.event_id);
      if (error) {
        console.error("Stripe webhook: failed to enable Super Votes", error);
        return NextResponse.json({ error: "Failed to enable Super Votes" }, { status: 500 });
      }
      return NextResponse.json({ received: true });
    }

    if (metadata.kind === "super_votes") {
      const amount = session.amount_total ?? 0;
      const quantity = Number(metadata.quantity);
      if (!metadata.event_id || !metadata.option_id || !Number.isInteger(quantity) || quantity <= 0) {
        console.error("Stripe webhook: bad super_votes metadata", metadata);
        return NextResponse.json({ error: "Invalid super_votes metadata" }, { status: 400 });
      }
      const admin = createAdminClient();
      // Unique on the checkout session, so a repeated delivery is a no-op.
      const { error } = await admin.from("live_vote_super_votes").upsert(
        {
          event_id: metadata.event_id,
          option_id: metadata.option_id,
          quantity,
          amount_cents: amount,
          organizer_share_cents: Math.floor(amount * SUPER_VOTES.organizerShare),
          stripe_checkout_session_id: session.id,
        },
        { onConflict: "stripe_checkout_session_id", ignoreDuplicates: true }
      );
      if (error) {
        console.error("Stripe webhook: failed to record Super Votes", error);
        return NextResponse.json({ error: "Failed to record Super Votes" }, { status: 500 });
      }
      return NextResponse.json({ received: true });
    }

    if (metadata.kind === "org_license" && typeof session.subscription === "string") {
      try {
        const sub = await stripe.subscriptions.retrieve(session.subscription);
        await syncOrgLicense(sub, metadata.org_id);
      } catch (err) {
        console.error("Stripe webhook: failed to record org license", err);
        return NextResponse.json({ error: "Failed to record license" }, { status: 500 });
      }
      return NextResponse.json({ received: true });
    }

    if (metadata.kind === "event_sponsorship") {
      const admin = createAdminClient();
      const paymentIntent = typeof session.payment_intent === "string" ? session.payment_intent : null;
      if (!metadata.package_id || !paymentIntent) {
        console.error("Stripe webhook: event sponsorship metadata missing", metadata);
        return NextResponse.json({ error: "Invalid sponsorship metadata" }, { status: 400 });
      }
      // Idempotent on the checkout session; locks the package so the last slot can't be sold twice.
      const { data: result, error } = await admin.rpc("record_event_sponsorship", {
        p_package: metadata.package_id,
        p_company: metadata.company_name ?? "Sponsor",
        p_email: session.customer_details?.email ?? metadata.contact_email ?? "",
        p_logo: metadata.logo_url ?? "",
        p_link: metadata.link_url ?? "",
        p_session: session.id,
        p_payment_intent: paymentIntent,
      });
      if (error) {
        console.error("Stripe webhook: failed to record event sponsorship", error);
        return NextResponse.json({ error: "Failed to record sponsorship" }, { status: 500 });
      }
      if (result === "full" || result === "closed") {
        await getStripe().refunds.create({ payment_intent: paymentIntent }, { idempotencyKey: `event-sponsor-late-${session.id}` });
      }
      return NextResponse.json({ received: true });
    }

    if ((metadata.kind === "organizer_pro" || metadata.kind === "organizer_gold") && typeof session.subscription === "string") {
      try {
        const sub = await stripe.subscriptions.retrieve(session.subscription);
        await syncOrganizerSubscription(sub, metadata.user_id ?? session.client_reference_id);
      } catch (err) {
        console.error("Stripe webhook: failed to record Organizer Pro", err);
        return NextResponse.json({ error: "Failed to record subscription" }, { status: 500 });
      }
      return NextResponse.json({ received: true });
    }
  }

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const sub = event.data.object as Stripe.Subscription;
    if (sub.metadata?.kind === "org_license") {
      try {
        await syncOrgLicense(sub);
      } catch (err) {
        console.error("Stripe webhook: failed to sync org license", err);
        return NextResponse.json({ error: "Failed to sync license" }, { status: 500 });
      }
    }
    if (sub.metadata?.kind === "organizer_pro" || sub.metadata?.kind === "organizer_gold") {
      try {
        await syncOrganizerSubscription(sub);
      } catch (err) {
        console.error("Stripe webhook: failed to sync Organizer Pro", err);
        return NextResponse.json({ error: "Failed to sync subscription" }, { status: 500 });
      }
    }
    return NextResponse.json({ received: true });
  }

  return NextResponse.json({ received: true });
}
