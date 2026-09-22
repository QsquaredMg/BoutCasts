import { createClient } from "@/lib/supabase/server";
import CashPrizeAdmin from "@/components/CashPrizeAdmin";

export default async function CashAdminPage() {
  const supabase = await createClient();

  const [{ data: pendingEvents }, { data: pendingRedemptions }] = await Promise.all([
    supabase
      .from("cash_wallet_events")
      .select("*, profiles(username)")
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
    supabase
      .from("cash_redemptions")
      .select("*, profiles(username)")
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
  ]);

  return (
    <div>
      <h2 className="mb-1 text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
        Cash prizes
      </h2>
      <p className="mb-6 text-sm" style={{ color: "var(--text-faint)" }}>
        Award real-money prizes, release pending payouts, and fulfill redemption requests.
      </p>

      <CashPrizeAdmin
        initialPendingEvents={(pendingEvents ?? []) as never}
        initialPendingRedemptions={(pendingRedemptions ?? []) as never}
      />
    </div>
  );
}
