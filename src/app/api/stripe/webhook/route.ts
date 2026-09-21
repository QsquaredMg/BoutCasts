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

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const metadata = session.metadata ?? {};

    const userId = metadata.user_id;
    const categoryId = metadata.category_id;
    const title = metadata.title;
    const sourceType = metadata.source_type;
    const sourceUrl = metadata.source_url || null;
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
