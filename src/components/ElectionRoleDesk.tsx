"use client";

import { useCallback, useEffect, useState } from "react";

const edge = { borderColor: "var(--border)", background: "var(--surface)" } as const;
const inputCls = "w-full rounded-[10px] border px-3 py-2 text-sm";

type Item = { id: string; author_label: string; kind: string; topic: string; subject: string; body: string; option_id: string | null; decision: string | null; created_at: string };
type Post = { id: string; author_label: string; kind: string; title: string; body: string; source_url: string | null; status: string; created_at: string };
type FilingRace = { id: string; title: string; candidates: { id: string; name: string; status: string; note: string; clerk: string | null; decision: string | null }[] };

// The Supervisor's desk for student roles: sees the Commission's advice and records the decision, sees the clerk's
// filing checks and decides each candidate, and publishes or hides student press articles. Fact-check flags are shown here too.
export default function ElectionRoleDesk({ id }: { id: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [races, setRaces] = useState<FilingRace[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [c, f, p] = await Promise.all([
      fetch(`/api/school-election/${id}/commission`, { cache: "no-store" }),
      fetch(`/api/school-election/${id}/filings`, { cache: "no-store" }),
      fetch(`/api/school-election/${id}/press?all=1`, { cache: "no-store" }),
    ]);
    if (c.ok) setItems((await c.json()).items);
    if (f.ok) setRaces((await f.json()).races);
    if (p.ok) setPosts((await p.json()).posts);
  }, [id]);
  useEffect(() => { Promise.resolve().then(load).catch(() => {}); }, [load]);

  async function send(path: string, method: string, body: Record<string, unknown>) {
    setErr(null);
    const res = await fetch(`/api/school-election/${id}/${path}`, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { setErr((await res.json().catch(() => ({}))).error ?? "Couldn't save."); return; }
    load();
  }

  const advice = items.filter((i) => i.kind === "advice");
  const minutes = items.filter((i) => i.kind === "minutes");
  const articles = posts.filter((p) => p.kind === "article");
  const flags = posts.filter((p) => p.kind === "claim_flag");
  const anyCandidates = races.some((r) => r.candidates.length > 0);
  if (!anyCandidates && !items.length && !posts.length) return null;

  return (
    <div className="rounded-xl border p-4" style={edge}>
      <p className="font-bold">Student roles: your decisions</p>
      <p className="mb-2 text-xs" style={{ color: "var(--text-faint)" }}>The Commission and the clerk advise. You decide, and your decision shows next to their work.</p>
      {err && <p role="alert" className="mb-2 text-sm font-bold text-red-700">{err}</p>}

      {anyCandidates && (
        <section className="mt-2">
          <p className="text-sm font-bold">Candidate filings</p>
          {races.map((r) => (
            <div key={r.id} className="mt-1">
              <p className="text-xs font-bold">{r.title}</p>
              <ul className="grid gap-1.5">
                {r.candidates.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span>{c.name} <span className="text-xs" style={{ color: "var(--text-faint)" }}>(clerk: {c.status === "complete" ? "complete" : c.status === "incomplete" ? "incomplete" : "not checked"}{c.note ? `, ${c.note}` : ""})</span></span>
                    <select value={c.decision ?? ""} onChange={(e) => send("filings", "PATCH", { optionId: c.id, decision: e.target.value || null })} className="rounded-[10px] border px-2 py-1 text-sm" style={edge} aria-label={`Decision for ${c.name}`}>
                      <option value="">Not decided</option><option value="approved">Approved</option><option value="declined">Declined</option>
                    </select>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {advice.length > 0 && (
        <section className="mt-4">
          <p className="text-sm font-bold">Commission advice</p>
          <ul className="mt-1 grid gap-2">
            {advice.map((i) => (
              <li key={i.id} className="rounded-lg border p-3 text-sm" style={edge}>
                <p className="font-bold">{i.topic}: {i.subject}</p>
                <p className="mt-1 whitespace-pre-wrap">{i.body}</p>
                <p className="mt-1 text-xs" style={{ color: "var(--text-faint)" }}>{i.author_label} · {new Date(i.created_at).toLocaleDateString()}</p>
                <div className="mt-2 flex gap-2">
                  <input value={draft[i.id] ?? i.decision ?? ""} onChange={(e) => setDraft((d) => ({ ...d, [i.id]: e.target.value }))} maxLength={400} placeholder="Your decision" className={inputCls} style={edge} />
                  <button onClick={() => send("commission", "PATCH", { itemId: i.id, decision: draft[i.id] ?? i.decision ?? "" })} className="rounded-full border px-3 py-1.5 text-xs font-bold" style={{ borderColor: "var(--border)" }}>Save</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {minutes.length > 0 && (
        <section className="mt-4">
          <p className="text-sm font-bold">Commission minutes</p>
          <ul className="mt-1 grid gap-1.5">{minutes.map((m) => <li key={m.id} className="text-sm"><b>{m.subject}</b> <span className="text-xs" style={{ color: "var(--text-faint)" }}>({m.author_label})</span><p className="whitespace-pre-wrap">{m.body}</p></li>)}</ul>
        </section>
      )}

      {articles.length > 0 && (
        <section className="mt-4">
          <p className="text-sm font-bold">Student press</p>
          <ul className="mt-1 grid gap-2">
            {articles.map((p) => (
              <li key={p.id} className="rounded-lg border p-3 text-sm" style={edge}>
                <p className="font-bold">{p.title} <span className="text-xs font-normal" style={{ color: "var(--text-faint)" }}>by {p.author_label} · {p.status === "published" ? "published" : p.status === "hidden" ? "not published" : "waiting"}</span></p>
                <p className="mt-1 whitespace-pre-wrap">{p.body}</p>
                {p.source_url && <a href={p.source_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block break-all text-xs underline">{p.source_url}</a>}
                <div className="mt-2 flex gap-2">
                  <button onClick={() => send("press", "PATCH", { postId: p.id, status: "published" })} disabled={p.status === "published"} className="rounded-full bg-[#1b4fe4] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">Publish</button>
                  <button onClick={() => send("press", "PATCH", { postId: p.id, status: "hidden" })} disabled={p.status === "hidden"} className="rounded-full border px-3 py-1.5 text-xs font-bold disabled:opacity-50" style={{ borderColor: "var(--border)" }}>Don&apos;t publish</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {flags.length > 0 && (
        <section className="mt-4">
          <p className="text-sm font-bold">Fact-check flags</p>
          <ul className="mt-1 grid gap-2">{flags.map((p) => (
            <li key={p.id} className="rounded-lg border p-3 text-sm" style={edge}>
              <p className="font-bold">{p.title} <span className="text-xs font-normal" style={{ color: "var(--text-faint)" }}>by {p.author_label}</span></p>
              <p className="mt-1 whitespace-pre-wrap">{p.body}</p>
              {p.source_url && <a href={p.source_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block break-all text-xs underline">{p.source_url}</a>}
            </li>
          ))}</ul>
        </section>
      )}
    </div>
  );
}
