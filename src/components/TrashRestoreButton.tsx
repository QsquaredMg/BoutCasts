"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function TrashRestoreButton({ boutId }: { boutId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function restore() {
    setBusy(true);
    setError(null);
    const { error: e } = await createClient().rpc("admin_restore_bout", { p_bout_id: boutId });
    setBusy(false);
    if (e) return setError(e.message);
    router.refresh();
  }

  async function purge() {
    if (!confirm("Delete this bout forever? Its votes and comments are erased too. This can't be undone.")) return;
    setBusy(true);
    setError(null);
    const { error: e } = await createClient().rpc("admin_purge_bout", { p_bout_id: boutId });
    setBusy(false);
    if (e) return setError(e.message);
    router.refresh();
  }

  return (
    <span className="flex flex-col items-end gap-1">
      <button type="button" onClick={restore} disabled={busy} className="bc-btn-solid rounded-full px-4 py-1.5 text-xs font-bold disabled:opacity-60">
        {busy ? "Working…" : "↩︎ Restore"}
      </button>
      <button type="button" onClick={purge} disabled={busy} className="text-[11px] font-semibold disabled:opacity-60" style={{ color: "var(--danger)" }}>
        Delete forever
      </button>
      {error && (
        <span className="text-[11px]" style={{ color: "var(--danger)" }}>
          {error}
        </span>
      )}
    </span>
  );
}
