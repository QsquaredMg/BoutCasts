"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import LogoUploadField from "@/components/LogoUploadField";
import TeamPicker from "@/components/TeamPicker";
import { BRACKET_PRICING, money } from "@/lib/predictions/pricing";
import ZonedDateTimeInput from "@/components/ZonedDateTimeInput";
import { getZone } from "@/lib/time/pref";
import { wallToIso } from "@/lib/time/zones";

type Game = { home_name: string; home_logo: string; away_name: string; away_logo: string; starts_at: string; allow_draw: boolean };
const blankGame = (): Game => ({ home_name: "", home_logo: "", away_name: "", away_logo: "", starts_at: "", allow_draw: false });

// Closed, invite-only prediction game. $5 per game, paid by the creator; invitees play free.
// Private games skip the "this matchup already exists" check, so the same teams can be used again.
export default function PrivateGameBuilder() {
  const [title, setTitle] = useState("");
  const [games, setGames] = useState<Game[]>([blankGame()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setGame = (i: number, patch: Partial<Game>) => setGames((g) => g.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const total = BRACKET_PRICING.privateGameCents * games.length;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const iso = (v: string) => (v ? wallToIso(v, getZone()) : null);
      const { data, error: rpcErr } = await createClient().rpc("create_pred_private", {
        p_title: title,
        p_games: games.map((g) => ({ ...g, home_logo: g.home_logo || null, away_logo: g.away_logo || null, starts_at: iso(g.starts_at) })),
      });
      if (rpcErr) {
        setError(rpcErr.message);
        return;
      }
      const res = data as { ok: boolean; id?: string };
      const resp = await fetch("/api/checkout/prediction-bracket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bracketId: res.id }),
      });
      const out = await resp.json().catch(() => ({}));
      if (!resp.ok || !out.url) {
        setError(out.error ?? "We couldn't start checkout. Your private game is saved; open it from Bout Predictions to pay.");
        return;
      }
      window.location.assign(out.url);
    } finally {
      setBusy(false);
    }
  }

  const field = "mt-1 h-11 w-full rounded-xl border bg-transparent px-3 text-sm";
  const border = { borderColor: "var(--border)" };
  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <div className="bc-card p-4">
        <label className="block text-xs font-bold">
          Game name
          <input value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} maxLength={80} className={field} style={border} placeholder="e.g. Family Super Bowl Pool" />
        </label>
        <p className="mt-2 text-xs" style={{ color: "var(--text-faint)" }}>
          {money(BRACKET_PRICING.privateGameCents)} per game, paid by you. Invitees play free. After checkout you get a private link and a 6-letter code to share. It stays out of public lists and leaderboards.
        </p>
      </div>

      <fieldset className="bc-card p-4">
        <legend className="px-1 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>Games</legend>
        <div className="grid gap-3">
          {games.map((g, i) => (
            <div key={i} className="rounded-xl border p-3" style={border}>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold">Game {i + 1}</span>
                {games.length > 1 && (
                  <button type="button" onClick={() => setGames((a) => a.filter((_, j) => j !== i))} className="text-xs font-semibold" style={{ color: "var(--red)" }}>Remove</button>
                )}
              </div>
              <div className="grid gap-2">
                <TeamPicker label="Pick home team" onPick={(p) => setGame(i, { home_name: p.name, home_logo: p.logo })} />
                <input aria-label={`Game ${i + 1} home team`} placeholder="Home team" value={g.home_name} onChange={(e) => setGame(i, { home_name: e.target.value })} required maxLength={40} className={field} style={border} />
                <LogoUploadField value={g.home_logo} onChange={(url) => setGame(i, { home_logo: url })} folder="teams" compact />
                <TeamPicker label="Pick away team" onPick={(p) => setGame(i, { away_name: p.name, away_logo: p.logo })} />
                <input aria-label={`Game ${i + 1} away team`} placeholder="Away team" value={g.away_name} onChange={(e) => setGame(i, { away_name: e.target.value })} required maxLength={40} className={field} style={border} />
                <LogoUploadField value={g.away_logo} onChange={(url) => setGame(i, { away_logo: url })} folder="teams" compact />
                <label className="block text-xs font-bold">
                  Starts (your local time). Picks stay open for 15 minutes after this time.
                  <ZonedDateTimeInput value={g.starts_at} onChange={(v) => setGame(i, { starts_at: v })} required className={field} style={border} />
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold">
                  <input type="checkbox" checked={g.allow_draw} onChange={(e) => setGame(i, { allow_draw: e.target.checked })} className="h-4 w-4" /> Can end in a tie
                </label>
              </div>
            </div>
          ))}
        </div>
        {games.length < 20 && (
          <button type="button" onClick={() => setGames((a) => [...a, blankGame()])} className="mt-3 rounded-full border px-4 py-2 text-sm font-semibold" style={border}>+ Add another game · {money(BRACKET_PRICING.privateGameCents)}</button>
        )}
      </fieldset>

      {error && <p role="alert" className="text-sm font-semibold" style={{ color: "var(--red)" }}>{error}</p>}
      <button type="submit" disabled={busy} className="bc-btn-solid rounded-full px-5 py-3 text-sm font-bold disabled:opacity-60">
        {busy ? "Saving…" : `Continue to checkout · ${money(total)}`}
      </button>
    </form>
  );
}
