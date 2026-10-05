"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import LogoUploadField from "@/components/LogoUploadField";
import { BRACKET_PRICING, money, roundLabel } from "@/lib/predictions/pricing";

type Team = { name: string; logo: string };
type Game = { home_name: string; home_logo: string; away_name: string; away_logo: string; starts_at: string; allow_draw: boolean };

const blankTeam = (): Team => ({ name: "", logo: "" });
const blankGame = (): Game => ({ home_name: "", home_logo: "", away_name: "", away_logo: "", starts_at: "", allow_draw: false });
const rounds = (n: number) => Math.round(Math.log2(n));

export default function PredBracketBuilder() {
  const [kind, setKind] = useState<"elimination" | "slate">("elimination");
  const [tier, setTier] = useState<"weekly" | "season">("weekly");
  const [title, setTitle] = useState("");
  const [size, setSize] = useState(8);
  const [teams, setTeams] = useState<Team[]>(() => Array.from({ length: 8 }, blankTeam));
  const [starts, setStarts] = useState<string[]>(["", "", ""]);
  const [games, setGames] = useState<Game[]>(() => [blankGame(), blankGame()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dup, setDup] = useState<{ id: string; index?: number } | null>(null);

  function changeSize(n: number) {
    setSize(n);
    setTeams((t) => Array.from({ length: n }, (_, i) => t[i] ?? blankTeam()));
    setStarts((s) => Array.from({ length: rounds(n) }, (_, i) => s[i] ?? ""));
  }
  const setTeam = (i: number, patch: Partial<Team>) => setTeams((t) => t.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const setGame = (i: number, patch: Partial<Game>) => setGames((g) => g.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDup(null);
    setBusy(true);
    try {
      const sb = createClient();
      const iso = (v: string) => (v ? new Date(v).toISOString() : null);
      const { data, error: rpcErr } = await sb.rpc("create_pred_bracket", {
        p_title: title,
        p_kind: kind,
        p_tier: tier,
        p_teams: kind === "elimination" ? teams.map((t) => ({ name: t.name, logo: t.logo || null })) : null,
        p_round_starts: kind === "elimination" ? starts.map(iso) : null,
        p_games: kind === "slate" ? games.map((g) => ({ ...g, home_logo: g.home_logo || null, away_logo: g.away_logo || null, starts_at: iso(g.starts_at) })) : null,
      });
      if (rpcErr) {
        setError(rpcErr.message);
        return;
      }
      const res = data as { ok: boolean; id?: string; duplicate?: boolean; existing_id?: string; index?: number };
      if (!res.ok && res.duplicate && res.existing_id) {
        setDup({ id: res.existing_id, index: res.index });
        return;
      }
      const resp = await fetch("/api/checkout/prediction-bracket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bracketId: res.id, tier }),
      });
      const out = await resp.json().catch(() => ({}));
      if (!resp.ok || !out.url) {
        setError(out.error ?? "We couldn't start checkout. Your draft is saved; open it from Bout Predictions to pay.");
        return;
      }
      window.location.assign(out.url);
    } finally {
      setBusy(false);
    }
  }

  const field = "mt-1 h-11 w-full rounded-xl border bg-transparent px-3 text-sm";
  const border = { borderColor: "var(--border)" };
  const k = rounds(size);
  const price = tier === "season" ? BRACKET_PRICING.seasonCents : BRACKET_PRICING.weeklyCents;

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      {dup && (
        <div role="alert" className="rounded-xl border p-4" style={{ borderColor: "var(--red)", background: "var(--surface-2)" }}>
          <p className="font-bold">This Bout is already in progress.</p>
          <p className="mb-2 text-sm" style={{ color: "var(--text-dim)" }}>
            {dup.index ? `Game ${dup.index} matches` : "A game"} with the same two teams at about the same time already exists. Change it or join the existing game.
          </p>
          <Link href={`/predictions/${dup.id}`} className="text-sm font-bold underline" style={{ color: "var(--blue)" }}>Go to the existing game →</Link>
        </div>
      )}

      <fieldset className="bc-card p-4">
        <legend className="px-1 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>Type</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <Choice active={kind === "elimination"} onClick={() => setKind("elimination")} title="Elimination bracket" body="4 to 32 teams. Players fill out the whole bracket before the first game; winners advance." />
          <Choice active={kind === "slate"} onClick={() => setKind("slate")} title="Slate of games" body="Several separate games scheduled together, each predicted before it starts." />
        </div>
        <label className="mt-3 block text-xs font-bold">
          Bracket name
          <input value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} maxLength={80} className={field} style={border} placeholder={kind === "elimination" ? "e.g. Fall Classic Tournament" : "e.g. Week 7 Friday Night Football"} />
        </label>
      </fieldset>

      <fieldset className="bc-card p-4">
        <legend className="px-1 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>Plan</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <Choice active={tier === "weekly"} onClick={() => setTier("weekly")} title={`${money(BRACKET_PRICING.weeklyCents)} · open 8 days`} body="Opens when you pay and closes automatically after 8 days." />
          <Choice active={tier === "season"} onClick={() => setTier("season")} title={`${money(BRACKET_PRICING.seasonCents)} · whole season`} body="Stays open all season. You close it, or set a time for it to close." />
        </div>
        <p className="mt-2 text-xs" style={{ color: "var(--text-faint)" }}>
          Players always play free. You can upgrade an 8-day bracket to a season bracket later for {money(BRACKET_PRICING.upgradeCents)}.
        </p>
      </fieldset>

      {kind === "elimination" ? (
        <>
          <fieldset className="bc-card p-4">
            <legend className="px-1 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>Teams</legend>
            <label className="block text-xs font-bold">
              Number of teams
              <select value={size} onChange={(e) => changeSize(Number(e.target.value))} className={field} style={{ ...border, background: "var(--surface)" }}>
                {[4, 8, 16, 32].map((n) => <option key={n} value={n}>{n} teams</option>)}
              </select>
            </label>
            <p className="mb-2 mt-2 text-xs" style={{ color: "var(--text-faint)" }}>Teams are matched in the order you list them: 1 vs 2, 3 vs 4, and so on.</p>
            <div className="grid gap-3">
              {teams.map((t, i) => (
                <div key={i} className="rounded-xl border p-3" style={border}>
                  <label className="block text-xs font-bold">
                    Team {i + 1}
                    <input value={t.name} onChange={(e) => setTeam(i, { name: e.target.value })} required maxLength={40} className={field} style={border} />
                  </label>
                  <div className="mt-2"><LogoUploadField value={t.logo} onChange={(url) => setTeam(i, { logo: url })} folder="teams" compact /></div>
                </div>
              ))}
            </div>
          </fieldset>
          <fieldset className="bc-card p-4">
            <legend className="px-1 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>Round start times (your local time)</legend>
            <p className="mb-2 text-xs" style={{ color: "var(--text-faint)" }}>
              Everyone&apos;s bracket locks when round 1 starts. {tier === "weekly" ? "The final must start within 7 days." : ""}
            </p>
            {starts.map((s, i) => (
              <label key={i} className="mb-2 block text-xs font-bold">
                {roundLabel(i + 1, k)}
                <input type="datetime-local" value={s} onChange={(e) => setStarts((a) => a.map((x, j) => (j === i ? e.target.value : x)))} required className={field} style={border} />
              </label>
            ))}
          </fieldset>
        </>
      ) : (
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
                  <input aria-label={`Game ${i + 1} home team`} placeholder="Home team" value={g.home_name} onChange={(e) => setGame(i, { home_name: e.target.value })} required maxLength={40} className={field} style={border} />
                  <LogoUploadField value={g.home_logo} onChange={(url) => setGame(i, { home_logo: url })} folder="teams" compact />
                  <input aria-label={`Game ${i + 1} away team`} placeholder="Away team" value={g.away_name} onChange={(e) => setGame(i, { away_name: e.target.value })} required maxLength={40} className={field} style={border} />
                  <LogoUploadField value={g.away_logo} onChange={(url) => setGame(i, { away_logo: url })} folder="teams" compact />
                  <label className="block text-xs font-bold">
                    Starts
                    <input type="datetime-local" value={g.starts_at} onChange={(e) => setGame(i, { starts_at: e.target.value })} required className={field} style={border} />
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold">
                    <input type="checkbox" checked={g.allow_draw} onChange={(e) => setGame(i, { allow_draw: e.target.checked })} className="h-4 w-4" /> Can end in a tie
                  </label>
                </div>
              </div>
            ))}
          </div>
          {games.length < 64 && (
            <button type="button" onClick={() => setGames((a) => [...a, blankGame()])} className="mt-3 rounded-full border px-4 py-2 text-sm font-semibold" style={border}>+ Add another game</button>
          )}
        </fieldset>
      )}

      {error && <p role="alert" className="text-sm font-semibold" style={{ color: "var(--red)" }}>{error}</p>}
      <button type="submit" disabled={busy} className="bc-btn-solid rounded-full px-5 py-3 text-sm font-bold disabled:opacity-60">
        {busy ? "Saving…" : `Continue to checkout · ${money(price)}`}
      </button>
    </form>
  );
}

function Choice({ active, onClick, title, body }: { active: boolean; onClick: () => void; title: string; body: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className="rounded-xl border p-3 text-left" style={{ borderColor: active ? "var(--blue)" : "var(--border)", background: active ? "var(--surface-2)" : "transparent", boxShadow: active ? "0 0 0 1px var(--blue)" : undefined }}>
      <span className="block text-sm font-bold">{title}</span>
      <span className="block text-xs" style={{ color: "var(--text-dim)" }}>{body}</span>
    </button>
  );
}
