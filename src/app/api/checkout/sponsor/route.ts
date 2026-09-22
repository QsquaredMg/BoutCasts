import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/server";

// Monthly sponsorship plans. Bronze/Silver map to the "standard" badge tier,
// Gold maps to the "title" badge tier (sponsors.tier only allows those two).
const PLANS: Record<string, { label: string; priceCents: number; badgeTier: "standard" | "title" }> = {
  bronze: { label: "Bronze", priceCents: 50000, badgeTier: "standard" },
  silver: { label: "Silver", priceCents: 150000, badgeTier: "standard" },
  gold: { label: "Gold", priceCents: 500000, badgeTier: "title" },
};

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { companyName, websiteUrl, contactEmail, plan, message, opportunityType, categoryId, bannerStyle } =
    body ?? {};

  if (!companyName || !contactEmail || !plan || !PLANS[plan]) {
    return NextResponse.json(
      { error: "Missing companyName, contactEmail, or a valid plan" },
      { status: 400 }
    );
  }

  const { label, priceCents, badgeTier } = PLANS[plan];
  const origin = req.headers.get("origin") ?? new URL(req.url).origin;
  const stripe = getStripe();

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    customer_email: contactEmail,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `${label} sponsorship — ${companyName}`,
          },
          unit_amount: priceCents,
          recurring: { interval: "month" },
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
      tier: badgeTier,
      plan_name: label,
      message: (message || "").slice(0, 450),
      opportunity_type: opportunityType || "",
      category_id: categoryId || "",
      banner_style: bannerStyle || "",
    },
  });

  return NextResponse.json({ url: session.url });
}
