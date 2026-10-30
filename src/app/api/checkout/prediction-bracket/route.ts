import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BRACKET_PRICING, money, tourneyCents } from "@/lib/predictions/pricing";

// Organizer pays to open a pick'em ($10 for 8 days, $25 for the season), a private pool ($5 each),
// or a prediction bracket (by entrant limit). $15 upgrades an open 8-day slate to a season slate.
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
    .select("id, title, created_by, status, tier, entrant_cap")
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
    name = `Upgrade to season pick'em (${money(cents)}) — ${bracket.title}`;
    kind = "pred_bracket_upgrade";
    tier = "season";
  } else {
    if (bracket.status !== "pending") return NextResponse.json({ error: "This bracket is already paid for" }, { status: 400 });
    if (bracket.tier === "tourney") {
      // Tournament bracket: one price by entrant limit, always derived from the saved bracket (never from the request).
      const price = tourneyCents(bracket.entrant_cap);
      if (price == null) return NextResponse.json({ error: "This bracket has no valid entrant limit" }, { status: 400 });
      tier = "tourney";
      cents = price;
      name = `Tournament bracket (up to ${bracket.entrant_cap} entrants) — ${bracket.title}`;
    } else if (bracket.tier === "private") {
      // Closed invite-only game: $5 per game, paid by the creator. Invitees play free.
      const { count } = await supabase.from("pred_games").select("id", { count: "exact", head: true }).eq("slate_id", bracket.id);
      const games = Math.max(count ?? 1, 1);
      tier = "private";
      cents = BRACKET_PRICING.privateGameCents * games;
      name = `Private prediction game (${games} ${games === 1 ? "game" : "games"} × ${money(BRACKET_PRICING.privateGameCents)}) — ${bracket.title}`;
    } else {
      const chosen = body?.tier === "season" ? "season" : body?.tier === "weekly" ? "weekly" : bracket.tier;
      tier = chosen;
      cents = chosen === "season" ? BRACKET_PRICING.seasonCents : BRACKET_PRICING.weeklyCents;
      name = chosen === "season" ? `Season pick'em — ${bracket.title}` : `8-day pick'em — ${bracket.title}`;
    }
    kind = "pred_bracket";
  }

  const origin = req.headers.get("origin") ?? new URL(req.url).origin;

  // Platform admins open any pick'em, private pool or bracket with no charge. Same activation the
  // Stripe webhook runs after a payment, so nothing shows up in Purchases or revenue.
  const { data: me } = await supabase.from("profiles").select("is_admin").eq("id", userData.user.id).maybeSingle();
  if (me?.is_admin) {
    const comp = `admin-comp-${crypto.randomUUID()}`;
    const { error } =
      mode === "upgrade"
        ? await createAdminClient().rpc("upgrade_pred_bracket", { p_id: bracket.id, p_session: comp })
        : await createAdminClient().rpc("activate_pred_bracket", { p_id: bracket.id, p_session: comp, p_tier: tier });
    if (error) return NextResponse.json({ error: "Couldn't open it for free. Please try again." }, { status: 500 });
    return NextResponse.json({ url: `${origin}/predictions/slate/${bracket.id}?checkout=success`, free: true });
  }

  const session = await getStripe().checkout.sessions.create({
    allow_promotion_codes: true,
    mode: "payment",
    // Card also covers Apple Pay and Link; Cash App Pay is one-time payments in USD.
    payment_method_types: ["card", "cashapp"],
    customer_email: userData.user.email ?? undefined,
    line_items: [{ price_data: { currency: "usd", product_data: { name }, unit_amount: cents }, quantity: 1 }],
    success_url: `${origin}/predictions/slate/${bracket.id}?checkout=success`,
    cancel_url: `${origin}/predictions/slate/${bracket.id}?checkout=cancelled`,
    metadata: { kind, bracket_id: bracket.id, tier },
  });
  return NextResponse.json({ url: session.url });
}
