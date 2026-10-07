"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useNow } from "@/lib/predictions/useNow";
import type { PredGame } from "@/lib/predictions/types";
import ZonedDateTimeInput from "@/components/ZonedDateTimeInput";
import { getZone } from "@/lib/time/pref";
import { wallToIso } from "@/lib/time/zones";

// Organizer tools: enter the final score, move the start time, or cancel.
export default function GameAdminPanel({ game, isAdmin = false }: { game: PredGame; isAdmin?: boolean }) {
  const router = useRouter();
  const [home, setHome] = useState(game.home_score ?? 0);
  const [away, setAway] = useState(game.away_score ?? 0);
  const [when, setWhen] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const now = useNow();
  const started = now !== 0 && new Date(game.starts_at).getTime() <= now;
  const final = game.status === "final";

  async function run(fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string) {
    setBusy(true);
    setMsg(null);
    const { error } = await fn();
    setBusy(false);
    setMsg(error ? error.message : ok);
    if (!error) router.refresh();
  }
  const sb = createClient();

  return (
    <div className="bc-card p-5">
      <h2 className="mb-1 text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>
        Organizer tools
      </h2>
      {game.status === "cancelled" ? (
        <p className="text-sm" style={{ color: "var(--text-dim)" }}>This game was cancelled.</p>
      ) : game.round !== null && !started ? (
        <>
          <p className="mb-3 text-sm" style={{ color: "var(--text-dim)" }}>Bracket games keep the schedule you set. You can enter this score once the game starts and the earlier round is final.</p>
          {isAdmin && (
            <button type="button" disabled={busy} onClick={() => run(() => sb.rpc("admin_start_pred_game", { p_game: game.id }), "Game started. Predictions are closed.")} className="rounded-full border px-4 py-2.5 text-sm font-semibold disabled:opacity-50" style={{ borderColor: "var(--border)" }}>
              Admin: start now
            </button>
          )}
        </>
      ) : started ? (
        <>
          <p className="mb-3 text-xs" style={{ color: "var(--text-faint)" }}>
            {final ? "Final score entered. You can correct it for 24 hours; everyone is re-graded." : "Enter the final score to grade every prediction and announce winners."}
          </p>
          <div className="mb-3 flex items-center gap-2">
            <label className="flex-1 text-xs font-bold">
              {game.home_name}
              <input type="number" min={0} max={999} value={home} onChange={(e) => setHome(Number(e.target.value))} className="mt-1 h-11 w-full rounded-xl border bg-transparent text-center text-xl font-black" style={{ borderColor: "var(--border)" }} />
            </label>
            <span className="pt-5 font-black">–</span>
            <label className="flex-1 text-xs font-bold">
              {game.away_name}
              <input type="number" min={0} max={999} value={away} onChange={(e) => setAway(Number(e.target.value))} className="mt-1 h-11 w-full rounded-xl border bg-transparent text-center text-xl font-black" style={{ borderColor: "var(--border)" }} />
            </label>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => sb.rpc("finalize_pred_game", { p_game: game.id, p_home: home, p_away: away }), "Final score saved and predictions graded.")}
            className="bc-btn-solid w-full rounded-full px-5 py-2.5 text-sm font-bold disabled:opacity-60"
          >
            {final ? "Correct final score" : "Submit final score"}
          </button>
        </>
      ) : (
        <>
          <p className="mb-3 text-xs" style={{ color: "var(--text-faint)" }}>The final score can be entered once the game starts. Until then you can reschedule or cancel.</p>
          <label className="mb-2 block text-xs font-bold">
            New start time
            <ZonedDateTimeInput value={when} onChange={setWhen} className="mt-1 h-11 w-full rounded-xl border bg-transparent px-3" style={{ borderColor: "var(--border)" }} />
          </label>
          {isAdmin && (
            <button type="button" disabled={busy} onClick={() => run(() => sb.rpc("admin_start_pred_game", { p_game: game.id }), "Game started. Predictions are closed.")} className="mb-2 w-full rounded-full border px-4 py-2.5 text-sm font-semibold disabled:opacity-50" style={{ borderColor: "var(--border)" }}>
              Admin: start now
            </button>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={busy || !when}
              onClick={() => run(() => sb.rpc("reschedule_pred_game", { p_game: game.id, p_starts_at: wallToIso(when, getZone()) }), "Start time updated.")}
              className="rounded-full border px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
              style={{ borderColor: "var(--border)" }}
            >
              Reschedule
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (window.confirm("Cancel this game? Predictions will not be scored.")) run(() => sb.rpc("cancel_pred_game", { p_game: game.id }), "Game cancelled.");
              }}
              className="rounded-full border px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
              style={{ borderColor: "var(--border)", color: "var(--red)" }}
            >
              Cancel game
            </button>
          </div>
        </>
      )}
      {msg && <p role="status" className="mt-3 text-sm font-semibold" style={{ color: "var(--text-dim)" }}>{msg}</p>}
    </div>
  );
}
