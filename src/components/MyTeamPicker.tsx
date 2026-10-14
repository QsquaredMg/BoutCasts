"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import TeamPicker from "@/components/TeamPicker";

// Lets a signed-in player choose the school or team they rep on the rivalry board.
export default function MyTeamPicker({ current }: { current: { id: string; name: string; logo: string | null } | null }) {
  const [team, setTeam] = useState(current);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(id: string | null, next: typeof current) {
    setBusy(true);
    setError(null);
    const { error: err } = await createClient().rpc("set_my_team", { p_team: id });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setTeam(next);
  }

  return (
    <div className="bc-card mb-5 p-4">
      <div className="flex items-center gap-3">
        {team?.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={team.logo} alt="" width={40} height={40} className="h-10 w-10 shrink-0 object-contain" />
        ) : (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg" style={{ background: "var(--surface-2)" }} aria-hidden>🏫</span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-faint)" }}>Your team</p>
          <p className="truncate text-sm font-bold">{team ? team.name : "Pick the school or team you rep"}</p>
        </div>
        {team && (
          <button type="button" disabled={busy} onClick={() => save(null, null)} className="text-xs font-bold underline disabled:opacity-60" style={{ color: "var(--text-dim)" }}>
            Remove
          </button>
        )}
      </div>
      <div className="mt-3">
        <TeamPicker
          label={team ? "Change team" : "Pick your team"}
          onPick={(p) => save(p.teamId, { id: p.teamId, name: p.name, logo: p.logo || null })}
        />
      </div>
      {busy && <p className="text-xs" style={{ color: "var(--text-faint)" }}>Saving…</p>}
      {error && <p role="alert" className="text-xs font-semibold" style={{ color: "var(--red)" }}>{error}</p>}
      <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>Every point you earn counts for your team on the rivalry board.</p>
    </div>
  );
}
