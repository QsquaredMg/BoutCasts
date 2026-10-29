import DiscountsManager from "@/components/admin/DiscountsManager";

export const dynamic = "force-dynamic";

export default function AdminDiscountsPage() {
  return (
    <div>
      <h2 className="mb-1 text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Discounts &amp; payment links</h2>
      <p className="mb-6 max-w-2xl text-sm" style={{ color: "var(--text-faint)" }}>
        Make promo codes buyers can enter at checkout, or create a one-off payment link at any price for a specific buyer.
        To discount something already bought, use the Refund button on{" "}
        <a href="/admin/purchases" className="underline">Purchases</a> and enter the amount to give back.
      </p>
      <DiscountsManager />
    </div>
  );
}
