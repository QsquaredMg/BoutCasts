"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ROLES, roleByKey } from "@/lib/electionRoles";
import RoleTools, { ROLES_WITH_TOOLS } from "@/components/RoleTools";

// A student's role screen: sign in with the role code, then see the job, the limits, the mini lesson and a checklist.
export default function RoleStation({ id }: { id: string }) {
  const storeKey = `role-seat:${id}`;
  const [code, setCode] = useState("");
  const [seat, setSeat] = useState<{ label: string; role: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState<Record<number, boolean>>({});

  async function signIn(c: string) {
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/school-election/${id}/role`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: c }) });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setErr(body.error ?? "That code didn't work.");
      try { sessionStorage.removeItem(storeKey); } catch { /* ignore */ }
      return false;
    }
    try {
      sessionStorage.setItem(storeKey, c);
      // Booth roles reuse the same code at the desk page.
      if (roleByKey(body.role)?.tool === "desk" || roleByKey(body.role)?.tool === "debate") sessionStorage.setItem(`desk-code:${id}`, c);
    } catch { /* ignore */ }
    setSeat({ label: body.label, role: body.role });
    return true;
  }

  useEffect(() => {
    let saved = "";
    try { saved = sessionStorage.getItem(storeKey) ?? ""; } catch { /* ignore */ }
    if (saved) Promise.resolve().then(() => signIn(saved)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const def = seat ? roleByKey(seat.role) : null;
  const card = "rounded-xl border bg-white p-4 shadow-sm";
  const edge = { borderColor: "var(--border)" } as const;

  if (!seat || !def) {
    return (
      <div className={card} style={edge}>
        <h1 className="text-xl font-black">Your election role</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-faint)" }}>Enter the code your teacher gave you.</p>
        <form onSubmit={(ev) => { ev.preventDefault(); if (code.trim()) signIn(code.trim().toUpperCase()); }} className="mt-3 flex gap-2">
          <input value={code} onChange={(ev) => setCode(ev.target.value.toUpperCase())} maxLength={20} autoCapitalize="characters" autoComplete="off" placeholder="Role code" className="min-w-0 flex-1 rounded-[10px] border px-3 py-2 text-lg font-bold tracking-[0.15em]" style={edge} aria-label="Role code" />
          <button disabled={busy || !code.trim()} className="rounded-full bg-[#1b4fe4] px-5 py-2 text-sm font-bold text-white disabled:opacity-50">Go</button>
        </form>
        {err && <p role="alert" className="mt-2 text-sm font-bold text-red-700">{err}</p>}
      </div>
    );
  }

  const steps = [...def.can.map((c) => `I know I can: ${c.toLowerCase()}`), `I know I cannot: ${def.cannot[0]?.toLowerCase() ?? "go beyond my role"}`, "I will keep every vote private", "I will tell my teacher about anything that seems wrong"];

  return (
    <div className="grid gap-3">
      <div className={card} style={edge}>
        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-faint)" }}>{def.group}</p>
        <h1 className="text-2xl font-black">{def.label}</h1>
        <p className="text-sm" style={{ color: "var(--text-faint)" }}>Signed in as {seat.label}</p>
        {def.tool === "desk" && (
          <Link href={`/school-election/${id}/desk`} className="mt-3 inline-block rounded-full bg-[#1b4fe4] px-5 py-2 text-sm font-bold text-white">Open the booth desk</Link>
        )}
        {def.tool === "debate" && (
          <Link href={`/school-election/${id}/debate`} className="mt-3 inline-block rounded-full bg-[#1b4fe4] px-5 py-2 text-sm font-bold text-white">Open the debate timer and questions</Link>
        )}
        {def.tool === "station" && !ROLES_WITH_TOOLS.includes(def.key) && (
          <p className="mt-3 rounded-lg bg-[#f4f6fb] p-3 text-sm">Your working tools for this role are being added. For now, read your lesson and checklist below, and follow your teacher&apos;s lead.</p>
        )}
      </div>

      {(def.key === "candidate" || def.key === "campaign_manager") && (
        <p className="mt-3 text-sm"><a href="/school-election/packet" target="_blank" rel="noreferrer" className="font-bold underline">Open your candidate packet (survey guide, field notes, fundraising guide)</a></p>
      )}
      {ROLES_WITH_TOOLS.includes(def.key) && <RoleTools id={id} role={def.key} code={(() => { try { return sessionStorage.getItem(storeKey) ?? ""; } catch { return ""; } })()} />}

      <div className={card} style={edge}>
        <h2 className="font-black">Mini lesson</h2>
        <p className="mt-2 text-sm"><b>Why it matters.</b> {def.lesson.why}</p>
        <p className="mt-2 text-sm"><b>Your job.</b> {def.lesson.job}</p>
        <p className="mt-2 text-sm"><b>Try it.</b> {def.lesson.tryIt}</p>
      </div>

      <div className={card} style={edge}>
        <h2 className="font-black">What you can do</h2>
        <ul className="mt-1 list-disc pl-5 text-sm">{def.can.map((c) => <li key={c}>{c}</li>)}</ul>
        <h2 className="mt-3 font-black">What you cannot do</h2>
        <ul className="mt-1 list-disc pl-5 text-sm">{def.cannot.map((c) => <li key={c}>{c}</li>)}</ul>
      </div>

      <div className={card} style={edge}>
        <h2 className="font-black">Your checklist</h2>
        <ul className="mt-2 grid gap-2">
          {steps.map((s, i) => (
            <li key={s}>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={!!checked[i]} onChange={() => setChecked((c) => ({ ...c, [i]: !c[i] }))} className="mt-0.5 h-4 w-4" />
                <span>{s}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>
      <p className="text-center text-xs" style={{ color: "var(--text-faint)" }}>{ROLES.length} roles make this election work. Yours matters.</p>
    </div>
  );
}
