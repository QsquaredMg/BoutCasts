import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/server";
import { createClient } from "@/lib/supabase/server";
import { BRACKET_PRICING, money } from "@/lib/predictions/pricing";

// Organizer pays to open a bracket ($10 for 8 days, $25 for the season),
// or $15 to upgrade an open 8-day bracket to a season bracket.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const bracketId = body?.bracketId;
  const mode = body?.mode === "upgrade" ? "upgrade" : "activate";
  if (!bracketId || typeof bracketId !== "string") return NextResponse.json({ error: "Missing bracketId" }, { status: 400 });

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const { data: bracket } = await supabase
    .from("pred_slates")
    .select("id, title, created_by, status, tier")
    .eq("id", bracketId)
    .maybeSingle();
  if (!bracket || bracket.created_by !== userData.user.id) return NextResponse.json({ error: "Bracket not found" }, { status: 404 });

  let cents: number;
  let name: string;
  let kind: string;
  let tier: string = bracket.tier;
  if (mode === "upgrade") {
    if (bracket.tier !== "weekly" || bracket.status === "pending") {
      return NextResponse.json({ error: "Only a paid 8-day bracket can be upgraded" }, { status: 400 });
    }
    cents = BRACKET_PRICING.upgradeCents;
    name = `Upgrade to season bracket (${money(cents)}) — ${bracket.title}`;
    kind = "pred_bracket_upgrade";
    tier = "season";
  } else {
    if (bracket.status !== "pending") return NextResponse.json({ error: "This bracket is already paid for" }, { status: 400 });
    const chosen = body?.tier === "season" ? "season" : body?.tier === "weekly" ? "weekly" : bracket.tier;
    tier = chosen;
    cents = chosen === "season" ? BRACKET_PRICING.seasonCents : BRACKET_PRICING.weeklyCents;
    name = chosen === "season" ? `Season bracket — ${bracket.title}` : `8-day bracket — ${bracket.title}`;
    kind = "pred_bracket";
  }

  const origin = req.headers.get("origin") ?? new URL(req.url).origin;
  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: userData.user.email ?? undefined,
    line_items: [{ price_data: { currency: "usd", product_data: { name }, unit_amount: cents }, quantity: 1 }],
    success_url: `${origin}/predictions/slate/${bracket.id}?checkout=success`,
    cancel_url: `${origin}/predictions/slate/${bracket.id}?checkout=cancelled`,
    metadata: { kind, bracket_id: bracket.id, tier },
  });
  return NextResponse.json({ url: session.url });
}
