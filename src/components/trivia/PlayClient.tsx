"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import ShareButton from "@/components/ShareButton";
import { KIND_LABEL, OPTION_COLORS, playerToken, useTriviaState } from "@/lib/trivia";

const wrap = "min-h-screen w-full px-4 py-5 text-white";
const bg = { background: "linear-gradient(170deg,#1b0f3d 0%,#0a0e1a 70%)" };

export default function PlayClient({ code }: { code: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [double, setDouble] = useState(false);
  const sb = useRef(createClient());

  /* eslint-disable react-hooks/set-state-in-effect -- reads localStorage once after mount */
  useEffect(() => {
    setToken(playerToken());
    try {
      setName(localStorage.getItem("bc_trivia_name") ?? "");
    } catch {}
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const { state, missing, secondsLeft, refresh } = useTriviaState(code, token);

  async function join() {
    if (!token) return;
    setBusy(true);
    setErr("");
    try {
      localStorage.setItem("bc_trivia_name", name);
    } catch {}
    const { error } = await sb.current.rpc("trivia_join", { p_code: code, p_name: name, p_token: token });
    setBusy(false);
    if (error) setErr(error.message);
    else refresh();
  }

  async function answer(i: number) {
    if (!token) return;
    setErr("");
    const { error } = await sb.current.rpc("trivia_answer", { p_code: code, p_token: token, p_choice: i, p_double: double });
    if (error) setErr(error.message);
    setDouble(false);
    refresh();
  }

  async function hint() {
    if (!token) return;
    const { error } = await sb.current.rpc("trivia_hint", { p_code: code, p_token: token });
    if (error) setErr(error.message);
    refresh();
  }

  if (missing)
    return (
      <div className={wrap} style={bg}>
        <p className="mt-16 text-center text-lg font-bold">No game with code {code}.</p>
        <p className="mt-2 text-center"><Link href="/trivia" className="underline">Try another code</Link></p>
      </div>
    );
  if (!state)
    return <div className={wrap} style={bg}><p className="mt-16 text-center opacity-70">Loading…</p></div>;

  const { game, question: q, me } = state;
  const teamName = (t: "a" | "b" | null) => (t === "a" ? game.teamA : t === "b" ? game.teamB : "");
  const teamColor = (t: "a" | "b" | null) => (t === "a" ? "#e5263b" : "#1b4fe4");

  if (!me)
    return (
      <div className={wrap} style={bg}>
        <div className="mx-auto max-w-sm pt-10 text-center">
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#ffc531" }}>Live Trivia</p>
          <h1 className="mt-1 text-3xl font-black" style={{ fontFamily: "var(--font-display)" }}>{game.title}</h1>
          <p className="mt-1 text-sm opacity-70">Code {code} · {state.players} in the room</p>
          {game.status === "done" ? (
            <p className="mt-8">This game has ended.</p>
          ) : (
            <>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={24}
                placeholder="Your name"
                className="mt-8 w-full rounded-xl px-4 py-3 text-center text-lg font-bold text-black"
              />
              <button
                onClick={join}
                disabled={busy || !name.trim()}
                className="mt-3 w-full rounded-xl px-4 py-3 text-lg font-black text-black disabled:opacity-50"
                style={{ background: "#ffc531" }}
              >
                {busy ? "Joining…" : "Join the game"}
              </button>
              {game.mode === "team" && <p className="mt-3 text-xs opacity-70">You&apos;ll be placed on {game.teamA} or {game.teamB} automatically.</p>}
              {err && <p className="mt-3 text-sm text-red-300">{err}</p>}
            </>
          )}
        </div>
      </div>
    );

  const Header = (
    <div className="mb-4 flex items-center justify-between text-sm">
      <span className="font-bold">{me.name}{me.team ? <span className="ml-2 rounded-full px-2 py-0.5 text-xs" style={{ background: teamColor(me.team) }}>{teamName(me.team)}</span> : null}</span>
      <span className="font-black" style={{ color: "#ffc531" }}>{me.score} pts · #{me.rank}</span>
    </div>
  );

  if (game.status === "lobby")
    return (
      <div className={wrap} style={bg}>
        {Header}
        <div className="mx-auto mt-16 max-w-sm text-center">
          <p className="text-3xl font-black">You&apos;re in!</p>
          <p className="mt-2 opacity-80">Watch the big screen. The first question starts when the host is ready.</p>
          <p className="mt-6 text-sm opacity-60">{state.players} players so far</p>
        </div>
      </div>
    );

  if (game.status === "done") {
    const top = state.board.slice(0, 3);
    return (
      <div className={wrap} style={bg}>
        {Header}
        <div className="mx-auto max-w-sm text-center">
          <p className="mt-4 text-xs font-bold uppercase tracking-widest" style={{ color: "#ffc531" }}>Final</p>
          <p className="text-5xl font-black">#{me.rank}</p>
          <p className="text-xl font-bold">{me.score} points</p>
          {game.mode === "team" && (
            <p className="mt-3 text-sm">
              {game.teamA} {state.teams.a} · {game.teamB} {state.teams.b}
              <br />
              <b>{state.teams.a === state.teams.b ? "It's a tie" : `${state.teams.a > state.teams.b ? game.teamA : game.teamB} wins`}</b>
            </p>
          )}
          <ol className="mt-5 space-y-1 text-left">
            {top.map((r, i) => (
              <li key={i} className="flex justify-between rounded-lg bg-white/10 px-3 py-2"><span>{i + 1}. {r.name}</span><b>{r.score}</b></li>
            ))}
          </ol>
          <div className="mt-6">
            <ShareButton
              big
              title={`I finished #${me.rank} in ${game.title}`}
              text={`I scored ${me.score} in ${game.title} on BoutCasts. Can you beat me?`}
              label="Share my score"
              imageUrl={`/api/share-card/trivia/${code}`}
            />
          </div>
          <p className="mt-4"><Link href="/trivia" className="text-sm underline opacity-80">Join another game</Link></p>
        </div>
      </div>
    );
  }

  if (!q) return <div className={wrap} style={bg}>{Header}</div>;

  const revealing = game.status === "reveal";
  const answered = state.mine !== null;
  const total = Object.values(q.counts).reduce((a, b) => a + b, 0);
  const pctOf = (i: number) => (total ? Math.round(((q.counts[String(i)] ?? 0) / total) * 100) : 0);
  const canHint = q.kind === "mc" && !me.hintUsed && !answered && !revealing;
  const canDouble = !me.doubleUsed && !answered && !revealing;

  return (
    <div className={wrap} style={bg}>
      {Header}
      <div className="mx-auto max-w-md">
        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest">
          <span style={{ color: "#ffc531" }}>{KIND_LABEL[q.kind]} · {q.pos + 1}/{game.total}</span>
          {!revealing && <span className="text-2xl tabular-nums">{secondsLeft}s</span>}
        </div>
        <h2 className="my-4 text-2xl font-black leading-tight">{q.prompt}</h2>
        {q.kind === "predict" && !revealing && <p className="mb-3 text-sm opacity-80">This one is a real-world call. Points come in once the host reveals what happened.</p>}

        <div className="grid gap-3">
          {q.options.map((o, i) => {
            const hidden = q.hide.includes(i);
            const mineChoice = state.mine?.choice === i;
            const right = revealing && q.correct === i;
            const wrong = revealing && mineChoice && q.correct !== i;
            return (
              <button
                key={i}
                disabled={answered || revealing || hidden || secondsLeft === 0}
                onClick={() => answer(i)}
                className="relative overflow-hidden rounded-2xl px-4 py-4 text-left text-lg font-bold text-white disabled:cursor-default"
                style={{
                  background: OPTION_COLORS[i],
                  opacity: hidden ? 0.15 : revealing && !right && !mineChoice ? 0.45 : 1,
                  outline: mineChoice ? "4px solid #fff" : right ? "4px solid #34d399" : "none",
                }}
              >
                {(revealing || (q.kind === "stump" && answered)) && (
                  <span className="absolute inset-y-0 left-0 bg-black/25" style={{ width: `${pctOf(i)}%` }} />
                )}
                <span className="relative flex items-center justify-between gap-2">
                  <span>{o}</span>
                  {revealing && <span className="text-sm">{pctOf(i)}%{right ? " ✓" : wrong ? " ✗" : ""}</span>}
                </span>
              </button>
            );
          })}
        </div>

        {!answered && !revealing && (
          <div className="mt-4 flex gap-2">
            <button
              disabled={!canDouble}
              onClick={() => setDouble((d) => !d)}
              className="flex-1 rounded-xl px-3 py-2 text-sm font-black disabled:opacity-30"
              style={{ background: double ? "#ffc531" : "rgba(255,255,255,.12)", color: double ? "#000" : "#fff" }}
            >
              {me.doubleUsed ? "Double used" : double ? "Double ON — pick answer" : "2× Double (once)"}
            </button>
            {q.kind === "mc" && (
              <button disabled={!canHint} onClick={hint} className="flex-1 rounded-xl bg-white/10 px-3 py-2 text-sm font-black disabled:opacity-30">
                {me.hintUsed ? "Hint used" : "💡 Hint (once)"}
              </button>
            )}
          </div>
        )}

        {answered && !revealing && <p className="mt-5 text-center font-bold">Locked in{state.mine?.doubled ? " with 2×" : ""}. Waiting for the reveal…</p>}
        {revealing && (
          <div className="mt-5 rounded-2xl bg-white/10 p-4 text-center">
            <p className="text-2xl font-black">
              {!answered ? "No answer" : state.mine!.points > 0 ? `+${state.mine!.points}` : q.correct !== null && state.mine!.choice === q.correct ? "Correct" : "Missed it"}
            </p>
            {q.kind === "stump" && q.correct !== null && (
              <p className="mt-1 text-sm">The room got it {pctOf(q.correct)}% right.</p>
            )}
            {q.explanation && <p className="mt-2 text-sm opacity-80">{q.explanation}</p>}
          </div>
        )}
        {err && <p className="mt-3 text-center text-sm text-red-300">{err}</p>}
      </div>
    </div>
  );
}
