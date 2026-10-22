"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

type Race = { id: string; title: string; candidates: { id: string; name: string }[] };

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

// Equal-time debate timer for a moderator (the organizer or a judge seat). Every candidate gets the same turn length,
// and the page keeps a tally of time used so the class can check that it was fair.
export default function DebateTimer({ id }: { id: string }) {
  const [races, setRaces] = useState<Race[] | null>(null);
  const [needCode, setNeedCode] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [raceId, setRaceId] = useState("");
  const [turnSeconds, setTurnSeconds] = useState(60);
  const [turn, setTurn] = useState(0);
  const [remainingMs, setRemainingMs] = useState(60000);
  const [running, setRunning] = useState(false);
  const [used, setUsed] = useState<Record<string, number>>({});
  const lastTick = useRef(0);
  const storeKey = `desk-code:${id}`;

  const load = useCallback(async () => {
    let code = "";
    try { code = sessionStorage.getItem(storeKey) ?? ""; } catch { /* ignore */ }
    const res = await fetch(`/api/school-election/${id}/debate`, { cache: "no-store", headers: code ? { "x-desk-code": code } : {} });
    if (!res.ok) {
      if (res.status === 401 || res.status === 404) {
        setNeedCode(true);
        setError(code ? "That staff code isn't valid." : null);
        try { sessionStorage.removeItem(storeKey); } catch { /* ignore */ }
      } else if (res.status === 403) setError("Your seat can't run the timer. Ask for a judge seat.");
      else setError("Couldn't load the candidates.");
      return;
    }
    setNeedCode(false);
    setError(null);
    const body = (await res.json()) as { races: Race[] };
    setRaces(body.races);
    setRaceId((cur) => cur || body.races[0]?.id || "");
  }, [id, storeKey]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const race = races?.find((r) => r.id === raceId);
  const speaker = race?.candidates[turn];

  // Count down from wall-clock time so a busy tablet doesn't drift.
  useEffect(() => {
    if (!running || !speaker) return;
    lastTick.current = Date.now();
    const t = setInterval(() => {
      const now = Date.now();
      const dt = now - lastTick.current;
      lastTick.current = now;
      setRemainingMs((ms) => Math.max(0, ms - dt));
      setUsed((u) => ({ ...u, [speaker.id]: (u[speaker.id] ?? 0) + dt }));
    }, 200);
    return () => clearInterval(t);
  }, [running, speaker]);
  useEffect(() => {
    if (running && remainingMs === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRunning(false);
      try { navigator.vibrate?.(300); } catch { /* ignore */ }
    }
  }, [running, remainingMs]);

  function nextSpeaker() {
    if (!race) return;
    setRunning(false);
    setTurn((t) => (t + 1) % Math.max(1, race.candidates.length));
    setRemainingMs(turnSeconds * 1000);
  }
  function resetAll() {
    setRunning(false);
    setTurn(0);
    setUsed({});
    setRemainingMs(turnSeconds * 1000);
  }

  const box = { borderColor: "var(--border)", background: "var(--surface)" } as const;
  const secs = Math.ceil(remainingMs / 1000);
  const color = remainingMs === 0 ? "var(--danger)" : secs <= 10 ? "#a97a12" : "inherit";

  if (needCode) {
    return (
      <form
        className="mx-auto grid max-w-sm gap-3 py-10"
        onSubmit={(e) => {
          e.preventDefault();
          try { sessionStorage.setItem(storeKey, codeInput.trim().toUpperCase()); } catch { /* ignore */ }
          setCodeInput("");
          load();
        }}
      >
        <h1 className="text-2xl font-extrabold">Debate timer</h1>
        <p className="text-sm" style={{ color: "var(--text-dim)" }}>Enter a judge&apos;s staff code, or sign in as the organizer.</p>
        <input autoFocus value={codeInput} onChange={(e) => setCodeInput(e.target.value.toUpperCase())} autoCapitalize="characters" autoComplete="off" className="rounded-[10px] border px-4 py-3 text-center text-xl font-black tracking-[0.2em]" style={box} aria-label="Staff code" />
        {error && <p className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>}
        <button type="submit" disabled={!codeInput.trim()} className="bc-btn-solid rounded-full px-5 py-2.5 text-sm font-bold disabled:opacity-50">Open timer</button>
        <Link href={`/login?next=${encodeURIComponent(`/school-election/${id}/debate`)}`} className="text-center text-sm underline">Sign in as organizer</Link>
      </form>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Debate timer</h1>
        <Link href={`/school-election/${id}`} className="text-sm font-bold underline">Back to election</Link>
      </div>
      {error && <p className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>}
      {!races && !error && <p className="text-sm">Loading…</p>}
      {races && races.length === 0 && <p className="text-sm">Add offices and candidates first.</p>}
      {races && race && (
        <>
          <div className="flex flex-wrap gap-3">
            <label className="grid gap-1 text-sm font-bold">
              Office
              <select value={raceId} onChange={(e) => { setRaceId(e.target.value); resetAll(); }} className="rounded-[10px] border px-3 py-2 font-normal" style={box}>
                {races.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-bold">
              Seconds per turn
              <select value={turnSeconds} onChange={(e) => { const n = Number(e.target.value); setTurnSeconds(n); setRunning(false); setRemainingMs(n * 1000); }} className="rounded-[10px] border px-3 py-2 font-normal" style={box}>
                {[30, 45, 60, 90, 120, 180].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          </div>
          <div className="rounded-xl border p-6 text-center" style={box} role="timer" aria-live="off">
            <p className="text-sm font-bold" style={{ color: "var(--text-dim)" }}>Speaking now</p>
            <p className="text-3xl font-extrabold">{speaker?.name ?? "No candidates"}</p>
            <p className="my-2 text-8xl font-black tabular-nums" style={{ color }}>{fmt(secs)}</p>
            {remainingMs === 0 && <p className="text-lg font-bold" style={{ color: "var(--danger)" }}>Time</p>}
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <button onClick={() => setRunning((r) => !r)} disabled={!speaker || remainingMs === 0} className="bc-btn-solid rounded-full px-6 py-3 font-bold disabled:opacity-50">{running ? "Pause" : "Start"}</button>
              <button onClick={nextSpeaker} className="rounded-full border px-6 py-3 font-bold" style={{ borderColor: "var(--border)" }}>Next speaker</button>
              <button onClick={() => { setRunning(false); setRemainingMs(turnSeconds * 1000); }} className="rounded-full border px-4 py-3 text-sm font-bold" style={{ borderColor: "var(--border)" }}>Reset this turn</button>
            </div>
          </div>
          <div className="rounded-xl border p-4" style={box}>
            <p className="mb-2 font-bold">Time used</p>
            <ul className="grid gap-1 text-sm">
              {race.candidates.map((c) => (
                <li key={c.id} className="flex justify-between"><span>{c.name}</span><span className="tabular-nums">{fmt(Math.round((used[c.id] ?? 0) / 1000))}</span></li>
              ))}
            </ul>
            <button onClick={resetAll} className="mt-3 text-xs font-bold underline">Clear and start over</button>
          </div>
        </>
      )}
    </div>
  );
}
