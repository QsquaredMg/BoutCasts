import Link from "next/link";
import { loadPurchases } from "@/lib/purchases";
import RefundButton from "@/components/admin/RefundButton";

export const dynamic = "force-dynamic";

const money = (cents: number, cur = "usd") => new Intl.NumberFormat("en-US", { style: "currency", currency: cur.toUpperCase() }).format(cents / 100);
const when = (unix: number) => new Date(unix * 1000).toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

export default async function AdminPurchasesPage() {
  let data: Awaited<ReturnType<typeof loadPurchases>> = null;
  let failed = false;
  try {
    data = await loadPurchases();
  } catch {
    failed = true;
  }
  if (failed) return <Notice>Stripe could not be reached just now. Try again in a minute.</Notice>;
  if (!data) return <Notice>Add STRIPE_SECRET_KEY in Vercel to see purchases here.</Notice>;


  return (
    <div>
      <h2 className="mb-1 text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
        Purchases {data.mode === "test" && <span className="ml-2 rounded-full px-2 py-0.5 align-middle text-xs" style={{ background: "var(--surface-2)" }}>Test mode</span>}
      </h2>
      <p className="mb-4 text-sm" style={{ color: "var(--text-faint)" }}>
        Everything people paid for in the last 90 days, newest first. Last 7 days: {data.weekCount} {data.weekCount === 1 ? "sale" : "sales"}, {money(data.weekNetCents)} after refunds.
      </p>
      {data.purchases.length === 0 ? (
        <p className="bc-card p-4 text-sm" style={{ color: "var(--text-faint)" }}>No purchases yet.</p>
      ) : (
        <ul className="bc-card divide-y overflow-hidden" style={{ borderColor: "var(--border)" }}>
          {data.purchases.map((p) => {
            const remaining = p.amountCents - p.refundedCents;
            const buyer = p.buyerName || p.buyerEmail || "the buyer";
            return (
              <li key={p.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between" style={{ borderColor: "var(--border)" }}>
                <div className="min-w-0">
                  <p className="text-sm font-bold">
                    {p.label}
                    {p.detail ? <span className="font-semibold" style={{ color: "var(--text-dim)" }}> · {p.detail}</span> : null}
                  </p>
                  <p className="break-words text-xs" style={{ color: "var(--text-faint)" }}>
                    {when(p.created)} · {p.buyerName ? `${p.buyerName} · ` : ""}{p.buyerEmail ?? "no email"}
                  </p>
                  <p className="mt-1 flex flex-wrap gap-3 text-xs font-semibold">
                    {p.href && <Link href={p.href} className="underline" style={{ color: "var(--blue)" }}>Open in Admin</Link>}
                    {p.receiptUrl && <a href={p.receiptUrl} target="_blank" rel="noreferrer" className="underline" style={{ color: "var(--blue)" }}>Stripe receipt</a>}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                  <p className="text-sm font-bold tabular-nums">{money(p.amountCents, p.currency)}</p>
                  {p.refundedCents > 0 && (
                    <p className="text-xs font-bold" style={{ color: "var(--red)" }}>
                      {remaining <= 0 ? "Fully refunded" : `Refunded ${money(p.refundedCents, p.currency)}`}
                    </p>
                  )}
                  {p.canRefund && p.paymentIntentId && remaining > 0 ? (
                    <RefundButton paymentIntentId={p.paymentIntentId} remainingCents={remaining} buyer={buyer} what={p.label} />
                  ) : !p.canRefund ? (
                    <span className="text-xs" style={{ color: "var(--text-faint)" }}>Refund subscriptions in Stripe</span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {data.truncated && <p className="mt-2 text-xs" style={{ color: "var(--text-faint)" }}>Showing the newest 200. Older ones are in Stripe.</p>}
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return <p className="bc-card p-4 text-sm" style={{ color: "var(--text-dim)" }}>{children}</p>;
}
