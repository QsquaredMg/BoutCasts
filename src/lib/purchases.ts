import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
  admin_custom: { label: "Custom payment link" },
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
  /** Set when the buyer paid but what they bought has not switched on. Needs a person to look. */
  attention: string | null;
  /** Set for a sale or free grant recorded by hand (not from Stripe). */
  manualId: string | null;
};

export type PurchaseList = {
  mode: "live" | "test";
  purchases: Purchase[];
  truncated: boolean;
  weekCount: number;
  weekNetCents: number;
  /** False when the manual-sales table hasn't been created yet. */
  manualReady: boolean;
};

/** Paid Checkout sessions from the last `days` days, newest first. Null if Stripe isn't set up. */
export async function loadPurchases(days = 90, max = 200): Promise<PurchaseList | null> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  const stripe = getStripe();
  const since = Math.floor(Date.now() / 1000) - days * 86400;
  const purchases: Purchase[] = [];
  let truncated = false;
  const checks: { table: "live_vote_events" | "school_elections"; id: string; index: number }[] = [];
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
      attention: null,
      manualId: null,
    });
    const m = s.metadata ?? {};
    if (m.kind === "live_vote_event" && m.event_id) checks.push({ table: "live_vote_events", id: m.event_id, index: purchases.length - 1 });
    if (m.kind === "school_election" && m.election_id) checks.push({ table: "school_elections", id: m.election_id, index: purchases.length - 1 });
  }
  await flagUnactivated(purchases, checks);
  const manual = await loadManualSales(since);
  purchases.push(...manual.rows);
  purchases.sort((a, b) => b.created - a.created);
  const weekAgo = Math.floor(Date.now() / 1000) - 7 * 86400;
  const week = purchases.filter((p) => p.created >= weekAgo);
  return {
    mode: key.startsWith("sk_live") || key.startsWith("rk_live") ? "live" : "test",
    purchases,
    truncated,
    weekCount: week.length,
    weekNetCents: week.reduce((n, p) => n + p.amountCents - p.refundedCents, 0),
    manualReady: manual.ready,
  };
}

/** Sales and free grants recorded by hand in Admin. Empty (and not ready) if the table hasn't been created. */
async function loadManualSales(sinceUnix: number): Promise<{ rows: Purchase[]; ready: boolean }> {
  try {
    const { data, error } = await createAdminClient()
      .from("manual_sales")
      .select("id, sold_at, kind, what, amount_cents, method, buyer_name, buyer_email, note")
      .is("voided_at", null)
      .gte("sold_at", new Date(sinceUnix * 1000).toISOString())
      .order("sold_at", { ascending: false })
      .limit(200);
    // Missing table: Postgres says 42P01, Supabase's data API says PGRST205.
    if (error) return { rows: [], ready: error.code !== "42P01" && error.code !== "PGRST205" };
    return {
      ready: true,
      rows: (data ?? []).map((r) => ({
        id: `manual-${r.id}`,
        created: Math.floor(new Date(r.sold_at).getTime() / 1000),
        label: r.what,
        detail: [r.kind === "comp" ? "Free grant" : `Recorded sale${r.method ? ` (${r.method})` : ""}`, r.note].filter(Boolean).join(" · "),
        href: null,
        buyerName: r.buyer_name,
        buyerEmail: r.buyer_email,
        amountCents: r.amount_cents,
        refundedCents: 0,
        currency: "usd",
        receiptUrl: null,
        paymentIntentId: null,
        canRefund: false,
        attention: null,
        manualId: r.id,
      })),
    };
  } catch (e) {
    console.error("purchases: could not load manual sales", e instanceof Error ? e.message : e);
    return { rows: [], ready: true };
  }
}

/** A paid event or election that is still a draft means the payment notification never switched it on. */
async function flagUnactivated(purchases: Purchase[], checks: { table: "live_vote_events" | "school_elections"; id: string; index: number }[]) {
  if (checks.length === 0) return;
  try {
    const admin = createAdminClient();
    for (const table of ["live_vote_events", "school_elections"] as const) {
      const mine = checks.filter((c) => c.table === table);
      if (mine.length === 0) continue;
      const { data } = await admin.from(table).select("id, status").in("id", mine.map((c) => c.id));
      const draft = new Set((data ?? []).filter((r) => r.status === "draft").map((r) => r.id));
      for (const c of mine) {
        const p = purchases[c.index];
        if (draft.has(c.id) && p.refundedCents < p.amountCents) {
          p.attention = "Paid, but this is still a draft. Resend the payment notification in Stripe (Developers, Webhooks), or turn it on from its Admin page.";
        }
      }
    }
  } catch (e) {
    console.error("purchases: could not check activation", e instanceof Error ? e.message : e);
  }
}
