"use client";

import { roomThemeVars } from "@/lib/liveVoteEvents/roomTheme";
import { useCallback, useEffect, useRef, useState } from "react";
import { fingerprint, load, post, save, type Manifest, type QueueItem, type Race } from "@/lib/kioskOffline";

type Brand = { logo: string | null; banner: string | null; color: string | null; bg: string | null; bgImage: string | null };
type Status = { label: string; title: string; school: string | null; brand: Brand; state: "open" | "not_started" | "closed"; locked: boolean };
type Step = "welcome" | "ballot" | "review" | "sending" | "done" | "pin";

const IDLE_MS = 90_000;
const DONE_MS = 6_000;

// Full-screen voting booth for an iPad. One student at a time: code + name -> one office per screen -> review -> done.
export default function KioskApp({ token }: { token: string }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [missing, setMissing] = useState(false);
  const [step, setStep] = useState<Step>("welcome");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [voter, setVoter] = useState("");
  const [races, setRaces] = useState<Race[]>([]);
  const [idx, setIdx] = useState(0);
  const [choices, setChoices] = useState<Record<string, string | null>>({});
  const [pin, setPin] = useState("");
  const [pinMsg, setPinMsg] = useState<string | null>(null);
  const requestId = useRef("");
  const last = useRef(0);
  const offlineChecked = useRef(false); // this student was checked in from the iPad's offline list
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [saved, setSaved] = useState(false); // last ballot was saved on the iPad to send later
  const [online, setOnline] = useState(true);
  const localFails = useRef<{ n: number; until: number }>({ n: 0, until: 0 });
  const syncing = useRef(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQueue(load<QueueItem[]>(token, "queue", []));
    setManifest(load<Manifest | null>(token, "manifest", null));
    const cached = load<Status | null>(token, "status", null);
    if (cached) setStatus(cached);
  }, [token]);

  const persistQueue = useCallback((next: QueueItem[]) => {
    setQueue(next);
    save(token, "queue", next);
  }, [token]);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/kiosk/status?token=${encodeURIComponent(token)}`, { cache: "no-store" });
      if (res.status === 404) return setMissing(true);
      if (res.ok) {
        const st = (await res.json()) as Status;
        setStatus(st);
        setOnline(true);
        save(token, "status", st);
      }
    } catch {
      setOnline(false); // keep the last known state
    }
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadStatus();
    const t = setInterval(loadStatus, 20000);
    return () => clearInterval(t);
  }, [loadStatus]);

  const reset = useCallback(() => {
    setStep("welcome");
    setCode("");
    setName("");
    setMsg(null);
    setVoter("");
    setRaces([]);
    setIdx(0);
    setChoices({});
    setPin("");
    setPinMsg(null);
    requestId.current = "";
    loadStatus();
  }, [loadStatus]);

  // Back to the welcome screen after a quiet spell, so one student's half-finished ballot is never shown to the next.
  useEffect(() => {
    last.current = Date.now();
    const bump = () => (last.current = Date.now());
    window.addEventListener("pointerdown", bump);
    window.addEventListener("keydown", bump);
    const t = setInterval(() => {
      if (step !== "welcome" && step !== "sending" && step !== "done" && Date.now() - last.current > IDLE_MS) reset();
    }, 5000);
    return () => {
      window.removeEventListener("pointerdown", bump);
      window.removeEventListener("keydown", bump);
      clearInterval(t);
    };
  }, [step, reset]);

  useEffect(() => {
    if (step !== "done") return;
    const t = setTimeout(reset, DONE_MS);
    return () => clearTimeout(t);
  }, [step, reset]);

  // Send saved ballots. Safe to repeat: the request id means a ballot is never counted twice.
  const sync = useCallback(async () => {
    if (syncing.current) return;
    syncing.current = true;
    try {
      let items = load<QueueItem[]>(token, "queue", []);
      for (const it of items.filter((x) => !x.problem)) {
        try {
          const { data } = await post("/api/kiosk/submit", { token, code: it.code, name: it.name, choices: it.choices, requestId: it.requestId, castAt: it.castAt });
          if (data.ok) items = items.filter((x) => x.requestId !== it.requestId);
          else if (data.error === "already_voted") items = items.map((x) => (x.requestId === it.requestId ? { ...x, problem: "Already voted on another iPad, so this ballot was not counted." } : x));
          else if (data.error === "closed") items = items.map((x) => (x.requestId === it.requestId ? { ...x, problem: "Arrived too late to count." } : x));
          else if (data.error === "not_registered") items = items.map((x) => (x.requestId === it.requestId ? { ...x, problem: "Not registered to vote, so this ballot was not counted." } : x));
          else if (data.error === "no_match" || data.error === "cap") items = items.map((x) => (x.requestId === it.requestId ? { ...x, problem: data.error === "cap" ? "The election reached its vote limit." : "Code and name did not match." } : x));
          setOnline(true);
        } catch {
          setOnline(false);
          break;
        }
      }
      persistQueue(items);
    } finally {
      syncing.current = false;
    }
  }, [token, persistQueue]);

  useEffect(() => {
    const t = setInterval(sync, 10000);
    const on = () => { setOnline(true); sync(); };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { clearInterval(t); window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, [sync]);

  function startBallot(ballot: Race[], who: string, fromOffline: boolean) {
    setVoter(who);
    setRaces(ballot);
    setIdx(0);
    setChoices({});
    requestId.current = crypto.randomUUID();
    offlineChecked.current = fromOffline;
    setSaved(false);
    setStep("ballot");
  }

  // Check in using the list a teacher loaded onto this iPad (no connection needed).
  async function verifyLocal() {
    if (!manifest) return setMsg("No connection. Please ask a teacher.");
    if (manifest.closesAt && new Date(manifest.closesAt) <= new Date()) return setMsg("Voting is closed.");
    if (Date.now() < localFails.current.until) return setMsg("Too many tries. Please ask a teacher.");
    const norm = code.trim().toUpperCase();
    if (queue.some((q) => q.code.toUpperCase() === norm)) return setMsg("This code has already been used.");
    const fp = await fingerprint(manifest.electionId, code, name);
    if (!manifest.hashes.includes(fp)) {
      const n = localFails.current.n + 1;
      localFails.current = { n, until: n >= 5 ? Date.now() + 5 * 60_000 : 0 };
      if (n >= 5) localFails.current.n = 0;
      return setMsg("That code and name don't match, or the code was already used. Check both and try again.");
    }
    localFails.current = { n: 0, until: 0 };
    startBallot(manifest.ballot, name.trim(), true);
  }

  async function verify() {
    setBusy(true);
    setMsg(null);
    try {
      const { data: d } = await post("/api/kiosk/verify", { token, code, name });
      setOnline(true);
      if (d.ok) startBallot(d.ballot as Race[], String(d.voter_name), false);
      else if (d.error === "already_voted") setMsg("This code has already been used.");
      else if (d.error === "locked") { setMsg("This kiosk is locked. Please ask a teacher."); loadStatus(); }
      else if (d.error === "closed") { setMsg("Voting is closed."); loadStatus(); }
      else if (d.error === "not_registered") setMsg("You are not registered to vote yet. Please see a teacher.");
      else if (d.error === "no_match") setMsg("That code and name don't match. Check both and try again.");
      else setMsg("Something went wrong. Please try again.");
    } catch {
      setOnline(false);
      await verifyLocal();
    } finally {
      setBusy(false);
    }
  }

  // Save the finished ballot on the iPad, and stop the same code being used again here.
  async function enqueue() {
    const item: QueueItem = { requestId: requestId.current, code, name, choices, castAt: new Date().toISOString() };
    persistQueue([...load<QueueItem[]>(token, "queue", []), item]);
    if (manifest) {
      const fp = await fingerprint(manifest.electionId, code, name);
      const next = { ...manifest, hashes: manifest.hashes.filter((h) => h !== fp) };
      setManifest(next);
      save(token, "manifest", next);
    }
    setSaved(true);
    setStep("done");
  }

  async function submit() {
    setStep("sending");
    if (offlineChecked.current) return enqueue();
    const castAt = new Date().toISOString();
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const { data: d } = await post("/api/kiosk/submit", { token, code, name, choices, requestId: requestId.current, castAt });
        if (d.ok) return setStep("done");
        if (d.error === "closed") { setMsg("Voting closed before your ballot was sent."); return setStep("welcome"); }
        if (d.error === "already_voted") { setMsg("This code has already been used."); return setStep("welcome"); }
        if (d.error === "cap") { setMsg("This election has reached its vote limit. Please ask a teacher."); return setStep("welcome"); }
        if (d.error === "not_registered") { setMsg("You are not registered to vote yet. Please see a teacher."); return setStep("welcome"); }
        if (d.error === "no_match" || d.error === "locked") { setMsg("Please ask a teacher for help."); return setStep("welcome"); }
      } catch {
        /* try once more, then save on the iPad */
      }
    }
    setOnline(false);
    await enqueue();
  }

  async function prepareOffline() {
    setBusy(true);
    setPinMsg(null);
    try {
      const { data } = await post("/api/kiosk/offline-prep", { token, pin }, 30000);
      if (data.ok) {
        const m: Manifest = { electionId: String(data.electionId), ballot: data.ballot as Race[], hashes: data.hashes as string[], preparedAt: String(data.preparedAt), closesAt: (data.closesAt as string | null) ?? null };
        setManifest(m);
        save(token, "manifest", m);
        setPinMsg(`Ready for offline: ${m.hashes.length.toLocaleString()} students can check in without Wi-Fi.`);
      } else setPinMsg(data.error === "wait" ? "Too many tries. Wait a few minutes." : data.error === "bad_pin" ? "Wrong PIN." : "Couldn't load. Try again with Wi-Fi.");
    } catch {
      setPinMsg("No connection. Connect to Wi-Fi or a hotspot first.");
    } finally {
      setBusy(false);
      setPin("");
    }
  }

  async function pinSubmit(action: "unlock" | "exit") {
    setBusy(true);
    setPinMsg(null);
    try {
      const res = await fetch("/api/kiosk/unlock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, pin, action }) });
      const d = await res.json().catch(() => ({}));
      if (d.ok) {
        if (action === "exit") { setPinMsg("Teacher confirmed. You can now close this page or turn off Guided Access."); setPin(""); }
        else reset();
      } else setPinMsg(d.error === "wait" ? "Too many tries. Wait a few minutes." : "Wrong PIN.");
    } catch {
      setPinMsg("No connection.");
    } finally {
      setBusy(false);
      setPin("");
    }
  }

  const shell = "fixed inset-0 z-[100] flex flex-col overflow-auto";
  const b = status?.brand;
  const themed = roomThemeVars(b?.color ?? null, b?.bg ?? null, b?.bgImage ?? null) as React.CSSProperties;
  // School colors when set at setup; otherwise the BoutCasts navy.
  const style: React.CSSProperties = b?.bg || b?.bgImage ? { color: "#0B1020", ...themed } : { background: "#0B1020", color: "#fff", ...themed };
  const accentBtn: React.CSSProperties = { background: "var(--red, #2352E8)", color: "#fff" };
  const card = { background: "var(--surface, #151b30)", borderColor: "var(--border, #2a3355)" } as const;
  const big = "rounded-2xl px-8 py-5 text-2xl font-extrabold disabled:opacity-40";
  const input = "w-full rounded-xl border px-5 py-4 text-2xl";

  if (missing) return <div className={shell} style={style}><p className="m-auto text-2xl">This kiosk link isn&apos;t valid. Ask the organizer for a new one.</p></div>;
  if (!status) return <div className={shell} style={style}><p className="m-auto text-xl">Loading…</p></div>;

  const header = (
    <div className="text-center">
      {b?.banner && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={b.banner} alt="" className="h-28 w-full object-cover" />
      )}
      {b?.logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={b.logo} alt="" className="mx-auto mt-4 h-16 w-16 rounded-xl object-contain" />
      )}
      {status.school && <p className="px-8 pt-3 text-sm font-bold uppercase tracking-widest opacity-70">{status.school}</p>}
      <h1 className="px-8 pt-1 text-3xl font-extrabold">{status.title}</h1>
    </div>
  );
  const pinLink = (
    <button onClick={() => { setPin(""); setPinMsg(null); setStep("pin"); }} className="absolute bottom-3 right-4 text-xs opacity-40">Teacher</button>
  );

  if (step === "pin") {
    return (
      <div className={shell} style={style}>
        {header}
        <div className="m-auto w-full max-w-sm px-6 text-center">
          <p className="mb-3 text-xl font-bold">Teacher PIN</p>
          <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" type="password" autoComplete="off" className={`${input} text-center tracking-[0.5em]`} style={card} aria-label="Teacher PIN" />
          {pinMsg && <p className="mt-3 text-sm">{pinMsg}</p>}
          <div className="mt-4 grid gap-3">
            <button disabled={busy || pin.length !== 6} onClick={() => pinSubmit("unlock")} className={big} style={accentBtn}>Unlock kiosk</button>
            <button disabled={busy || pin.length !== 6} onClick={prepareOffline} className="rounded-xl border px-4 py-3 font-bold disabled:opacity-40" style={card}>Get ready for offline</button>
            <button onClick={sync} className="rounded-xl border px-4 py-3 font-bold" style={card}>Send waiting ballots now ({queue.filter((q) => !q.problem).length})</button>
            {queue.some((q) => q.problem) && (
              <div className="rounded-xl border p-3 text-left text-sm" style={card}>
                <p className="font-bold">Ballots not counted</p>
                {queue.filter((q) => q.problem).map((q) => <p key={q.requestId}>{q.name}: {q.problem}</p>)}
                <button onClick={() => persistQueue(queue.filter((q) => !q.problem))} className="mt-1 underline">Clear this list</button>
              </div>
            )}
            <button disabled={busy || pin.length !== 6} onClick={() => pinSubmit("exit")} className="rounded-xl border px-4 py-3 font-bold disabled:opacity-40" style={card}>Confirm teacher to exit</button>
            <button onClick={reset} className="text-sm underline">Back</button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className={shell} style={style} onClick={reset}>
        <div className="m-auto px-8 text-center">
          <p className="text-7xl">✓</p>
          <h2 className="mt-4 text-5xl font-extrabold">Thanks for voting!</h2>
          <p className="mt-3 text-xl opacity-80">{saved ? "Your ballot is saved on this iPad and will send automatically." : "Your ballot is in."} Results will be shared when voting closes.</p>
        </div>
      </div>
    );
  }

  if (step === "sending") {
    return <div className={shell} style={style}><p className="m-auto text-3xl font-bold">Sending your ballot…</p></div>;
  }

  if (step === "welcome") {
    const blocked = status.state !== "open" ? (status.state === "closed" ? "Voting is closed." : "Voting hasn't started yet.") : status.locked ? "This kiosk is locked. Please ask a teacher." : null;
    return (
      <div className={`${shell} relative`} style={style}>
        {header}
        <div className="m-auto w-full max-w-xl px-6">
          {blocked ? (
            <p className="text-center text-3xl font-bold">{blocked}</p>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); if (code.trim() && name.trim()) verify(); }} className="grid gap-4">
              <p className="text-center text-xl opacity-80">Get your code from the teacher, then enter it with your name.</p>
              <label className="grid gap-1 text-sm font-bold">Your code
                <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} autoCapitalize="characters" autoComplete="off" autoCorrect="off" spellCheck={false} className={`${input} text-center font-black tracking-[0.3em]`} style={card} />
              </label>
              <label className="grid gap-1 text-sm font-bold">Your full name
                <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" autoCorrect="off" className={input} style={card} />
              </label>
              {msg && <p className="text-center text-lg font-bold text-[var(--red,#FFC72C)]" role="alert">{msg}</p>}
              <button type="submit" disabled={busy || !code.trim() || !name.trim()} className={big} style={accentBtn}>{busy ? "Checking…" : "Start voting"}</button>
            </form>
          )}
          {blocked && msg && <p className="mt-3 text-center">{msg}</p>}
        </div>
        <p className="absolute bottom-3 left-4 text-xs opacity-60">
          {!online && "Offline · "}{queue.filter((q) => !q.problem).length} waiting to send{queue.some((q) => q.problem) ? " · see teacher" : ""}{manifest ? " · offline ready" : ""}
        </p>
        {pinLink}
      </div>
    );
  }

  // ballot / review
  if (step === "review") {
    return (
      <div className={`${shell} relative`} style={style}>
        {header}
        <div className="mx-auto w-full max-w-2xl px-6 py-6">
          <h2 className="mb-3 text-2xl font-extrabold">Review your ballot, {voter.split(" ")[0]}</h2>
          {msg && <p className="mb-3 rounded-xl border p-3 font-bold text-[var(--red,#FFC72C)]" style={card} role="alert">{msg}</p>}
          <ul className="grid gap-2">
            {races.map((r, i) => {
              const o = r.options.find((x) => x.id === choices[r.race_id]);
              return (
                <li key={r.race_id} className="flex items-center justify-between gap-3 rounded-xl border px-4 py-3" style={card}>
                  <div><p className="text-sm opacity-70">{r.title}</p><p className="text-xl font-bold">{o ? o.name : "No vote"}</p></div>
                  <button onClick={() => { setMsg(null); setIdx(i); setStep("ballot"); }} className="text-sm font-bold underline">Change</button>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-sm opacity-70">Once you submit, you can&apos;t change your votes.</p>
          <button onClick={() => { setMsg(null); submit(); }} className={`${big} mt-4 w-full`} style={accentBtn}>Submit my ballot</button>
        </div>
        {pinLink}
      </div>
    );
  }

  const race = races[idx];
  if (!race) return <div className={shell} style={style}><button onClick={reset} className="m-auto underline">Start over</button></div>;
  const pick = choices[race.race_id] ?? null;
  const lastRace = idx === races.length - 1;
  return (
    <div className={`${shell} relative`} style={style}>
      {header}
      <div className="mx-auto w-full max-w-2xl px-6 py-5">
        <p className="text-sm font-bold opacity-70">Office {idx + 1} of {races.length}</p>
        <h2 className="mb-3 text-3xl font-extrabold">{race.title}</h2>
        <div className="grid gap-3">
          {race.options.map((o) => {
            const on = pick === o.id;
            return (
              <div key={o.id} className="overflow-hidden rounded-2xl border-2" style={{ ...card, borderColor: on ? "var(--red, #FFC72C)" : card.borderColor, background: on ? "var(--red-soft, #1d2a5c)" : card.background }}>
                <button onClick={() => setChoices((c) => ({ ...c, [race.race_id]: on ? null : o.id }))} aria-pressed={on} className="flex w-full items-center gap-4 px-5 py-4 text-left">
                  {o.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={o.image_url} alt="" className="h-24 w-24 shrink-0 rounded-xl object-cover" />
                  )}
                  <span>
                    <span className="text-2xl font-extrabold">{on ? "✓ " : ""}{o.name}</span>
                    {o.description && <span className="mt-1 block text-base opacity-80">{o.description}</span>}
                  </span>
                </button>
                {o.video_url && (
                  <video src={o.video_url} controls playsInline preload="none" className="max-h-64 w-full bg-black" aria-label={`${o.name} speech`} />
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-sm opacity-70">Tap again to clear. You can skip this office.</p>
        <div className="mt-4 flex gap-3">
          {idx > 0 && <button onClick={() => setIdx(idx - 1)} className="rounded-2xl border px-6 py-4 text-xl font-bold" style={card}>Back</button>}
          <button onClick={() => (lastRace ? setStep("review") : setIdx(idx + 1))} className={`${big} flex-1`} style={accentBtn}>{lastRace ? "Review ballot" : pick ? "Next" : "Skip"}</button>
        </div>
      </div>
      {pinLink}
    </div>
  );
}
