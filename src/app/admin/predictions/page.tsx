import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import AdminPredictionsManager, { type AdminPredRow } from "@/components/AdminPredictionsManager";

export const metadata: Metadata = { title: "Admin predictions" };

export default async function AdminPredictionsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_predictions");
  return (
    <div>
      <h2 className="mb-1 text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Bout Predictions</h2>
      <p className="mb-5 text-sm" style={{ color: "var(--text-faint)" }}>
        Every game and bracket. Admins can start a game early, enter or correct final scores, end or reopen brackets, open an unpaid bracket for free, and create games with no daily limit.
      </p>
      {error && <p className="mb-4 text-sm" style={{ color: "var(--danger)" }}>{error.message}</p>}
      <AdminPredictionsManager rows={(data ?? []) as AdminPredRow[]} />
    </div>
  );
}
