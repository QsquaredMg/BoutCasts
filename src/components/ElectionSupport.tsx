"use client";

import { useState } from "react";

type Props = {
  id: string;
  title: string;
  school: string | null;
  open: boolean;
  thanks: boolean;
  raisedCents: number;
  goalCents: number | null;
  sharePct: number;
  packs: { key: string; cents: number }[];
  races: { id: string; title: string; candidates: { id: string; name: string }[] }[];
};

const money = (c: number) => `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;

export default function ElectionSupport({ id, title, school, open, thanks, raisedCents, goalCents, sharePct, packs, races }: Props) {
  const [adult, setAdult] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const box = { borderColor: "var(--border)", background: "var(--surface)" } as const;
  const pct = goalCents ? Math.min(100, Math.round((raisedCents / goalCents) * 100)) : null;

  async function give(optionId: string, pack: string) {
    setError(null);
    if (!adult) return setError("Please confirm you are an adult, or have a parent or guardian's permission.");
    setBusy(optionId + pack);
    try {
      const res = await fetch(`/api/school-election/${id}/support`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ optionId, pack, adult }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.url) throw new Error(body.error || "Something went wrong.");
      window.location.assign(body.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>{school ?? "School fundraiser"}</p>
        <h1 className="text-3xl font-extrabold">Support {title}</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-dim)" }}>
          Back a candidate&apos;s campaign and help the school at the same time. {sharePct}% of every gift goes to the school. Gifts never count as votes: only students at the booth decide the winners.
        </p>
      </div>

      {thanks && <p className="rounded-lg border p-3 text-sm font-semibold" style={box}>Thank you! Your gift is on its way to the school.</p>}

      <div className="rounded-xl border p-4" style={box}>
        <p className="text-2xl font-extrabold">{money(raisedCents)} <span className="text-sm font-semibold" style={{ color: "var(--text-dim)" }}>{goalCents ? `raised of ${money(goalCents)}` : "raised"}</span></p>
        {pct != null && (
          <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}>
            <div className="h-2.5 rounded-full" style={{ width: `${pct}%`, background: "var(--red)" }} />
          </div>
        )}
      </div>

      {!open ? (
        <p className="rounded-lg border p-3 text-sm" style={box}>Voting has closed, so the fundraiser is finished. Thank you to everyone who gave.</p>
      ) : (
        <>
          <label className="flex items-start gap-2 rounded-xl border p-4 text-sm" style={box}>
            <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} className="mt-1" />
            <span><span className="font-semibold">I am an adult, or I have a parent or guardian&apos;s permission to give.</span> <span style={{ color: "var(--text-faint)" }}>Students under 18 should ask a parent or guardian to make the gift.</span></span>
          </label>
          {error && <p className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>}
          {races.map((r) => (
            <div key={r.id} className="rounded-xl border p-4" style={box}>
              <p className="font-bold">{r.title}</p>
              <ul className="mt-2 grid gap-3">
                {r.candidates.map((c) => (
                  <li key={c.id}>
                    <p className="text-sm font-semibold">{c.name}</p>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {packs.map((p) => (
                        <button key={p.key} onClick={() => give(c.id, p.key)} disabled={busy !== null} className="rounded-full border px-4 py-1.5 text-sm font-bold disabled:opacity-50" style={{ borderColor: "var(--border)" }}>
                          {busy === c.id + p.key ? "Opening…" : `Give ${money(p.cents)}`}
                        </button>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
