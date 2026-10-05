"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import PredTeam from "@/components/PredTeam";
import { pickFor } from "@/lib/predictions/scoring";
import { countdown, useNow } from "@/lib/predictions/useNow";
import type { PredGame } from "@/lib/predictions/types";

export default function PredictionForm({
  game,
  signedIn,
  existing,
}: {
  game: PredGame;
  signedIn: boolean;
  existing: { pred_home: number; pred_away: number } | null;
}) {
  const router = useRouter();
  const now = useNow();
  const [home, setHome] = useState(existing?.pred_home ?? 0);
  const [away, setAway] = useState(existing?.pred_away ?? 0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const startMs = new Date(game.starts_at).getTime();
  const closed = now !== 0 && now >= startMs;
  const pick = pickFor(home, away);

  function clamp(n: number) {
    return Math.max(0, Math.min(999, Number.isFinite(n) ? Math.floor(n) : 0));
  }
  function choose(side: "home" | "away" | "draw") {
    if (side === "home") {
      if (home <= away) setHome(away + 1);
    } else if (side === "away") {
      if (away <= home) setAway(home + 1);
    } else {
      setAway(home);
    }
  }

  async function save() {
    setMsg(null);
    if (pick === "draw" && !game.allow_draw) {
      setMsg({ ok: false, text: "This game can't end in a tie. Pick a winner." });
      return;
    }
    setBusy(true);
    const { error } = await createClient().rpc("submit_prediction", { p_game: game.id, p_home: home, p_away: away });
    setBusy(false);
    if (error) {
      setMsg({ ok: false, text: error.message });
      return;
    }
    setMsg({ ok: true, text: existing ? "Prediction updated." : "Locked in! Points are awarded when the game is final. You can change your pick until it starts." });
    router.refresh();
  }

  if (!signedIn) {
    return (
      <div className="bc-card p-5 text-center">
        <p className="mb-3 text-sm font-semibold">Sign in to make your prediction and earn points.</p>
        <Link href={`/login?next=${encodeURIComponent(`/predictions/${game.id}`)}`} className="bc-btn-solid inline-block rounded-full px-5 py-2 text-sm font-bold">
          Sign in to predict
        </Link>
      </div>
    );
  }

  const sides: { key: "home" | "away" | "draw"; label: string }[] = [
    { key: "home", label: game.home_name },
    ...(game.allow_draw ? [{ key: "draw" as const, label: "Draw" }] : []),
    { key: "away", label: game.away_name },
  ];

  return (
    <div className="bc-card p-5">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>
          {existing ? "Your prediction" : "Make your prediction"}
        </h2>
        <span className="text-xs font-bold" style={{ color: closed ? "var(--red)" : "var(--blue)" }}>
          {now === 0 ? "" : countdown(startMs - now)}
        </span>
      </div>
      <p className="mb-4 text-xs" style={{ color: "var(--text-faint)" }}>
        Pick the winner and the final score. You can change it until the game starts.
      </p>

      <div className="mb-4 grid gap-2" style={{ gridTemplateColumns: `repeat(${sides.length}, minmax(0, 1fr))` }}>
        {sides.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => choose(s.key)}
            aria-pressed={pick === s.key}
            disabled={closed}
            className="min-w-0 rounded-xl border px-2 py-3 text-sm font-bold disabled:opacity-50"
            style={{
              borderColor: pick === s.key ? "var(--blue)" : "var(--border)",
              background: pick === s.key ? "var(--blue)" : "transparent",
              color: pick === s.key ? "#fff" : "var(--text)",
            }}
          >
            <span className="block truncate">{s.label}</span>
            <span className="block text-[11px] font-semibold opacity-80">{s.key === "draw" ? "ends tied" : "to win"}</span>
          </button>
        ))}
      </div>

      <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-3">
        <ScoreInput label={game.home_name} logo={game.home_logo} value={home} onChange={(n) => setHome(clamp(n))} disabled={closed} />
        <span className="pb-3 text-xl font-black">–</span>
        <ScoreInput label={game.away_name} logo={game.away_logo} value={away} onChange={(n) => setAway(clamp(n))} disabled={closed} />
      </div>

      <button type="button" onClick={save} disabled={busy || closed} className="bc-btn-solid w-full rounded-full px-5 py-3 text-sm font-bold disabled:opacity-60">
        {closed ? "Picks closed" : busy ? "Saving…" : existing ? "Update prediction" : "Lock in prediction"}
      </button>
      {msg && (
        <p role="status" className="mt-3 text-sm font-semibold" style={{ color: msg.ok ? "var(--blue)" : "var(--red)" }}>
          {msg.text}
        </p>
      )}
    </div>
  );
}

function ScoreInput({ label, logo, value, onChange, disabled }: { label: string; logo: string | null; value: number; onChange: (n: number) => void; disabled: boolean }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-2">
      <PredTeam name={label} logo={logo} size={44} />
      <div className="flex items-center gap-1">
        <button type="button" disabled={disabled} onClick={() => onChange(value - 1)} aria-label={`Lower ${label} score`} className="h-10 w-10 rounded-full border text-lg font-bold disabled:opacity-50" style={{ borderColor: "var(--border)" }}>
          −
        </button>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={999}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={`${label} score`}
          className="h-12 w-16 rounded-xl border bg-transparent text-center text-2xl font-black tabular-nums"
          style={{ borderColor: "var(--border)" }}
        />
        <button type="button" disabled={disabled} onClick={() => onChange(value + 1)} aria-label={`Raise ${label} score`} className="h-10 w-10 rounded-full border text-lg font-bold disabled:opacity-50" style={{ borderColor: "var(--border)" }}>
          +
        </button>
      </div>
    </div>
  );
}
