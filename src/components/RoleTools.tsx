"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import SurveyResults from "@/components/SurveyResults";

// Working tools for the before-voting student roles. Every call sends the seat code; the server decides what the seat may do.

const edge = { borderColor: "var(--border)" } as const;
const card = "rounded-xl border bg-white p-4 shadow-sm";
const input = "w-full rounded-[10px] border px-3 py-2 text-sm";
const btn = "rounded-full bg-[#1b4fe4] px-4 py-2 text-sm font-bold text-white disabled:opacity-50";

function useSeatApi(id: string, code: string) {
  return useCallback(
    async (path: string, init?: RequestInit) => {
      const res = await fetch(`/api/school-election/${id}/${path}`, { ...init, cache: "no-store", headers: { "Content-Type": "application/json", "x-desk-code": code, ...(init?.headers ?? {}) } });
      const body = await res.json().catch(() => ({}));
      return { ok: res.ok, body } as { ok: boolean; body: Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
    },
    [id, code],
  );
}

type Candidate = { id: string; name: string; office: string };

function CommissionTool({ id, code, role }: { id: string; code: string; role: string }) {
  const api = useSeatApi(id, code);
  const [items, setItems] = useState<{ id: string; author_label: string; kind: string; topic: string; subject: string; body: string; decision: string | null; created_at: string }[]>([]);
  const [cands, setCands] = useState<Candidate[]>([]);
  const [kind, setKind] = useState<"advice" | "minutes">("advice");
  const [topic, setTopic] = useState("eligibility");
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");
  const [optionId, setOptionId] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const canMinutes = role === "commission_secretary" || role === "commission_chair";

  const load = useCallback(async () => {
    const r = await api("commission");
    if (r.ok) { setItems(r.body.items); setCands(r.body.candidates); }
  }, [api]);
  useEffect(() => { Promise.resolve().then(load).catch(() => {}); }, [load]);

  async function send() {
    setMsg(null);
    const r = await api("commission", { method: "POST", body: JSON.stringify({ kind, topic, subject, body: text, optionId: optionId || undefined }) });
    if (!r.ok) { setMsg(r.body.error ?? "Couldn't save."); return; }
    setSubject(""); setText(""); load();
  }

  return (
    <div className={card} style={edge}>
      <h2 className="font-black">Commission desk</h2>
      <p className="text-xs" style={{ color: "var(--text-faint)" }}>You advise the Supervisor. The Supervisor decides, and the decision shows beside your advice.</p>
      <div className="mt-3 grid gap-2">
        <div className="flex gap-2">
          <select value={kind} onChange={(e) => setKind(e.target.value as "advice" | "minutes")} className={input} style={edge} aria-label="Type">
            <option value="advice">Advice</option>
            {canMinutes && <option value="minutes">Minutes</option>}
          </select>
          {kind === "advice" && (
            <select value={topic} onChange={(e) => setTopic(e.target.value)} className={input} style={edge} aria-label="Topic">
              <option value="eligibility">Eligibility</option><option value="calendar">Calendar</option><option value="dispute">Dispute</option><option value="other">Other</option>
            </select>
          )}
        </div>
        {kind === "advice" && (
          <select value={optionId} onChange={(e) => setOptionId(e.target.value)} className={input} style={edge} aria-label="About candidate">
            <option value="">About: the whole election</option>
            {cands.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.office})</option>)}
          </select>
        )}
        <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120} placeholder={kind === "minutes" ? "Meeting date and topic" : "Subject"} className={input} style={edge} />
        <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={1500} rows={4} placeholder={kind === "minutes" ? "Who spoke, what was decided, what is next" : "Your advice and why"} className={input} style={edge} />
        <button onClick={send} disabled={!subject.trim() || !text.trim()} className={btn}>Save {kind}</button>
        {msg && <p role="alert" className="text-sm font-bold text-red-700">{msg}</p>}
      </div>
      <ul className="mt-4 grid gap-2">
        {items.map((i) => (
          <li key={i.id} className="rounded-lg bg-[#f4f6fb] p-3 text-sm">
            <p className="font-bold">{i.kind === "minutes" ? "Minutes" : `Advice: ${i.topic}`} · {i.subject}</p>
            <p className="mt-1 whitespace-pre-wrap">{i.body}</p>
            <p className="mt-1 text-xs" style={{ color: "var(--text-faint)" }}>{i.author_label} · {new Date(i.created_at).toLocaleDateString()}</p>
            {i.kind === "advice" && <p className="mt-1 text-xs font-bold">{i.decision ? `Supervisor's decision: ${i.decision}` : "Waiting for the Supervisor's decision"}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ClerkTool({ id, code, role }: { id: string; code: string; role: string }) {
  const api = useSeatApi(id, code);
  type Row = { id: string; name: string; status: string; note: string; clerk: string | null; decision: string | null };
  const [races, setRaces] = useState<{ id: string; title: string; candidates: Row[] }[]>([]);
  const [draft, setDraft] = useState<Record<string, { status: string; note: string }>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const clerk = role === "qualification_clerk";

  const load = useCallback(async () => {
    const r = await api("filings");
    if (r.ok) setRaces(r.body.races);
  }, [api]);
  useEffect(() => { Promise.resolve().then(load).catch(() => {}); }, [load]);

  async function save(c: Row) {
    const d = draft[c.id] ?? { status: c.status, note: c.note };
    const r = await api("filings", { method: "PUT", body: JSON.stringify({ optionId: c.id, status: d.status, note: d.note }) });
    setMsg(r.ok ? "Saved." : r.body.error ?? "Couldn't save.");
    if (r.ok) load();
  }

  return (
    <div className={card} style={edge}>
      <h2 className="font-black">Filing checks</h2>
      <p className="text-xs" style={{ color: "var(--text-faint)" }}>{clerk ? "Check each filing against the written requirements only. In your note, name the rule. The Supervisor makes the final call." : "The clerk's checks. The Supervisor makes the final call."}</p>
      {races.map((r) => (
        <div key={r.id} className="mt-3">
          <p className="text-sm font-bold">{r.title}</p>
          <ul className="mt-1 grid gap-2">
            {r.candidates.map((c) => {
              const d = draft[c.id] ?? { status: c.status, note: c.note };
              return (
                <li key={c.id} className="rounded-lg bg-[#f4f6fb] p-3 text-sm">
                  <p className="font-bold">{c.name} <span className="text-xs font-normal" style={{ color: "var(--text-faint)" }}>{c.decision ? `Supervisor: ${c.decision}` : "Supervisor: not decided"}</span></p>
                  {clerk ? (
                    <div className="mt-2 grid gap-2">
                      <select value={d.status} onChange={(e) => setDraft((x) => ({ ...x, [c.id]: { ...d, status: e.target.value } }))} className={input} style={edge} aria-label={`Status for ${c.name}`}>
                        <option value="pending">Not checked yet</option><option value="complete">Complete</option><option value="incomplete">Incomplete</option>
                      </select>
                      <input value={d.note} onChange={(e) => setDraft((x) => ({ ...x, [c.id]: { ...d, note: e.target.value } }))} maxLength={300} placeholder="Note: which rule, and what is missing" className={input} style={edge} />
                      <button onClick={() => save(c)} className={btn}>Save check</button>
                    </div>
                  ) : (
                    <p className="mt-1">{c.status === "complete" ? "Complete" : c.status === "incomplete" ? "Incomplete" : "Not checked yet"}{c.note ? `: ${c.note}` : ""}</p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {msg && <p role="status" className="mt-2 text-sm font-bold">{msg}</p>}
    </div>
  );
}

function CampaignTool({ id, code }: { id: string; code: string }) {
  const api = useSeatApi(id, code);
  const [form, setForm] = useState({ name: "", slogan: "", platform: ["", "", ""], video: "", finding: "" });
  const [msg, setMsg] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    Promise.resolve().then(async () => {
      const r = await api("my-campaign");
      if (r.ok) setForm({ name: r.body.name, slogan: r.body.slogan, platform: r.body.platform, video: r.body.video, finding: r.body.surveyFinding ?? "" });
      else setMsg(r.body.error ?? "Couldn't load your page.");
      setLoaded(true);
    }).catch(() => {});
  }, [api]);

  async function save() {
    setMsg(null);
    const r = await api("my-campaign", { method: "PUT", body: JSON.stringify({ slogan: form.slogan, platform: form.platform, videoLink: form.video, surveyFinding: form.finding }) });
    setMsg(r.ok ? "Saved. It shows on the campaign page." : r.body.error ?? "Couldn't save.");
  }

  return (
    <div className={card} style={edge}>
      <h2 className="font-black">{form.name ? `${form.name}'s campaign page` : "Campaign page"}</h2>
      <p className="text-xs" style={{ color: "var(--text-faint)" }}>You can edit this one page only. Promises should be things the office can really do and others can check.</p>
      {loaded && (
        <div className="mt-3 grid gap-2">
          <input value={form.slogan} onChange={(e) => setForm({ ...form, slogan: e.target.value })} maxLength={100} placeholder="Slogan" className={input} style={edge} />
          {form.platform.map((p, i) => (
            <input key={i} value={p} onChange={(e) => setForm({ ...form, platform: form.platform.map((x, j) => (j === i ? e.target.value : x)) })} maxLength={140} placeholder={`Platform point ${i + 1}`} className={input} style={edge} />
          ))}
          <input value={form.video} onChange={(e) => setForm({ ...form, video: e.target.value })} placeholder="Speech video link (YouTube, Vimeo, TikTok or Instagram)" className={input} style={edge} />
          <input value={form.finding} onChange={(e) => setForm({ ...form, finding: e.target.value })} maxLength={200} placeholder="Survey finding your platform is built on (earns a Backed by survey badge)" className={input} style={edge} />
          <button onClick={save} className={btn}>Save my page</button>
        </div>
      )}
      {msg && <p role="status" className="mt-2 text-sm font-bold">{msg}</p>}
      <Link href={`/school-election/${id}/campaign`} className="mt-3 inline-block text-sm font-bold underline">View the public campaign page</Link>
    </div>
  );
}

function PressTool({ id, code }: { id: string; code: string }) {
  const api = useSeatApi(id, code);
  const [posts, setPosts] = useState<{ id: string; kind: string; title: string; body: string; status: string; created_at: string }[]>([]);
  const [kind, setKind] = useState<"article" | "claim_flag">("article");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [source, setSource] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await api("press");
    if (r.ok) setPosts(r.body.posts);
  }, [api]);
  useEffect(() => { Promise.resolve().then(load).catch(() => {}); }, [load]);

  async function send() {
    setMsg(null);
    const r = await api("press", { method: "POST", body: JSON.stringify({ kind, title, body: text, sourceUrl: source }) });
    if (!r.ok) { setMsg(r.body.error ?? "Couldn't save."); return; }
    setTitle(""); setText(""); setSource(""); setMsg(kind === "article" ? "Sent to the Supervisor. It goes public only when they publish it." : "Sent to the Commission."); load();
  }

  return (
    <div className={card} style={edge}>
      <h2 className="font-black">Press desk</h2>
      <p className="text-xs" style={{ color: "var(--text-faint)" }}>Report what happened, cite your sources, and flag claims that need checking. Articles are published only after the Supervisor approves them.</p>
      <div className="mt-3 grid gap-2">
        <select value={kind} onChange={(e) => setKind(e.target.value as "article" | "claim_flag")} className={input} style={edge} aria-label="Type">
          <option value="article">Article</option><option value="claim_flag">Fact-check flag (for the Commission)</option>
        </select>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder={kind === "article" ? "Headline" : "The claim you are checking"} className={input} style={edge} />
        <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} rows={5} placeholder={kind === "article" ? "Your article" : "What the evidence shows"} className={input} style={edge} />
        <input value={source} onChange={(e) => setSource(e.target.value)} maxLength={300} placeholder={kind === "claim_flag" ? "Source link (required)" : "Source link (optional)"} className={input} style={edge} />
        <button onClick={send} disabled={!title.trim() || !text.trim()} className={btn}>Send</button>
        {msg && <p role="status" className="text-sm font-bold">{msg}</p>}
      </div>
      <ul className="mt-4 grid gap-2">
        {posts.map((p) => (
          <li key={p.id} className="rounded-lg bg-[#f4f6fb] p-3 text-sm">
            <p className="font-bold">{p.title}</p>
            <p className="text-xs" style={{ color: "var(--text-faint)" }}>{p.kind === "article" ? "Article" : "Fact-check flag"} · {p.status === "published" ? "Published" : p.status === "hidden" ? "Not published" : "Waiting for the Supervisor"}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Returns the tool for a role, or null when that role's tools arrive in a later phase. */
export default function RoleTools({ id, role, code }: { id: string; role: string; code: string }) {
  if (role.startsWith("commission_")) return <><CommissionTool id={id} code={code} role={role} /><ClerkTool id={id} code={code} role={role} /><SurveyResults id={id} code={code} /></>;
  if (role === "qualification_clerk") return <ClerkTool id={id} code={code} role={role} />;
  if (role === "candidate" || role === "campaign_manager") return <><SurveyResults id={id} code={code} /><CampaignTool id={id} code={code} /></>;
  if (role === "press") return <><PressTool id={id} code={code} /><SurveyResults id={id} code={code} /></>;
  return null;
}

export const ROLES_WITH_TOOLS = ["commission_chair", "commission_secretary", "commission_member", "qualification_clerk", "candidate", "campaign_manager", "press"];
