import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  const [
    { count: pendingSubmissions },
    { count: openReports },
    { count: liveBouts },
    { count: pendingSponsorApps },
    { count: pendingCashEvents },
    { count: pendingRedemptions },
    { count: totalUsers },
    { data: pools },
    { data: contributions },
  ] = await Promise.all([
    supabase.from("submissions").select("*", { count: "exact", head: true }).in("status", ["pending", "appealed"]),
    supabase.from("reports").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("bouts").select("*", { count: "exact", head: true }).eq("status", "live"),
    supabase.from("sponsor_applications").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("cash_wallet_events").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("cash_redemptions").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("prize_pools").select("id, goal_amount"),
    supabase.from("pool_contributions").select("pool_id, amount"),
  ]);

  const totalRaised = (contributions ?? []).reduce((sum, c) => sum + c.amount, 0);
  const totalGoal = (pools ?? []).reduce((sum, p) => sum + p.goal_amount, 0);

  const cards: { label: string; value: number | string; href: string }[] = [
    { label: "Pending submissions", value: pendingSubmissions ?? 0, href: "/admin/moderation" },
    { label: "Open reports", value: openReports ?? 0, href: "/admin/moderation" },
    { label: "Live bouts", value: liveBouts ?? 0, href: "/admin/bouts" },
    { label: "Pending sponsor applications", value: pendingSponsorApps ?? 0, href: "/admin/sponsors" },
    { label: "Pending cash payouts", value: pendingCashEvents ?? 0, href: "/admin/cash" },
    { label: "Pending redemptions", value: pendingRedemptions ?? 0, href: "/admin/cash" },
    { label: "Total users", value: totalUsers ?? 0, href: "/admin/users" },
    {
      label: "Prize pools raised / goal",
      value: `$${(totalRaised / 100).toFixed(0)} / $${(totalGoal / 100).toFixed(0)}`,
      href: "/admin/moderation",
    },
  ];

  return (
    <div>
      <h2 className="mb-1 text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
        Overview
      </h2>
      <p className="mb-6 text-sm" style={{ color: "var(--text-faint)" }}>
        Platform-wide snapshot. Click any card to jump to the relevant tool.
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="bc-card flex flex-col gap-1 p-4 transition-opacity hover:opacity-80"
          >
            <span className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
              {c.value}
            </span>
            <span className="text-xs" style={{ color: "var(--text-faint)" }}>
              {c.label}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
