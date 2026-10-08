"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { KIND_LABEL, OPTION_COLORS, useTriviaState } from "@/lib/trivia";

// Projector view: join code + QR in the lobby, big question and countdown, live answer bars, leaderboard.
export default function ScreenClient({ code }: { code: string }) {
  const { state, missing, secondsLeft } = useTriviaState(code, null, 1000);
  const [qr, setQr] = useState("");

  useEffect(() => {
    QRCode.toDataURL(`${window.location.origin}/trivia/${code}/play`, { margin: 1, width: 420 }).then(setQr).catch(() => {});
  }, [code]);

  const shell = "min-h-screen w-full p-8 text-white md:p-12";
  const bg = { background: "linear-gradient(160deg,#2a1260 0%,#0a0e1a 75%)" };
  if (missing) return <div className={shell} style={bg}><p className="text-4xl font-black">No game with code {code}</p></div>;
  if (!state) return <div className={shell} style={bg} />;

  const { game, question: q } = state;
  const host = typeof window !== "undefined" ? window.location.host : "boutcasts.com";

  const Board = (
    <div>
      {game.mode === "team" && (
        <div className="mb-5 grid grid-cols-2 gap-4">
          {([["a", game.teamA, "#e5263b"], ["b", game.teamB, "#1b4fe4"]] as const).map(([k, n, c]) => (
            <div key={k} className="rounded-2xl p-4 text-center" style={{ background: c }}>
              <p className="text-xl font-bold">{n}</p>
              <p className="text-5xl font-black tabular-nums">{state.teams[k]}</p>
              <p className="text-sm opacity-80">{state.teams[k === "a" ? "na" : "nb"]} players</p>
            </div>
          ))}
        </div>
      )}
      <ol className="space-y-2">
        {state.board.slice(0, 8).map((r, i) => (
          <li key={i} className="flex items-center justify-between rounded-xl bg-white/10 px-4 py-3 text-2xl font-bold">
            <span>{i + 1}. {r.name}</span>
            <span className="tabular-nums" style={{ color: "#ffc531" }}>{r.score}</span>
          </li>
        ))}
      </ol>
    </div>
  );

  if (game.status === "lobby")
    return (
      <div className={shell} style={bg}>
        <div className="mx-auto grid max-w-6xl items-center gap-10 md:grid-cols-2">
          <div>
            <p className="text-lg font-bold uppercase tracking-widest" style={{ color: "#ffc531" }}>Live Trivia</p>
            <h1 className="mt-2 text-6xl font-black leading-none" style={{ fontFamily: "var(--font-display)" }}>{game.title}</h1>
            <p className="mt-8 text-2xl">Join on your phone at</p>
            <p className="text-3xl font-black">{host}/trivia</p>
            <p className="mt-4 text-2xl">Code</p>
            <p className="text-8xl font-black tracking-widest" style={{ color: "#ffc531" }}>{code}</p>
            <p className="mt-6 text-3xl font-bold">{state.players} in the room</p>
          </div>
          <div className="flex flex-col items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {qr && <img src={qr} alt={`QR code to join ${code}`} className="w-80 rounded-3xl bg-white p-3 md:w-96" />}
            <p className="text-xl opacity-80">Scan to join</p>
          </div>
        </div>
      </div>
    );

  if (game.status === "done")
    return (
      <div className={shell} style={bg}>
        <div className="mx-auto max-w-3xl">
          <h1 className="mb-6 text-center text-6xl font-black" style={{ fontFamily: "var(--font-display)" }}>Final scores</h1>
          {game.mode === "team" && state.teams.a !== state.teams.b && (
            <p className="mb-6 text-center text-4xl font-black" style={{ color: "#ffc531" }}>
              {state.teams.a > state.teams.b ? game.teamA : game.teamB} wins!
            </p>
          )}
          {Board}
          <p className="mt-8 text-center text-xl opacity-80">Share your score from your phone</p>
        </div>
      </div>
    );

  if (!q) return <div className={shell} style={bg} />;
  const revealing = game.status === "reveal";
  const total = Object.values(q.counts).reduce((a, b) => a + b, 0);
  const pct = (i: number) => (total ? Math.round(((q.counts[String(i)] ?? 0) / total) * 100) : 0);

  return (
    <div className={shell} style={bg}>
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1fr_380px]">
        <div>
          <div className="flex items-center justify-between">
            <p className="text-xl font-bold uppercase tracking-widest" style={{ color: "#ffc531" }}>
              {KIND_LABEL[q.kind]} · Question {q.pos + 1} of {game.total}
            </p>
            {!revealing ? (
              <p className="text-7xl font-black tabular-nums">{secondsLeft}</p>
            ) : (
              <p className="text-2xl font-bold">{total} answered</p>
            )}
          </div>
          <h1 className="my-6 text-5xl font-black leading-tight md:text-6xl">{q.prompt}</h1>
          {q.kind === "predict" && !revealing && <p className="mb-4 text-2xl opacity-80">Real-world call. Points land when the host reveals the result.</p>}
          <div className="grid gap-4 md:grid-cols-2">
            {q.options.map((o, i) => {
              const right = revealing && q.correct === i;
              return (
                <div
                  key={i}
                  className="relative overflow-hidden rounded-3xl p-6 text-3xl font-black"
                  style={{ background: OPTION_COLORS[i], opacity: revealing && !right ? 0.4 : 1, outline: right ? "6px solid #34d399" : "none" }}
                >
                  <span className="absolute inset-y-0 left-0 bg-black/25" style={{ width: `${(revealing || q.kind === "stump") ? pct(i) : 0}%` }} />
                  <span className="relative flex items-center justify-between gap-3">
                    <span>{o}</span>
                    {(revealing || q.kind === "stump") && <span className="text-2xl">{pct(i)}%{right ? " ✓" : ""}</span>}
                  </span>
                </div>
              );
            })}
          </div>
          {revealing && q.explanation && <p className="mt-6 text-2xl opacity-90">{q.explanation}</p>}
          {!revealing && <p className="mt-6 text-2xl opacity-80">{total} answered of {state.players}</p>}
        </div>
        <div>
          <h2 className="mb-3 text-2xl font-black uppercase tracking-widest">Leaderboard</h2>
          {Board}
        </div>
      </div>
    </div>
  );
}
