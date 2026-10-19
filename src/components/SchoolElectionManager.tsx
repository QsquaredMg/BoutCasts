"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LIVE_VOTE_TIERS } from "@/lib/liveVoteEvents/tiers";

type Option = { id: string; name: string; description: string | null; votes: number | null; winner?: boolean };
type Data = {
  viewerIsAdmin?: boolean;
  election: { id: string; title: string; school_name: string | null; tier: "free" | "small" | "medium" | "large"; kiosks: number; days: number; price_cents: number; show_tally?: boolean; status: "draft" | "live" | "closed"; starts_at: string | null; closes_at: string | null };
  closed: boolean;
  turnout: { total: number; voted: number };
  kiosks: { id: string; label: string; created_at: string; locked_until: string | null }[];
  races: { id: string; title: string; options: Option[] }[];
};

const money = (c: number) => `$${(c / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

// Minimal CSV/line parser: "Name" or "Name, ID" per line; a header row of Name/ID is skipped.
function parseRoster(text: string): { name: string; ref: string | null }[] {
  const rows: { name: string; ref: string | null }[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const cells = line.match(/("([^"]|"")*"|[^,]*)(,|$)/g)?.map((c) => c.replace(/,$/, "").replace(/^"|"$/g, "").replace(/""/g, '"').trim()) ?? [line];
    const [name, ref] = cells;
    if (!name || /^(student )?name$/i.test(name)) continue;
    rows.push({ name, ref: ref || null });
  }
  return rows;
}

export default function SchoolElectionManager({ id, checkout }: { id: string; checkout: string | null }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(checkout === "success" ? "Payment received. Your election goes live within a moment. Refresh if it still says draft." : null);
  const [busy, setBusy] = useState<string | null>(null);
  const [paste, setPaste] = useState("");
  const [newLink, setNewLink] = useState<{ label: string; url: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [staff, setStaff] = useState<{ id: string; label: string }[]>([]);
  const [staffName, setStaffName] = useState("");
  const [newStaff, setNewStaff] = useState<{ label: string; code: string } | null>(null);
  const loadStaff = useCallback(async () => {
    const res = await fetch(`/api/school-election/${id}/staff`, { cache: "no-store" });
    if (res.ok) setStaff((await res.json()).staff);
  }, [id]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadStaff();
  }, [loadStaff]);

  const load = useCallback(async () => {
    const res = await fetch(`/api/school-election/${id}`, { cache: "no-store" });
    if (!res.ok) return setError(res.status === 401 ? "Sign in as the organizer to manage this election." : "Election not found.");
    setError(null);
    setData(await res.json());
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [load]);

  async function call(label: string, url: string, init?: RequestInit) {
    setBusy(label);
    setError(null);
    try {
      const res = await fetch(url, init);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Something went wrong.");
      return body;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function addRoster(text: string) {
    const voters = parseRoster(text);
    if (!voters.length) return setError("No student names found.");
    const r = await call("roster", `/api/school-election/${id}/roster`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ voters }) });
    if (r) {
      setPaste("");
      setNotice(`Added ${r.added} student${r.added === 1 ? "" : "s"}.`);
      load();
    }
  }

  async function pay() {
    const r = await call("pay", `/api/school-election/${id}/checkout`, { method: "POST" });
    if (r?.url) window.location.assign(r.url);
  }

  async function comp() {
    if (!confirm("Open voting with no charge? Use for partner schools, grants and pilots.")) return;
    const r = await call("comp", `/api/school-election/${id}/checkout`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ comp: true }) });
    if (r?.url) window.location.assign(r.url);
  }

  async function pair() {
    const r = await call("kiosk", `/api/school-election/${id}/kiosks`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    if (r) {
      setNewLink(r);
      load();
    }
  }

  async function downloadCodes() {
    const res = await fetch(`/api/school-election/${id}/voters`, { cache: "no-store" });
    if (!res.ok) return setError("Couldn't load the roster.");
    const { voters } = (await res.json()) as { voters: { name: string; student_ref: string | null; code: string; voted_at: string | null }[] };
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const body = ["Name,Student ID,Code,Voted", ...voters.map((v) => [esc(v.name), esc(v.student_ref ?? ""), v.code, v.voted_at ? "yes" : "no"].join(","))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([body], { type: "text/csv" }));
    a.download = "election-roster-codes.csv";
    a.click();
  }

  if (error && !data) return <p className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>;
  if (!data) return <p className="text-sm">Loading…</p>;

  const { election: e, closed, turnout, kiosks, races } = data;
  const box = { borderColor: "var(--border)", background: "var(--surface)" } as const;
  const status = closed ? "Closed" : e.status === "live" ? "Live" : "Draft";
  const tier = LIVE_VOTE_TIERS[e.tier];

  return (
    <div className="grid gap-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>{e.school_name ?? "School election"} · {status}</p>
        <h1 className="text-3xl font-extrabold">{e.title}</h1>
        <p className="text-sm" style={{ color: "var(--text-dim)" }}>
          {tier.label} (up to {tier.voteCap.toLocaleString()} students) · {e.kiosks} kiosk{e.kiosks === 1 ? "" : "s"} · {e.tier === "free" && e.days === 1 ? "12 hours" : `${e.days} day${e.days === 1 ? "" : "s"}`} · {e.price_cents ? money(e.price_cents) : "Free"}
          {e.closes_at && !closed && ` · closes ${new Date(e.closes_at).toLocaleString()}`}
        </p>
      </div>

      {notice && <p className="rounded-lg border p-3 text-sm" style={box}>{notice}</p>}
      {error && <p className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>}

      {e.status === "draft" && (
        <div className="rounded-xl border p-4" style={box}>
          <p className="font-bold">Ready to start?</p>
          <p className="mb-3 text-sm" style={{ color: "var(--text-dim)" }}>Add your student roster below, then {e.price_cents === 0 ? "open voting" : `pay ${money(e.price_cents)} to open voting`} for {e.days} day{e.days === 1 ? "" : "s"}. Pair your iPads before or after paying.</p>
          <button onClick={pay} disabled={busy !== null || turnout.total === 0} className="bc-btn-solid rounded-full px-5 py-2.5 text-sm font-bold disabled:opacity-50">
            {busy === "pay" ? "Starting…" : e.price_cents === 0 ? "Open voting (free)" : `Pay ${money(e.price_cents)} and open voting`}
          </button>
          {data.viewerIsAdmin && e.price_cents > 0 && (
            <button onClick={comp} disabled={busy !== null || turnout.total === 0} className="ml-2 rounded-full border px-5 py-2.5 text-sm font-bold disabled:opacity-50" style={{ borderColor: "var(--border)" }}>Open with no charge (admin)</button>
          )}
          {turnout.total === 0 && <p className="mt-2 text-xs" style={{ color: "var(--text-faint)" }}>Add at least one student first.</p>}
        </div>
      )}

      <div className="rounded-xl border p-4" style={box}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-bold">Roster and turnout</p>
          <p className="text-sm" style={{ color: "var(--text-dim)" }}>{turnout.voted.toLocaleString()} of {turnout.total.toLocaleString()} voted</p>
        </div>
        {!closed && (
          <>
            <p className="mb-2 mt-1 text-xs" style={{ color: "var(--text-faint)" }}>One student per line: &quot;Name&quot; or &quot;Name, Student ID&quot;. Each gets a random 6-character code a teacher hands out at the booth.</p>
            <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={4} placeholder={"Jordan Smith, 1042\nAvery Johnson, 1043"} className="w-full rounded-[10px] border px-3 py-2 text-sm" style={box} />
            <div className="mt-2 flex flex-wrap gap-2">
              <button onClick={() => addRoster(paste)} disabled={busy !== null || !paste.trim()} className="bc-btn-solid rounded-full px-4 py-2 text-sm font-bold disabled:opacity-50">Add students</button>
              <button onClick={() => fileRef.current?.click()} className="rounded-full border px-4 py-2 text-sm font-bold" style={{ borderColor: "var(--border)" }}>Upload CSV</button>
              <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={async (ev) => { const f = ev.target.files?.[0]; if (f) addRoster(await f.text()); ev.target.value = ""; }} />
              {turnout.total > 0 && (
                <button onClick={async () => { if (confirm("Remove every student who has not voted yet?")) { await call("clear", `/api/school-election/${id}/roster`, { method: "DELETE" }); load(); } }} className="rounded-full border px-4 py-2 text-sm font-bold" style={{ borderColor: "var(--border)" }}>Clear roster</button>
              )}
            </div>
          </>
        )}
        {turnout.total > 0 && (
          <div className="mt-3 flex flex-wrap gap-3 text-sm font-bold">
            <Link href={`/school-election/${id}/desk`} className="underline">Open the booth desk (teachers)</Link>
            <button onClick={downloadCodes} className="underline">Download roster with codes</button>
          </div>
        )}
      </div>

      <div className="rounded-xl border p-4" style={box}>
        <p className="font-bold">Kiosks ({kiosks.length} of {e.kiosks})</p>
        <p className="mb-2 text-xs" style={{ color: "var(--text-faint)" }}>Open a kiosk link on an iPad, then turn on Guided Access (Settings, Accessibility) so students can&apos;t leave the page. A hotspot works if school Wi-Fi is slow. Before voting starts, have a teacher tap Teacher, enter the PIN and choose Get ready for offline on each iPad so students can still vote if the Wi-Fi drops.</p>
        <ul className="grid gap-1.5">
          {kiosks.map((k) => (
            <li key={k.id} className="flex items-center justify-between gap-2 text-sm">
              <span>{k.label}{k.locked_until && new Date(k.locked_until) > new Date() ? " · locked" : ""}</span>
              {!closed && <button onClick={async () => { if (confirm(`Remove ${k.label}? Its link stops working.`)) { await call("rm", `/api/school-election/${id}/kiosks?kioskId=${k.id}`, { method: "DELETE" }); load(); } }} className="text-xs font-bold underline">Remove</button>}
            </li>
          ))}
        </ul>
        {!closed && kiosks.length < e.kiosks && (
          <button onClick={pair} disabled={busy !== null} className="mt-2 rounded-full border px-4 py-2 text-sm font-bold" style={{ borderColor: "var(--border)" }}>{busy === "kiosk" ? "Pairing…" : "Pair an iPad"}</button>
        )}
        {newLink && (
          <div className="mt-3 rounded-lg border p-3" style={{ borderColor: "var(--gold, #a97a12)" }}>
            <p className="text-sm font-bold">{newLink.label}: open this link on the iPad</p>
            <p className="mt-1 break-all text-xs">{newLink.url}</p>
            <p className="mt-1 text-xs" style={{ color: "var(--text-faint)" }}>This link is shown once. Anyone with it can open the kiosk screen (they still need a student&apos;s code to vote).</p>
            <button onClick={() => navigator.clipboard?.writeText(newLink.url)} className="mt-2 rounded-full border px-3 py-1.5 text-xs font-bold" style={{ borderColor: "var(--border)" }}>Copy link</button>
          </div>
        )}
      </div>

      <div className="rounded-xl border p-4" style={box}>
        <p className="font-bold">Staff seats (optional)</p>
        <p className="mb-2 text-xs" style={{ color: "var(--text-faint)" }}>Give a teacher a code to open the booth desk without your login. Codes only show the roster check-in, nothing else.</p>
        <ul className="grid gap-1.5">
          {staff.map((m) => (
            <li key={m.id} className="flex items-center justify-between text-sm">
              <span>{m.label}</span>
              <button onClick={async () => { await call("rmstaff", `/api/school-election/${id}/staff?staffId=${m.id}`, { method: "DELETE" }); loadStaff(); }} className="text-xs font-bold underline">Revoke</button>
            </li>
          ))}
        </ul>
        {!closed && (
          <div className="mt-2 flex gap-2">
            <input value={staffName} onChange={(ev) => setStaffName(ev.target.value)} maxLength={60} placeholder="Teacher name" className="min-w-0 flex-1 rounded-[10px] border px-3 py-2 text-sm" style={box} />
            <button disabled={busy !== null || !staffName.trim()} onClick={async () => { const r = await call("staff", `/api/school-election/${id}/staff`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: staffName }) }); if (r) { setNewStaff(r); setStaffName(""); loadStaff(); } }} className="rounded-full border px-4 py-2 text-sm font-bold disabled:opacity-50" style={{ borderColor: "var(--border)" }}>Add seat</button>
          </div>
        )}
        {newStaff && (
          <div className="mt-3 rounded-lg border p-3" style={{ borderColor: "var(--gold, #a97a12)" }}>
            <p className="text-sm font-bold">{newStaff.label}&apos;s desk code</p>
            <p className="mt-1 text-2xl font-black tracking-[0.2em]">{newStaff.code}</p>
            <p className="mt-1 text-xs" style={{ color: "var(--text-faint)" }}>Shown once. They enter it at the booth desk page: /school-election/{id}/desk</p>
          </div>
        )}
      </div>

      <div className="rounded-xl border p-4" style={box}>
        <p className="font-bold">Results</p>
        {!closed ? (
          <>
            <p className="mb-3 mt-1 text-sm" style={{ color: "var(--text-dim)" }}>Hidden until voting closes, for everyone. You can see turnout above, but not who is winning. Before you announce winners, check that every iPad shows &ldquo;0 waiting to send&rdquo;.</p>
            {e.status === "live" && (
              <button onClick={async () => { if (confirm("Close voting now? Students will no longer be able to vote and results become visible.")) { await call("close", `/api/school-election/${id}/close`, { method: "POST" }); load(); } }} disabled={busy !== null} className="rounded-full border px-4 py-2 text-sm font-bold" style={{ borderColor: "var(--border)" }}>Close voting now</button>
            )}
          </>
        ) : (
          <div className="mt-2 grid gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <a href={`/api/school-election/${id}/graphic`} target="_blank" rel="noreferrer" className="bc-btn-solid rounded-full px-4 py-2 text-sm font-bold">View winners graphic</a>
              <a href={`/api/school-election/${id}/graphic`} download="winners.png" className="rounded-full border px-4 py-2 text-sm font-bold" style={{ borderColor: "var(--border)" }}>Download</a>
            </div>
            {races.map((r) => {
              const total = r.options.reduce((s, o) => s + (o.votes ?? 0), 0);
              return (
                <div key={r.id}>
                  <p className="text-sm font-bold">{r.title}</p>
                  {r.options.map((o) => (
                    <div key={o.id} className="mt-1.5">
                      <div className="flex justify-between text-sm"><span className={o.winner ? "font-bold" : ""}>{o.name}{o.winner ? " ★ Winner" : ""}</span>{o.votes != null && <span>{o.votes}</span>}</div>
                      {o.votes != null && <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}><div className="h-2 rounded-full" style={{ width: `${total ? (o.votes / total) * 100 : 0}%`, background: "var(--red)" }} /></div>}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-xl border p-4" style={box}>
        <p className="font-bold">Ballot</p>
        <ul className="mt-1 grid gap-0.5 text-sm" style={{ color: "var(--text-dim)" }}>
          {races.map((r) => <li key={r.id}>{r.title}: {r.options.map((o) => o.name).join(", ")}</li>)}
        </ul>
      </div>
    </div>
  );
}
