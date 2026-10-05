"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import PredTeam from "@/components/PredTeam";
import LocalTime from "@/components/LocalTime";
import { roundLabel } from "@/lib/predictions/pricing";
import type { BracketTeam, PredGame, PredSlate } from "@/lib/predictions/types";

export type BracketPick = {
  game_id: string;
  team_id: string;
  win_score: number;
  lose_score: number;
  pts_total: number | null;
};

type Draft = Record<string, { team: string | null; win: string; lose: string }>;

function optionsFor(g: PredGame, games: PredGame[], draft: Draft): string[] {
  if (g.round === 1) return [g.home_team_id, g.away_team_id].filter((x): x is string => !!x);
  return games
    .filter((f) => f.feeds_game_id === g.id)
    .sort((a, b) => (a.feeds_side === "home" ? -1 : 1) - (b.feeds_side === "home" ? -1 : 1))
    .map((f) => draft[f.id]?.team)
    .filter((x): x is string => !!x);
}

// A changed pick can strand later picks that depended on it. Clear those.
function normalize(draft: Draft, games: PredGame[]): Draft {
  const next = { ...draft };
  for (const g of [...games].sort((a, b) => (a.round ?? 0) - (b.round ?? 0))) {
    const cur = next[g.id];
    if (cur?.team && !optionsFor(g, games, next).includes(cur.team)) next[g.id] = { ...cur, team: null };
  }
  return next;
}

