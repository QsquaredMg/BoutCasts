"use client";

import { useCallback, useEffect, useState } from "react";

type Dash = {
  enabled: boolean;
  goalCents: number | null;
  grossCents: number;
  schoolShareCents: number;
  giftCount: number;
  races: { id: string; title: string; candidates: { id: string; name: string; gifts: number; cents: number }[] }[];
};

const money = (c: number) => `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;

// Organizer controls and totals for the school fundraiser attached to an election.
export default function ElectionFundraiserPanel({ id, closed, started }: { id: string; closed: boolean; started: boolean }) {
  const [dash, setDash] = useState<Dash | null>(null);
  const [goal, setGoal] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const box = { borderColor: "var(--border)", background: "var(--surface)" } as const;

  const load = useCallback(async () => {
    const res = await fetch(`/api/school-election/${id}/fundraiser`, { cache: "no-store" });
    if (res.ok) {
      const d = (await res.json()) as Dash;
      setDash(d);
      setGoal((g) => (g === "" && d.goalCents ? String(d.goalCents / 100) : g));
    }
  }, [id]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  async function save(enabled: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/school-election/${id}/fundraiser`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled, goalDollars: goal.trim() === "" ? null : Number(goal) }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Couldn't save.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setBusy(false);
    }
  }

  if (!dash) return null;
  const link = typeof window !== "undefined" ? `${window.location.origin}/school-election/${id}/support` : "";

  return (
    <div className="rounded-xl border p-4" style={box}>
      <p className="font-bold">School fundraiser</p>
      {!dash.enabled ? (
        closed ? (
          <p className="mt-1 text-sm" style={{ color: "var(--text-dim)" }}>No fundraiser was run for this election.</p>
        ) : (
          <>
            <p className="mb-2 mt-1 text-sm" style={{ color: "var(--text-dim)" }}>
              Let families and neighbors give toward the school while they back a candidate. Gifts never count as votes and the winners are decided only by the student ballots. Supporters must confirm they are an adult or have a parent&apos;s permission, and only the school-wide total is shown publicly.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input value={goal} onChange={(e) => setGoal(e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" placeholder="Goal in dollars (optional)" className="w-52 rounded-[10px] border px-3 py-2 text-sm" style={box} />
              <button onClick={() => save(true)} disabled={busy} className="bc-btn-solid rounded-full px-4 py-2 text-sm font-bold disabled:opacity-50">Turn on fundraiser</button>
            </div>
            {!started && <p className="mt-2 text-xs" style={{ color: "var(--text-faint)" }}>The supporter page opens when voting opens.</p>}
          </>
        )
      ) : (
        <div className="mt-2 grid gap-3">
          <div>
            <p className="text-2xl font-extrabold">{money(dash.grossCents)} <span className="text-sm font-semibold" style={{ color: "var(--text-dim)" }}>{dash.goalCents ? `of ${money(dash.goalCents)} goal` : "raised"} · {dash.giftCount} gift{dash.giftCount === 1 ? "" : "s"}</span></p>
            <p className="text-sm" style={{ color: "var(--text-dim)" }}>The school&apos;s share so far: {money(dash.schoolShareCents)}</p>
            {dash.goalCents ? <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}><div className="h-2.5 rounded-full" style={{ width: `${Math.min(100, Math.round((dash.grossCents / dash.goalCents) * 100))}%`, background: "var(--red)" }} /></div> : null}
          </div>
          {!closed && (
            <div className="rounded-lg border p-3" style={{ borderColor: "var(--gold, #a97a12)" }}>
              <p className="text-sm font-bold">Share this link with families</p>
              <p className="mt-1 break-all text-xs">{link}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button onClick={() => { navigator.clipboard?.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="rounded-full border px-3 py-1.5 text-xs font-bold" style={{ borderColor: "var(--border)" }}>{copied ? "Copied" : "Copy link"}</button>
                <button onClick={() => { if (confirm("Turn the fundraiser off? Supporters can no longer give. Gifts already made stay recorded.")) save(false); }} disabled={busy} className="rounded-full border px-3 py-1.5 text-xs font-bold disabled:opacity-50" style={{ borderColor: "var(--border)" }}>Turn off</button>
              </div>
            </div>
          )}
          {dash.races.map((r) => (
            <div key={r.id}>
              <p className="text-sm font-bold">{r.title}</p>
              {r.candidates.map((c) => (
                <div key={c.id} className="mt-0.5 flex justify-between text-sm"><span>{c.name}</span><span>{money(c.cents)} · {c.gifts} gift{c.gifts === 1 ? "" : "s"}</span></div>
              ))}
            </div>
          ))}
          <p className="text-xs" style={{ color: "var(--text-faint)" }}>Only you see these per-candidate amounts. Teachers: this is a good moment to talk about campaign finance and why money shouldn&apos;t decide an election.</p>
        </div>
      )}
      {error && <p className="mt-2 text-sm" style={{ color: "var(--danger)" }}>{error}</p>}
    </div>
  );
}
