import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CashPrizeAdmin from "@/components/CashPrizeAdmin";

export default async function CashAdminPage() {
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_admin) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-8">
        <p style={{ color: "var(--text-faint)" }}>You don&apos;t have access to this page.</p>
        <Link href="/matchups" className="text-sm font-semibold underline" style={{ color: "var(--red)" }}>
          Back to matchups
        </Link>
      </div>
    );
  }

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
    <div className="mx-auto max-w-3xl px-5 py-8">
      <Link href="/matchups" className="mb-4 inline-block text-sm font-semibold" style={{ color: "var(--blue)" }}>
        &larr; Back to matchups
      </Link>
      <h1 className="mb-1 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
        Cash prizes
      </h1>
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
