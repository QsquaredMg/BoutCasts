import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/server";

const TIER_PRICE_CENTS: Record<string, number> = {
  standard: 29900,
  title: 99900,
};

const TIER_LABEL: Record<string, string> = {
  standard: "Standard sponsorship",
  title: "Title sponsorship",
};

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { companyName, websiteUrl, contactEmail, tier, message } = body ?? {};

  if (!companyName || !contactEmail || !tier || !TIER_PRICE_CENTS[tier]) {
    return NextResponse.json(
      { error: "Missing companyName, contactEmail, or a valid tier" },
      { status: 400 }
    );
  }

  const origin = req.headers.get("origin") ?? new URL(req.url).origin;
  const stripe = getStripe();

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: contactEmail,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `${TIER_LABEL[tier]} — ${companyName}`,
          },
          unit_amount: TIER_PRICE_CENTS[tier],
        },
        quantity: 1,
      },
    ],
    success_url: `${origin}/sponsor?checkout=success`,
    cancel_url: `${origin}/sponsor?checkout=cancelled`,
    metadata: {
      kind: "sponsorship",
      company_name: companyName,
      website_url: websiteUrl || "",
      contact_email: contactEmail,
      tier,
      message: (message || "").slice(0, 450),
    },
  });

  return NextResponse.json({ url: session.url });
}
