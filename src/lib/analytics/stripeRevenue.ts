import { getStripe } from "@/lib/stripe/server";

export type StripeRevenue = {
  mode: "live" | "test";
  total_cents: number;
  count: number;
  by_kind: { kind: string; cents: number; count: number }[];
  truncated: boolean;
};

const KIND_LABELS: Record<string, string> = {
  pred_bracket: "Prediction brackets",
  pred_bracket_upgrade: "Bracket upgrades",
};

/** Paid Checkout sessions in [from, to), grouped by what was sold. Null if Stripe isn't configured. */
export async function loadStripeRevenue(from: Date, to: Date): Promise<StripeRevenue | null> {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  try {
    const stripe = getStripe();
    const groups = new Map<string, { cents: number; count: number }>();
    let total = 0, count = 0, seen = 0, truncated = false;
    for await (const s of stripe.checkout.sessions.list({
      created: { gte: Math.floor(from.getTime() / 1000), lt: Math.floor(to.getTime() / 1000) },
      limit: 100,
    })) {
      if (++seen > 500) { truncated = true; break; }
      if (s.payment_status !== "paid") continue;
      const kind = KIND_LABELS[s.metadata?.kind ?? ""] ?? (s.metadata?.kind ? s.metadata.kind.replace(/_/g, " ") : s.mode === "subscription" ? "Subscriptions" : "Other");
      const g = groups.get(kind) ?? { cents: 0, count: 0 };
      g.cents += s.amount_total ?? 0;
      g.count += 1;
      groups.set(kind, g);
      total += s.amount_total ?? 0;
      count += 1;
    }
    return {
      mode: process.env.STRIPE_SECRET_KEY.startsWith("sk_live") || process.env.STRIPE_SECRET_KEY.startsWith("rk_live") ? "live" : "test",
      total_cents: total,
      count,
      by_kind: [...groups.entries()].map(([kind, v]) => ({ kind, ...v })).sort((a, b) => b.cents - a.cents),
      truncated,
    };
  } catch {
    return null;
  }
}