export default function EliminationBracket({
  slate,
  teams,
  games,
  myPicks,
  canPredict,
  signedIn,
}: {
  slate: PredSlate;
  teams: BracketTeam[];
  games: PredGame[];
  myPicks: BracketPick[];
  canPredict: boolean;
  signedIn: boolean;
}) {
  const router = useRouter();
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const totalRounds = Math.max(...games.map((g) => g.round ?? 1), 1);
  const rounds = Array.from({ length: totalRounds }, (_, i) => i + 1);
  const pickByGame = new Map(myPicks.map((p) => [p.game_id, p]));

  const [draft, setDraft] = useState<Draft>(() => {
    const d: Draft = {};
    for (const p of myPicks) d[p.game_id] = { team: p.team_id, win: String(p.win_score), lose: String(p.lose_score) };
    return d;
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function setGame(id: string, patch: Partial<Draft[string]>) {
    setDraft((d) => normalize({ ...d, [id]: { ...(d[id] ?? { team: null, win: "", lose: "" }), ...patch } }, games));
  }

  const complete = games.every((g) => {
    const d = draft[g.id];
    const w = Number(d?.win), l = Number(d?.lose);
    return d?.team && d.win !== "" && d.lose !== "" && Number.isInteger(w) && Number.isInteger(l) && w > l && l >= 0;
  });

  async function save() {
    setBusy(true);
    setMsg(null);
    const picks = games.map((g) => ({ game_id: g.id, team_id: draft[g.id].team, win_score: Number(draft[g.id].win), lose_score: Number(draft[g.id].lose) }));
    const { error } = await createClient().rpc("submit_bracket", { p_bracket: slate.id, p_picks: picks });
    setBusy(false);
    if (error) {
      setMsg({ ok: false, text: error.message });
      return;
    }
    setMsg({ ok: true, text: "Bracket locked in! You can change it until the first game starts." });
    router.refresh();
  }

  if (canPredict && !signedIn) {
    return (
      <div className="bc-card mb-6 p-5 text-center">
        <p className="mb-3 text-sm font-semibold">Sign in to fill out this bracket and earn points.</p>
        <Link href={`/login?next=${encodeURIComponent(`/predictions/slate/${slate.id}`)}`} className="bc-btn-solid inline-block rounded-full px-5 py-2 text-sm font-bold">Sign in to predict</Link>
      </div>
    );
  }

  return (
    <div className="mb-8">
      {canPredict && (
        <p className="mb-4 rounded-xl p-3 text-sm" style={{ background: "var(--surface-2)", color: "var(--text-dim)" }}>
          Pick the winner of every game and the final score (winner&apos;s score first). Your later rounds follow from the winners you pick. Everything locks when the first game starts{slate.locks_at ? <> (<LocalTime iso={slate.locks_at} />)</> : null}.
        </p>
      )}
      {rounds.map((r) => (
        <section key={r} className="mb-6">
          <h3 className="mb-2 text-base font-bold" style={{ fontFamily: "var(--font-display)" }}>{roundLabel(r, totalRounds)}</h3>
          <div className="grid gap-3">
            {games.filter((g) => g.round === r).sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0)).map((g) => {
              const mine = pickByGame.get(g.id);
              const final = g.status === "final";
              if (canPredict) {
                const opts = optionsFor(g, games, draft);
                const d = draft[g.id];
                return (
                  <div key={g.id} className="bc-card p-4">
                    <p className="mb-2 text-xs font-bold" style={{ color: "var(--text-faint)" }}>Game {g.slot} · <LocalTime iso={g.starts_at} /></p>
                    {opts.length < 2 && r > 1 ? (
                      <p className="text-sm" style={{ color: "var(--text-faint)" }}>Pick the winners of the earlier games first{opts.length === 1 ? ` (so far ${teamById.get(opts[0])?.name})` : ""}.</p>
                    ) : null}
                    <div className="grid grid-cols-2 gap-2">
                      {opts.map((id) => {
                        const t = teamById.get(id);
                        const on = d?.team === id;
                        return (
                          <button key={id} type="button" aria-pressed={on} onClick={() => setGame(g.id, { team: id })} className="min-w-0 rounded-xl border p-2" style={{ borderColor: on ? "var(--blue)" : "var(--border)", background: on ? "var(--surface-2)" : "transparent", boxShadow: on ? "0 0 0 1px var(--blue)" : undefined }}>
                            <PredTeam name={t?.name ?? "Team"} logo={t?.logo ?? null} size={40} />
                          </button>
                        );
                      })}
                    </div>
                    {d?.team && (
                      <div className="mt-3 flex items-end gap-2">
                        <label className="flex-1 text-xs font-bold">
                          Winner&apos;s score
                          <input type="number" inputMode="numeric" min={0} max={999} value={d.win} onChange={(e) => setGame(g.id, { win: e.target.value })} className="mt-1 h-11 w-full rounded-xl border bg-transparent text-center text-lg font-black" style={{ borderColor: "var(--border)" }} />
                        </label>
                        <span className="pb-2 font-black">–</span>
                        <label className="flex-1 text-xs font-bold">
                          Loser&apos;s score
                          <input type="number" inputMode="numeric" min={0} max={999} value={d.lose} onChange={(e) => setGame(g.id, { lose: e.target.value })} className="mt-1 h-11 w-full rounded-xl border bg-transparent text-center text-lg font-black" style={{ borderColor: "var(--border)" }} />
                        </label>
                      </div>
                    )}
                  </div>
                );
              }
              return (
                <Link key={g.id} href={`/predictions/${g.id}`} className="bc-card block p-4">
                  <p className="mb-2 text-xs font-bold" style={{ color: "var(--text-faint)" }}>
                    Game {g.slot} · <LocalTime iso={g.starts_at} /> · {final ? "Final" : g.home_team_id && g.away_team_id ? "Upcoming" : "Waiting on earlier rounds"}
                  </p>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
                    <PredTeam name={g.home_name} logo={g.home_logo} size={44} />
                    <div className="text-center text-xl font-black tabular-nums" style={{ fontFamily: "var(--font-display)" }}>{final ? `${g.home_score} – ${g.away_score}` : "vs"}</div>
                    <PredTeam name={g.away_name} logo={g.away_logo} size={44} />
                  </div>
                  {mine && (
                    <p className="mt-3 text-center text-xs font-semibold" style={{ color: "var(--text-dim)" }}>
                      Your pick: {teamById.get(mine.team_id)?.name ?? "Team"} {mine.win_score}–{mine.lose_score}
                      {mine.pts_total != null ? ` · ${mine.pts_total} pts` : ""}
                    </p>
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      ))}
      {canPredict && (
        <>
          <button type="button" onClick={save} disabled={busy || !complete} className="bc-btn-solid w-full rounded-full px-5 py-3 text-sm font-bold disabled:opacity-60">
            {busy ? "Saving…" : myPicks.length ? "Update my bracket" : "Lock in my bracket"}
          </button>
          {!complete && <p className="mt-2 text-center text-xs" style={{ color: "var(--text-faint)" }}>Pick a winner and score for every game to lock it in.</p>}
          {msg && <p role="status" className="mt-3 text-sm font-semibold" style={{ color: msg.ok ? "var(--blue)" : "var(--red)" }}>{msg.text}</p>}
        </>
      )}
    </div>
  );
}
