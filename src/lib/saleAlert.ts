import type Stripe from "stripe";
import { describePurchase } from "@/lib/purchases";

const money = (cents: number, cur: string) => new Intl.NumberFormat("en-US", { style: "currency", currency: cur.toUpperCase() }).format(cents / 100);

/** Emails the team when a checkout is paid. Best effort: it never breaks the Stripe webhook. */
export async function sendSaleAlert(session: Stripe.Checkout.Session): Promise<void> {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey || session.payment_status !== "paid") return;
    const d = describePurchase(session.metadata, session.mode);
    const buyer = session.customer_details?.name || session.customer_details?.email || session.metadata?.contact_email || "Someone";
    const email = session.customer_details?.email ?? session.metadata?.contact_email ?? "no email";
    const amount = money(session.amount_total ?? 0, session.currency ?? "usd");
    const live = (process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_live");
    const to = process.env.SALE_ALERT_EMAIL || "info@boutcasts.com";
    const text = [
      `${buyer} bought: ${d.label}${d.detail ? ` (${d.detail})` : ""}`,
      `Amount: ${amount}`,
      `Buyer: ${buyer} <${email}>`,
      live ? "" : "TEST MODE: no real money moved.",
      "",
      "See it, and refund it if needed: https://www.boutcasts.com/admin/purchases",
    ].filter((l, i, a) => l !== "" || a[i - 1] !== "").join("\n");
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `sale-${session.id}` },
      signal: AbortSignal.timeout(5000),
      body: JSON.stringify({ from: "BoutCasts <info@boutcasts.com>", to: [to], subject: `New sale: ${amount} ${d.label}`, text }),
    });
  } catch (e) {
    console.error("sale alert failed", e instanceof Error ? e.message : e);
  }
}
