import { createClient } from "@/lib/supabase/server";
import UserManager from "@/components/UserManager";

export default async function AdminUsersPage() {
  const supabase = await createClient();

  const { data: profiles } = await supabase
    .from("profiles")
    .select(
      "id, username, tier, is_admin, is_suspended, points, wallet_balance, cash_available_cents, cash_lifetime_cents, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(500);

  return (
    <div>
      <h2 className="mb-1 text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
        Users
      </h2>
      <p className="mb-6 text-sm" style={{ color: "var(--text-faint)" }}>
        Search users, grant admin access, and suspend accounts that violate the rules.
      </p>
      <UserManager initialUsers={profiles ?? []} />
    </div>
  );
}
