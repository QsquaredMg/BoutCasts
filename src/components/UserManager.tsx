"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type AdminProfileRow = {
  id: string;
  username: string;
  tier: string;
  is_admin: boolean;
  is_suspended: boolean;
  points: number;
  wallet_balance: number;
  cash_available_cents: number;
  cash_lifetime_cents: number;
  created_at: string;
};

export default function UserManager({ initialUsers }: { initialUsers: AdminProfileRow[] }) {
  const supabase = createClient();
  const [users, setUsers] = useState(initialUsers);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => u.username.toLowerCase().includes(q));
  }, [users, query]);

  async function toggleAdmin(u: AdminProfileRow) {
    setError(null);
    setPendingId(u.id);
    const { error } = await supabase.rpc("admin_update_user", {
      p_user_id: u.id,
      p_is_admin: !u.is_admin,
      p_is_suspended: null,
    });
    setPendingId(null);
    if (error) {
      setError(error.message);
      return;
    }
    setUsers((prev) => prev.map((p) => (p.id === u.id ? { ...p, is_admin: !u.is_admin } : p)));
  }

  async function toggleSuspended(u: AdminProfileRow) {
    setError(null);
    setPendingId(u.id);
    const { error } = await supabase.rpc("admin_update_user", {
      p_user_id: u.id,
      p_is_admin: null,
      p_is_suspended: !u.is_suspended,
    });
    setPendingId(null);
    if (error) {
      setError(error.message);
      return;
    }
    setUsers((prev) => prev.map((p) => (p.id === u.id ? { ...p, is_suspended: !u.is_suspended } : p)));
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="rounded bg-red-100 p-3 text-sm text-red-700">{error}</p>}

      <input
        type="text"
        placeholder="Search by username..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="rounded border border-neutral-300 px-3 py-2 text-sm"
      />

      <p className="text-xs text-neutral-400">
        Showing {filtered.length} of {users.length} users
      </p>

      <div className="flex flex-col gap-2">
        {filtered.map((u) => (
          <div
            key={u.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white p-3"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{u.username}</span>
                <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-neutral-500">
                  {u.tier}
                </span>
                {u.is_admin && (
                  <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-blue-700">
                    Admin
                  </span>
                )}
                {u.is_suspended && (
                  <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-red-700">
                    Suspended
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-neutral-400">
                {u.points} pts · wallet {u.wallet_balance} · cash avail ${(u.cash_available_cents / 100).toFixed(2)} ·
                lifetime ${(u.cash_lifetime_cents / 100).toFixed(2)} · joined{" "}
                {new Date(u.created_at).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleAdmin(u)}
                disabled={pendingId === u.id}
                className="rounded border border-blue-300 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50"
              >
                {u.is_admin ? "Remove admin" : "Make admin"}
              </button>
              <button
                onClick={() => toggleSuspended(u)}
                disabled={pendingId === u.id}
                className="rounded border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                {u.is_suspended ? "Unsuspend" : "Suspend"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
