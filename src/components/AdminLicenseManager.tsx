"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type OrgRow = {
  id: string;
  name: string;
  owner_username: string | null;
  seats: number;
  status: string;
  current_period_end: string | null;
  created_at: string;
};

export default function AdminLicenseManager({ orgs }: { orgs: OrgRow[] }) {
  const supabase = createClient();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(id: string, fn: string, args: Record<string, unknown>) {
    setBusy(id);
    setError(null);
    const { error: rpcError } = await supabase.rpc(fn, args);
    setBusy(null);
    if (rpcError) setError(rpcError.message);
    router.refresh();
  }

  if (orgs.length === 0) {
    return <p className="text-sm" style={{ color: "var(--text-faint)" }}>No licenses yet.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>}
      {orgs.map((o) => (
        <div key={o.id} className="bc-card flex flex-wrap items-center justify-between gap-3 p-3">
          <div>
            <p className="font-semibold">{o.name}</p>
            <p className="text-xs" style={{ color: "var(--text-faint)" }}>
              Owner {o.owner_username ?? "—"} · {o.status}
              {o.current_period_end && ` · until ${new Date(o.current_period_end).toLocaleDateString()}`} · {o.seats} seats
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              disabled={busy === o.id}
              onClick={() => {
                const m = prompt("Comp this license for how many months?", "12");
                if (m) run(o.id, "admin_comp_organization", { p_org_id: o.id, p_months: Number(m) });
              }}
              className="rounded-full border px-3 py-1.5 text-xs font-semibold"
              style={{ borderColor: "var(--border)" }}
            >
              Comp…
            </button>
            <button
              disabled={busy === o.id}
              onClick={() => {
                const s = prompt("Number of staff seats?", String(o.seats));
                if (s) run(o.id, "admin_set_org_seats", { p_org_id: o.id, p_seats: Number(s) });
              }}
              className="rounded-full border px-3 py-1.5 text-xs font-semibold"
              style={{ borderColor: "var(--border)" }}
            >
              Seats…
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
