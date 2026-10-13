"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/client";
import { KIND_LABEL, useTriviaState } from "@/lib/trivia";

export default function HostClient({ code, gameId }: { code: string; gameId: string }) {
  const { state, secondsLeft, refresh } = useTriviaState(code, null, 1000);
  const sb = useRef(createClient());
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<number | null>(null);
  const [qr, setQr] = useState("");
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  useEffect(() => {
    QRCode.toDataURL(`${window.location.origin}/trivia/${code}/play`, { margin: 1, width: 240 }).then(setQr).catch(() => {});
  }, [code]);

  async function act(action: string, o?: number | null) {
    setBusy(true);
    setErr("");
    const { error } = await sb.current.rpc("trivia_host_action", { p_game: gameId, p_action: action, p_outcome: o ?? null });
    setBusy(false);
    if (error) setErr(error.message);
    else {
      setOutcome(null);
      refresh();
    }
  }

  if (!state) return <div className="p-6">Loading…</div>;
  const { game, question: q } = state;
  const btn = "rounded-xl px-5 py-3 text-base font-black disabled:opacity-50";
  const answered = q ? Object.values(q.counts).reduce((a, b) => a + b, 0) : 0;
  const last = game.pos + 1 >= game.total;

  return (
    <div className="mx-auto max-w-3xl px-5 py-6">
      <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>{game.title}</h1>
      <div className="mt-3 grid gap-4 rounded-2xl border p-4 sm:grid-cols-[1fr_auto]" style={{ borderColor: "var(--border, #e5e7eb)" }}>
        <div className="space-y-2 text-sm">
          <p>Join code <b className="text-2xl tracking-widest">{code}</b> · {state.players} players</p>
          <p>
            <a className="font-semibold underline" href={`/trivia/${code}/screen`} target="_blank" rel="noreferrer">Open the big screen</a>
            {" · "}
            <button className="font-semibold underline" onClick={() => navigator.clipboard?.writeText(`${origin}/trivia/${code}/play`)}>Copy player link</button>
          </p>
          <p className="opacity-70">Put the big screen on the projector. Players scan the QR or enter the code at {origin.replace(/^https?:\/\//, "")}/trivia.</p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {qr && <img src={qr} alt="Join QR" className="h-32 w-32 rounded-lg" />}
      </div>

      <div className="mt-5 rounded-2xl p-5 text-white" style={{ background: "linear-gradient(160deg,#2a1260,#0a0e1a)" }}>
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#ffc531" }}>
          {game.status === "lobby" ? "Lobby" : game.status === "done" ? "Finished" : `${KIND_LABEL[q?.kind ?? "mc"]} · ${game.pos + 1} of ${game.total}`}
        </p>
        {q && <p className="mt-2 text-xl font-bold">{q.prompt}</p>}
        {q && (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {q.options.map((o, i) => (
              <li key={i} className="rounded-lg bg-white/10 px-3 py-2 text-sm">
                {o} <span className="opacity-60">· {q.counts[String(i)] ?? 0}</span>
                {q.correct === i ? " ✓" : ""}
              </li>
            ))}
          </ul>
        )}
        {game.status === "question" && <p className="mt-3 text-sm">{answered} of {state.players} answered · {secondsLeft}s left</p>}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {game.status === "lobby" && (
            <button disabled={busy || state.players === 0} className={btn} style={{ background: "#ffc531", color: "#000" }} onClick={() => act("start")}>
              Start first question
            </button>
          )}
          {game.status === "question" && (
            <>
              {q?.needsOutcome && (
                <select className="rounded-lg px-3 py-3 text-black" value={outcome ?? ""} onChange={(e) => setOutcome(e.target.value === "" ? null : Number(e.target.value))}>
                  <option value="">What really happened?</option>
                  {q.options.map((o, i) => <option key={i} value={i}>{o}</option>)}
                </select>
              )}
              <button disabled={busy || (q?.needsOutcome && outcome === null)} className={btn} style={{ background: "#ffc531", color: "#000" }} onClick={() => act("reveal", outcome)}>
                Reveal answer
              </button>
            </>
          )}
          {game.status === "reveal" && (
            <button disabled={busy} className={btn} style={{ background: "#ffc531", color: "#000" }} onClick={() => act("next")}>
              {last ? "Show final scores" : "Next question"}
            </button>
          )}
          {game.status !== "done" && (
            <button disabled={busy} className={`${btn} bg-white/15`} onClick={() => confirm("End the game now?") && act("end")}>End game</button>
          )}
        </div>
        {err && <p className="mt-3 text-sm text-red-300">{err}</p>}
      </div>

      <h2 className="mb-2 mt-6 text-sm font-bold uppercase tracking-widest opacity-70">Leaderboard</h2>
      {game.mode === "team" && (
        <p className="mb-2 text-sm"><b>{game.teamA}</b> {state.teams.a} · <b>{game.teamB}</b> {state.teams.b}</p>
      )}
      <ol className="space-y-1 text-sm">
        {state.board.map((r, i) => (
          <li key={i} className="flex justify-between rounded-lg px-3 py-2" style={{ background: "var(--surface-2, #f3f4f6)" }}>
            <span>{i + 1}. {r.name}</span><b>{r.score}</b>
          </li>
        ))}
        {state.board.length === 0 && <li className="opacity-60">Nobody has joined yet.</li>}
      </ol>
    </div>
  );
}
