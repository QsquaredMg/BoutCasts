"use client";

import { useState } from "react";

type Opt = { id: string; name: string; description: string | null; image_url: string | null; video_url: string | null };
type Race = { race_id: string; title: string; options: Opt[] };
type Session = { voterName: string; ballot: Race[]; voted: string[]; closesAt: string | null };

export default function LinkVote({ id, title, school }: { id: string; title: string; school: string | null }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [s, setS] = useState<Session | null>(null);
  const [pick, setPick] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const box = { borderColor: "var(--border)", background: "var(--surface)" } as const;

  async function post(payload: Record<string, unknown>) {
    const res = await fetch(`/api/school-election/${id}/vote-link`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, name, ...payload }) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.ok === false) throw new Error(body.error || "Something went wrong.");
    return body;
  }

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy("in");
    setError(null);
    try {
      const b = await post({ action: "open" });
      setS({ voterName: b.voter_name, ballot: b.ballot, voted: b.voted ?? [], closesAt: b.closes_at });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  async function cast(r: Race) {
    const optionId = pick[r.race_id];
    if (!optionId || !s) return;
    const who = r.options.find((o) => o.id === optionId)?.name ?? "this candidate";
    if (!confirm(`Lock in your vote for ${who} as ${r.title}? You can't change it.`)) return;
    setBusy(r.race_id);
    setError(null);
    try {
      await post({ action: "cast", raceId: r.race_id, optionId });
      setS({ ...s, voted: [...s.voted, r.race_id] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  const header = (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>{school ?? "School election"}</p>
      <h1 className="text-3xl font-extrabold">{title}</h1>
    </div>
  );

  if (!s) {
    return (
      <div className="grid gap-4">
        {header}
        <p className="text-sm" style={{ color: "var(--text-dim)" }}>Enter the personal code your teacher gave you (or emailed to you) and your name as it appears on the class list. You vote once for each office, and results stay hidden until voting closes.</p>
        <form onSubmit={signIn} className="grid gap-3">
          <label className="grid gap-1 text-sm font-semibold">
            Your code
            <input value={code} onChange={(ev) => setCode(ev.target.value.toUpperCase())} maxLength={12} autoComplete="off" autoCapitalize="characters" className="rounded-[10px] border px-3 py-2.5 font-mono text-lg tracking-widest" style={box} />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Your first and last name
            <input value={name} onChange={(ev) => setName(ev.target.value)} maxLength={120} autoComplete="off" className="rounded-[10px] border px-3 py-2.5 text-base" style={box} />
          </label>
          {error && <p className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>}
          <button type="submit" disabled={busy !== null || !code.trim() || !name.trim()} className="bc-btn-solid rounded-full px-5 py-2.5 text-sm font-bold disabled:opacity-50">{busy ? "Checking…" : "Start voting"}</button>
        </form>
      </div>
    );
  }

  const done = s.ballot.length > 0 && s.ballot.every((r) => s.voted.includes(r.race_id));
  return (
    <div className="grid gap-5">
      {header}
      <p className="text-sm" style={{ color: "var(--text-dim)" }}>
        Hi {s.voterName}. {done ? "You've voted for every office. Thank you! Results are shown when voting closes." : "Pick one candidate for each office, then lock in that vote. You can come back later for the offices you skip" + (s.closesAt ? ` until ${new Date(s.closesAt).toLocaleString()}.` : ".")}
      </p>
      {error && <p className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>}
      {s.ballot.map((r) => {
        const voted = s.voted.includes(r.race_id);
        return (
          <section key={r.race_id} className="rounded-xl border p-4" style={box}>
            <h2 className="text-lg font-extrabold">{r.title}</h2>
            {voted ? (
              <p className="mt-2 text-sm font-semibold">✓ Your vote is in.</p>
            ) : (
              <>
                <div className="mt-2 grid gap-2">
                  {r.options.map((o) => (
                    <label key={o.id} className="flex cursor-pointer items-start gap-3 rounded-lg border p-3" style={{ borderColor: pick[r.race_id] === o.id ? "var(--red)" : "var(--border)" }}>
                      <input type="radio" name={r.race_id} checked={pick[r.race_id] === o.id} onChange={() => setPick({ ...pick, [r.race_id]: o.id })} className="mt-1" />
                      {o.image_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={o.image_url} alt="" className="h-12 w-12 rounded-full object-cover" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block font-bold">{o.name}</span>
                        {o.description && <span className="block text-sm" style={{ color: "var(--text-dim)" }}>{o.description}</span>}
                        {o.video_url && <video src={o.video_url} controls preload="none" playsInline className="mt-2 w-full rounded-lg" />}
                      </span>
                    </label>
                  ))}
                </div>
                <button onClick={() => cast(r)} disabled={!pick[r.race_id] || busy !== null} className="bc-btn-solid mt-3 rounded-full px-5 py-2.5 text-sm font-bold disabled:opacity-50">{busy === r.race_id ? "Saving…" : "Lock in my vote"}</button>
              </>
            )}
          </section>
        );
      })}
    </div>
  );
}
