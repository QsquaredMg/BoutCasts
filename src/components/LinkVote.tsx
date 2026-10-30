"use client";

import { useState } from "react";
import { BallotHeader, CandidateCard, ProgressBar, ballotTheme, type BallotBrand, type BallotCandidate } from "@/components/ballot/BallotKit";

type Race = { race_id: string; title: string; options: BallotCandidate[] };
type Session = { voterName: string; ballot: Race[]; voted: string[]; closesAt: string | null };

// Vote by link: sign in with your own code, then one office per screen with a progress bar.
export default function LinkVote({ id, title, school, brand, previewBallot }: { id: string; title: string; school: string | null; brand?: BallotBrand | null; previewBallot?: Race[] }) {
  const theme = ballotTheme(brand);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [s, setS] = useState<Session | null>(null);
  const [idx, setIdx] = useState(0);
  const [finished, setFinished] = useState(false);
  const [pick, setPick] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function post(payload: Record<string, unknown>) {
    const res = await fetch(`/api/school-election/${id}/vote-link`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, name, ...payload }) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.ok === false) throw new Error(body.error || "Something went wrong.");
    return body;
  }

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    if (previewBallot) {
      setS({ voterName: name.trim() || "Preview voter", ballot: previewBallot, voted: [], closesAt: null });
      return;
    }
    setBusy("in");
    setError(null);
    try {
      const b = await post({ action: "open" });
      const ballot = b.ballot as Race[];
      const voted = (b.voted ?? []) as string[];
      setS({ voterName: b.voter_name, ballot, voted, closesAt: b.closes_at });
      const first = ballot.findIndex((r) => !voted.includes(r.race_id));
      setIdx(first === -1 ? 0 : first);
      setFinished(ballot.length > 0 && first === -1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  async function cast(r: Race) {
    const optionId = pick[r.race_id];
    if (!optionId || !s) return;
    if (!previewBallot) {
      const who = r.options.find((o) => o.id === optionId)?.name ?? "this candidate";
      if (!confirm(`Lock in your vote for ${who} as ${r.title}? You can't change it.`)) return;
    }
    setBusy(r.race_id);
    setError(null);
    try {
      if (!previewBallot) await post({ action: "cast", raceId: r.race_id, optionId });
      setS({ ...s, voted: [...s.voted, r.race_id] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  const btn = "w-full rounded-2xl py-3.5 text-[16px] font-extrabold disabled:opacity-40";
  const accentBtn = { background: theme.accent, color: theme.onAccent } as const;
  const ghostBtn = { background: "transparent", color: theme.ink, border: `2px solid ${theme.ink}55` } as const;
  const inputCls = "w-full rounded-xl border-2 px-3.5 py-3 text-base";
  const inputStyle = { background: "#fff", color: "#111", borderColor: "rgba(0,0,0,0.15)" } as const;

  const shell = (kicker: string, body: React.ReactNode) => (
    <div className="min-h-screen px-4 pb-10 pt-6" style={theme.page}>
      <div className="mx-auto max-w-xl overflow-hidden rounded-[22px]" style={{ background: theme.paper, boxShadow: "0 24px 60px rgba(0,0,0,0.25)", border: `1px solid ${theme.ink}22` }}>
        <BallotHeader theme={theme} brand={brand} school={school} kicker={kicker} />
        <div className="px-5 pb-6 pt-5" style={{ color: theme.ink }}>{body}</div>
      </div>
      <p className="mt-4 text-center text-[11px]" style={{ color: theme.ink, opacity: 0.6 }}>
        Powered by <a href="https://www.boutcasts.com" className="font-semibold underline">BoutCasts</a>
      </p>
    </div>
  );

  if (!s) {
    return shell(
      "Student ballot",
      <div className="grid gap-4">
        <h1 className="text-[26px] font-extrabold leading-tight">{title}</h1>
        <p className="text-sm" style={{ opacity: 0.75 }}>Enter the personal code your teacher gave you (or emailed to you) and your name as it appears on the class list. You vote once for each office, and results stay hidden until voting closes.</p>
        <form onSubmit={signIn} className="grid gap-3">
          <label className="grid gap-1 text-sm font-semibold">
            Your code
            <input value={code} onChange={(ev) => setCode(ev.target.value.toUpperCase())} maxLength={12} autoComplete="off" autoCapitalize="characters" className={`${inputCls} font-mono text-lg tracking-widest`} style={inputStyle} />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Your first and last name
            <input value={name} onChange={(ev) => setName(ev.target.value)} maxLength={120} autoComplete="off" className={inputCls} style={inputStyle} />
          </label>
          {error && <p className="text-sm font-semibold" style={{ color: theme.danger }}>{error}</p>}
          <button type="submit" disabled={!previewBallot && (busy !== null || !code.trim() || !name.trim())} className={btn} style={accentBtn}>{busy ? "Checking…" : "Start voting"}</button>
        </form>
      </div>,
    );
  }

  const total = s.ballot.length;
  const votedCount = s.ballot.filter((r) => s.voted.includes(r.race_id)).length;
  const allDone = total > 0 && votedCount === total;

  if (finished || total === 0) {
    const missing = s.ballot.map((r, i) => ({ r, i })).filter(({ r }) => !s.voted.includes(r.race_id));
    return shell(
      "Your ballot",
      <div className="grid gap-4">
        <h1 className="text-[26px] font-extrabold leading-tight">{allDone ? "Thank you for voting!" : `Hi ${s.voterName.split(" ")[0]}, almost there`}</h1>
        <p className="text-sm" style={{ opacity: 0.75 }}>
          {allDone
            ? "You've voted for every office. Results are shown when voting closes."
            : `You've voted for ${votedCount} of ${total} offices. You can finish the rest now, or come back later${s.closesAt ? ` until ${new Date(s.closesAt).toLocaleString()}` : ""}.`}
        </p>
        {missing.length > 0 && (
          <ul className="grid gap-2">
            {missing.map(({ r, i }) => (
              <li key={r.race_id} className="flex items-center justify-between gap-3 rounded-xl px-4 py-3" style={{ background: "#fff", color: "#111", border: "1px solid rgba(0,0,0,0.12)" }}>
                <span className="font-bold">{r.title}</span>
                <button type="button" onClick={() => { setFinished(false); setIdx(i); }} className="rounded-full px-4 py-1.5 text-sm font-bold" style={accentBtn}>Vote</button>
              </li>
            ))}
          </ul>
        )}
      </div>,
    );
  }

  const race = s.ballot[idx];
  const voted = s.voted.includes(race.race_id);
  const chosen = pick[race.race_id] ?? null;
  const last = idx === total - 1;
  return shell(
    s.voterName ? `Voting as ${s.voterName}` : "Your ballot",
    <div className="grid gap-4">
      <ProgressBar theme={theme} step={idx + 1} total={total} label={`${votedCount} voted`} />
      <div>
        <h2 className="text-[26px] font-extrabold leading-tight">{race.title}</h2>
        <p className="mt-1 text-sm" style={{ opacity: 0.7 }}>{voted ? "✓ Your vote for this office is in." : "Choose one candidate"}</p>
      </div>
      {error && <p className="text-sm font-semibold" style={{ color: theme.danger }}>{error}</p>}
      <div role="radiogroup" aria-label={race.title} className="grid gap-2.5">
        {race.options.map((o) => (
          <CandidateCard key={o.id} c={o} theme={theme} selected={chosen === o.id} disabled={voted} onSelect={() => setPick({ ...pick, [race.race_id]: o.id })} />
        ))}
      </div>
      <div className="grid gap-2.5">
        {!voted && (
          <button type="button" onClick={() => cast(race)} disabled={!chosen || busy !== null} className={btn} style={accentBtn}>{busy === race.race_id ? "Saving…" : "Lock in my vote"}</button>
        )}
        <div className="flex gap-2.5">
          {idx > 0 && <button type="button" onClick={() => setIdx(idx - 1)} className={btn} style={ghostBtn}>Back</button>}
          <button type="button" onClick={() => (last ? setFinished(true) : setIdx(idx + 1))} className={btn} style={voted ? accentBtn : ghostBtn}>
            {last ? "Finish" : voted ? "Next" : "Skip for now"}
          </button>
        </div>
      </div>
    </div>,
  );
}
