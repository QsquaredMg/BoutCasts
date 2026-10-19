"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Voter = { id: string; name: string; student_ref: string | null; code: string; voted_at: string | null };

// Teacher check-in desk: find a student, read out or hand over their code. Shows whether they have voted,
// never how. Signed-in organizer only (the roster API enforces it).
export default function BoothDesk({ id }: { id: string }) {
  const [voters, setVoters] = useState<Voter[] | null>(null);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/school-election/${id}/voters`, { cache: "no-store" });
    if (!res.ok) {
      setError(res.status === 401 ? "Sign in as the election organizer to use the booth desk." : "Couldn't load the roster.");
      return;
    }
    setError(null);
    setVoters((await res.json()).voters);
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!voters) return [];
    if (!needle) return voters.slice(0, 20);
    return voters.filter((v) => v.name.toLowerCase().includes(needle) || (v.student_ref ?? "").toLowerCase().includes(needle)).slice(0, 30);
  }, [voters, q]);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Booth desk</h1>
        <Link href={`/school-election/${id}`} className="text-sm font-bold underline">Back to election</Link>
      </div>
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Type a student's name"
        className="w-full rounded-[10px] border px-4 py-3 text-lg"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      />
      {error && <p className="mt-3 text-sm" style={{ color: "var(--danger)" }}>{error}</p>}
      {!voters && !error && <p className="mt-3 text-sm">Loading…</p>}
      <ul className="mt-3 grid gap-2">
        {shown.map((v) => (
          <li key={v.id} className="flex items-center justify-between gap-3 rounded-xl border px-4 py-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <div>
              <p className="font-bold">{v.name}</p>
              {v.student_ref && <p className="text-xs" style={{ color: "var(--text-faint)" }}>ID {v.student_ref}</p>}
            </div>
            {v.voted_at ? (
              <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: "var(--surface-2)", color: "var(--text-dim)" }}>Voted</span>
            ) : (
              <span className="text-3xl font-black tracking-[0.2em]" aria-label={`Code ${v.code.split("").join(" ")}`}>{v.code}</span>
            )}
          </li>
        ))}
        {voters && shown.length === 0 && <li className="text-sm" style={{ color: "var(--text-dim)" }}>No student matches.</li>}
      </ul>
      <p className="mt-4 text-xs" style={{ color: "var(--text-faint)" }}>
        Check a student&apos;s ID before handing over a code. A code works once. Codes for students who already voted are hidden.
      </p>
    </div>
  );
}
