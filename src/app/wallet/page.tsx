import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { WalletEvent } from "@/lib/types";
import ProMembershipCard from "@/components/ProMembershipCard";

const REASON_LABEL: Record<string, string> = {
  submission_rejected_refund: "Paid entry refund (credit)",
  referral_signup: "Referral bonus",
  pool_contribution: "Chipped in to a prize pool",
};

export default async function WalletPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) {
    redirect("/login");
  }

  const [{ data: profile }, { data: events }] = await Promise.all([
    supabase.from("profiles").select("wallet_balance, referral_code, tier").eq("id", user.id).maybeSingle(),
    supabase
      .from("wallet_events")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return (
    <div className="mx-auto max-w-lg px-5 py-8">
      <Link href="/" className="mb-4 inline-block text-sm font-semibold" style={{ color: "var(--blue)" }}>
        &larr; Back to matchups
      </Link>
      <h1 className="mb-1 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
        Wallet
      </h1>
      <p className="mb-6 text-sm" style={{ color: "var(--text-faint)" }}>
        BoutBucks earned from referrals and refunded paid entries.
      </p>

      <ProMembershipCard isPro={profile?.tier === "pro"} />

      <div
        className="mb-6 rounded-2xl p-5 text-center"
        style={{ background: "var(--gold-soft)" }}
      >
        <div className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--gold)" }}>
          Balance
        </div>
        <div
          className="mt-1 text-3xl font-bold"
          style={{ fontFamily: "var(--font-display)", color: "var(--gold)" }}
        >
          💰 {profile?.wallet_balance ?? 0} BB
        </div>
      </div>

      {profile?.referral_code && (
        <div className="bc-card mb-6 p-5">
          <h2 className="mb-1 text-sm font-bold" style={{ fontFamily: "var(--font-display)" }}>
            Invite friends, earn BoutBucks
          </h2>
          <p className="mb-3 text-xs" style={{ color: "var(--text-faint)" }}>
            Share your code — you get 100 BB (and 25 points) for every friend who signs up with it.
          </p>
          <div
            className="flex items-center justify-between rounded-xl border px-3.5 py-2.5"
            style={{ borderColor: "var(--border)", borderStyle: "dashed", background: "var(--surface-2)" }}
          >
            <span
              className="text-base font-bold tracking-wide"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {profile.referral_code}
            </span>
          </div>
        </div>
      )}

      <div className="bc-card overflow-hidden">
        <div
          className="px-4 py-3 text-sm font-bold"
          style={{ borderBottom: "1px solid var(--border)", fontFamily: "var(--font-display)" }}
        >
          Activity
        </div>
        {(events ?? []).length === 0 ? (
          <p className="p-4 text-sm" style={{ color: "var(--text-faint)" }}>
            No wallet activity yet.
          </p>
        ) : (
          (events as WalletEvent[]).map((e, i) => (
            <div
              key={e.id}
              className="flex items-center justify-between gap-3 px-4 py-3"
              style={{ borderTop: i > 0 ? "1px solid var(--border)" : "none" }}
            >
              <div>
                <div className="text-sm font-semibold">
                  {REASON_LABEL[e.reason] ?? e.reason}
                </div>
                <div className="text-xs" style={{ color: "var(--text-faint)" }}>
                  {new Date(e.created_at).toLocaleString()}
                </div>
              </div>
              <span
                className="text-sm font-bold tabular-nums"
                style={{ fontFamily: "var(--font-display)", color: e.amount >= 0 ? "var(--blue)" : "var(--red)" }}
              >
                {e.amount >= 0 ? "+" : ""}
                {e.amount} BB
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
