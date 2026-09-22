import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    const admin = createAdminClient();

    const { error } = await admin
      .from("profiles")
      .update({ tier: "fan", stripe_subscription_id: null, pro_active_until: null })
      .eq("stripe_subscription_id", subscription.id);

    if (error) {
      console.error("Stripe webhook: failed to downgrade profile on subscription cancellation", error);
    }

    return NextResponse.json({ received: true });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const metadata = session.metadata ?? {};

    if (metadata.kind === "pro_membership") {
      const admin = createAdminClient();
      const userId = metadata.user_id;

      if (!userId) {
        console.error("Stripe webhook: pro_membership session missing user_id", session.id);
        return NextResponse.json({ received: true });
      }

      const { error } = await admin
        .from("profiles")
        .update({
          tier: "pro",
          stripe_customer_id: typeof session.customer === "string" ? session.customer : null,
          stripe_subscription_id: typeof session.subscription === "string" ? session.subscription : null,
        })
        .eq("id", userId);

      if (error) {
        console.error("Stripe webhook: failed to upgrade profile to pro", error);
        return NextResponse.json({ error: "Failed to activate membership" }, { status: 500 });
      }

      return NextResponse.json({ received: true });
    }

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

    const userId = metadata.user_id;
    const categoryId = metadata.category_id;
    const title = metadata.title;
    const sourceType = metadata.source_type;
    const sourceUrl = metadata.source_url || null;
    const crewName = metadata.crew_name || null;
    const teammates = metadata.teammates ? metadata.teammates.split("|").filter(Boolean) : null;
    const amountPaid = session.amount_total ?? 0;

    if (!userId || !categoryId || !title || !sourceType) {
      console.error("Stripe webhook: missing metadata on session", session.id);
      return NextResponse.json({ received: true });
    }

    const admin = createAdminClient();

    // Idempotency guard: Stripe may deliver the same event more than once.
    const { data: existing } = await admin
      .from("submissions")
      .select("id")
      .eq("stripe_checkout_session_id", session.id)
      .maybeSingle();

    if (!existing) {
      const { error } = await admin.from("submissions").insert({
        user_id: userId,
        category_id: categoryId,
        title,
        source_type: sourceType,
        source_url: sourceUrl,
        entry_type: "paid",
        entry_fee: amountPaid,
        stripe_checkout_session_id: session.id,
        crew_name: crewName,
        teammates: teammates,
      });

      if (error) {
        console.error("Stripe webhook: failed to insert submission", error);
        return NextResponse.json(
          { error: "Failed to record submission" },
          { status: 500 }
        );
      }
    }
  }

  return NextResponse.json({ received: true });
}
