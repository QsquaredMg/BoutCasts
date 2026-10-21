"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ElectionIncidentLog from "@/components/ElectionIncidentLog";

type Voter = { id: string; name: string; student_ref: string | null; code: string; voted_at: string | null; registered_at?: string | null };

// Teacher check-in desk: find a student, read out or hand over their code. Shows whether they have voted,
// never how. Signed-in organizer only (the roster API enforces it).
export default function BoothDesk({ id }: { id: string }) {
  const [voters, setVoters] = useState<Voter[] | null>(null);
  const [requireReg, setRequireReg] = useState(false);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [needCode, setNeedCode] = useState(false);
  const [logOnly, setLogOnly] = useState(false);
  const [deskCode, setDeskCode] = useState<string | undefined>(undefined);
  const [codeInput, setCodeInput] = useState("");
  const storeKey = `desk-code:${id}`;


  const load = useCallback(async () => {
    let code = "";
    try { code = sessionStorage.getItem(storeKey) ?? ""; } catch { /* ignore */ }
    setDeskCode(code || undefined);
    const res = await fetch(`/api/school-election/${id}/voters`, { cache: "no-store", headers: code ? { "x-desk-code": code } : {} });
    if (res.status === 403) {
      // An observer seat: no roster, incident log only.
      setNeedCode(false);
      setError(null);
      setLogOnly(true);
      return;
    }
    if (!res.ok) {
      if (res.status === 401 || res.status === 404) {
        setNeedCode(true);
        setError(code ? "That staff code isn't valid." : null);
        try { sessionStorage.removeItem(storeKey); } catch { /* ignore */ }
      } else setError("Couldn't load the roster.");
      return;
    }
    setNeedCode(false);
    setError(null);
    const body = await res.json();
    setVoters(body.voters);
    setRequireReg(!!body.requireRegistration);
  }, [id, storeKey]);

  async function register(voterId: string) {
    let code = "";
    try { code = sessionStorage.getItem(storeKey) ?? ""; } catch { /* ignore */ }
    const res = await fetch(`/api/school-election/${id}/voters/register`, { method: "POST", headers: { "Content-Type": "application/json", ...(code ? { "x-desk-code": code } : {}) }, body: JSON.stringify({ voterId }) });
    if (!res.ok) setError("Couldn't register that student.");
    else load();
  }

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
        <h1 className="text-2xl font-extrabold">Booth desk</h1>
        <p className="text-sm" style={{ color: "var(--text-dim)" }}>Enter your staff code, or sign in as the organizer.</p>
        <input autoFocus value={codeInput} onChange={(e) => setCodeInput(e.target.value.toUpperCase())} autoCapitalize="characters" autoComplete="off" className="rounded-[10px] border px-4 py-3 text-center text-xl font-black tracking-[0.2em]" style={{ borderColor: "var(--border)", background: "var(--surface)" }} aria-label="Staff code" />
        {error && <p className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>}
        <button type="submit" disabled={!codeInput.trim()} className="bc-btn-solid rounded-full px-5 py-2.5 text-sm font-bold disabled:opacity-50">Open desk</button>
        <Link href={`/login?next=${encodeURIComponent(`/school-election/${id}/desk`)}`} className="text-center text-sm underline">Sign in as organizer</Link>
      </form>
    );
  }

  if (logOnly) {
    return (
      <div>
        <h1 className="mb-3 text-2xl font-extrabold">Observer log</h1>
        <ElectionIncidentLog id={id} deskCode={deskCode} />
      </div>
    );
  }

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
            ) : requireReg && !v.registered_at ? (
              <button onClick={() => register(v.id)} className="bc-btn-solid rounded-full px-4 py-2 text-sm font-bold">Register to vote</button>
            ) : (
              <span className="text-3xl font-black tracking-[0.2em]" aria-label={`Code ${v.code.split("").join(" ")}`}>{v.code}</span>
            )}
          </li>
        ))}
        {voters && shown.length === 0 && <li className="text-sm" style={{ color: "var(--text-dim)" }}>No student matches.</li>}
      </ul>
      <p className="mt-4 text-xs" style={{ color: "var(--text-faint)" }}>
        Check a student&apos;s ID before registering them or handing over a code. When registration is required, only registered students can vote. A code works once. Codes for students who already voted are hidden.
      </p>
      <div className="mt-6"><ElectionIncidentLog id={id} deskCode={deskCode} /></div>
    </div>
  );
}
