import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/server";
import { createClient } from "@/lib/supabase/server";

// $5.00 flat paid-entry fee, in cents.
const PAID_ENTRY_FEE_CENTS = 500;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const { title, categoryId, sourceType, sourceUrl, crewName, teammates } = body ?? {};

  if (!title || !categoryId || !sourceType) {
    return NextResponse.json(
      { error: "Missing title, categoryId, or sourceType" },
      { status: 400 }
    );
  }

  // Validate the category exists (cheap sanity check before sending anyone
  // to Stripe with a bogus draft).
  const { data: category } = await supabase
    .from("categories")
    .select("id")
    .eq("id", categoryId)
    .maybeSingle();

  if (!category) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  const origin = req.headers.get("origin") ?? new URL(req.url).origin;
  const stripe = getStripe();

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `Paid entry: ${title}`,
          },
          unit_amount: PAID_ENTRY_FEE_CENTS,
        },
        quantity: 1,
      },
    ],
    success_url: `${origin}/submit?paid=success`,
    cancel_url: `${origin}/submit?paid=cancelled`,
    metadata: {
      user_id: user.id,
      category_id: categoryId,
      title,
      source_type: sourceType,
      source_url: sourceUrl ?? "",
      crew_name: crewName ?? "",
      teammates: Array.isArray(teammates) ? teammates.join("|") : "",
    },
  });

  return NextResponse.json({ url: session.url });
}
