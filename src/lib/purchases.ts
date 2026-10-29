import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe/server";

// What each Checkout "kind" is called in Admin, and which Admin page manages it.
const KINDS: Record<string, { label: string; href?: string }> = {
  live_vote_event: { label: "Live Vote event", href: "/admin/live-vote" },
  live_vote_pro: { label: "Live Vote Pro upgrade", href: "/admin/live-vote" },
  time_addon: { label: "Live Vote extra time", href: "/admin/live-vote" },
  super_votes_unlock: { label: "Super votes unlock", href: "/admin/live-vote" },
  super_votes: { label: "Super votes", href: "/admin/live-vote" },
  pred_bracket: { label: "Prediction game", href: "/admin/predictions" },
  pred_bracket_upgrade: { label: "Prediction game upgrade", href: "/admin/predictions" },
  paid_bout_entry: { label: "Paid bout entry", href: "/admin/paid-bouts" },
  sponsorship: { label: "Sponsorship", href: "/admin/sponsors" },
  event_sponsorship: { label: "Event sponsorship", href: "/admin/event-sponsorships" },
  org_license: { label: "School & League License", href: "/admin/licenses" },
  school_election: { label: "School election", href: "/admin/school-elections" },
  organizer_pro: { label: "Organizer Pro" },
  organizer_gold: { label: "Organizer Gold" },
};

export function describePurchase(metadata: Stripe.Metadata | null | undefined, mode: string | null | undefined) {
  const kind = metadata?.kind ?? "";
  const known = KINDS[kind];
  const label = known?.label ?? (kind ? kind.replace(/_/g, " ") : mode === "subscription" ? "Subscription" : "Other purchase");
  const detail = [metadata?.tier, metadata?.plan_name, metadata?.company_name].filter(Boolean).join(" · ");
  return { kind, label, detail, href: known?.href ?? null };
}

export type Purchase = {
  id: string;
  created: number;
  label: string;
  detail: string;
  href: string | null;
  buyerName: string | null;
  buyerEmail: string | null;
  amountCents: number;
  refundedCents: number;
  currency: string;
  receiptUrl: string | null;
  paymentIntentId: string | null;
  /** Subscriptions are refunded in Stripe, not here. */
  canRefund: boolean;
};

export type PurchaseList = { mode: "live" | "test"; purchases: Purchase[]; truncated: boolean; weekCount: number; weekNetCents: number };

/** Paid Checkout sessions from the last `days` days, newest first. Null if Stripe isn't set up. */
export async function loadPurchases(days = 90, max = 200): Promise<PurchaseList | null> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  const stripe = getStripe();
  const since = Math.floor(Date.now() / 1000) - days * 86400;
  const purchases: Purchase[] = [];
  let truncated = false;
  for await (const s of stripe.checkout.sessions.list({
    created: { gte: since },
    limit: 100,
    expand: ["data.payment_intent.latest_charge"],
  })) {
    if (s.payment_status !== "paid") continue;
    if (purchases.length >= max) { truncated = true; break; }
    const pi = s.payment_intent && typeof s.payment_intent !== "string" ? s.payment_intent : null;
    const charge = pi?.latest_charge && typeof pi.latest_charge !== "string" ? pi.latest_charge : null;
    const d = describePurchase(s.metadata, s.mode);
    purchases.push({
      id: s.id,
      created: s.created,
      label: d.label,
      detail: d.detail,
      href: d.href,
      buyerName: s.customer_details?.name ?? null,
      buyerEmail: s.customer_details?.email ?? s.metadata?.contact_email ?? null,
      amountCents: s.amount_total ?? 0,
      refundedCents: charge?.amount_refunded ?? 0,
      currency: s.currency ?? "usd",
      receiptUrl: charge?.receipt_url ?? null,
      paymentIntentId: pi?.id ?? null,
      canRefund: s.mode === "payment" && !!pi,
    });
  }
  const weekAgo = Math.floor(Date.now() / 1000) - 7 * 86400;
  const week = purchases.filter((p) => p.created >= weekAgo);
  return {
    mode: key.startsWith("sk_live") || key.startsWith("rk_live") ? "live" : "test",
    purchases,
    truncated,
    weekCount: week.length,
    weekNetCents: week.reduce((n, p) => n + p.amountCents - p.refundedCents, 0),
  };
}
