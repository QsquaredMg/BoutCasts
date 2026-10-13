"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { TriviaKind } from "@/lib/trivia";

type Q = {
  id: string; position: number; kind: TriviaKind; prompt: string; options: string[];
  correct_index: number | null; explanation: string | null; seconds: number; points: number; reviewed: boolean;
};
type Pack = { id: string; title: string; status: "draft" | "review" | "approved"; source: "manual" | "ai"; ai_topic: string | null };

const inp = "w-full rounded-lg border px-3 py-2 text-sm";

export default function PackEditor({ packId }: { packId: string }) {
  const sb = useRef(createClient());
  const router = useRouter();
  const [pack, setPack] = useState<Pack | null>(null);
  const [qs, setQs] = useState<Q[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [topic, setTopic] = useState("");
  const [notes, setNotes] = useState("");
  const [count, setCount] = useState(10);
  const [mode, setMode] = useState<"solo" | "team">("solo");
  const [teamA, setTeamA] = useState("Team A");
  const [teamB, setTeamB] = useState("Team B");

  const load = useCallback(async () => {
    const [{ data: p }, { data: q }] = await Promise.all([
      sb.current.from("trivia_packs").select("id,title,status,source,ai_topic").eq("id", packId).maybeSingle(),
      sb.current.from("trivia_questions").select("*").eq("pack_id", packId).order("position").order("created_at"),
    ]);
    setPack(p as Pack | null);
    setQs((q ?? []) as Q[]);
  }, [packId]);
  useEffect(() => { load(); }, [load]);

  const patch = (id: string, v: Partial<Q>) => setQs((a) => a.map((x) => (x.id === id ? { ...x, ...v } : x)));

  async function addQuestion(kind: TriviaKind) {
    const { error } = await sb.current.from("trivia_questions").insert({
      pack_id: packId, position: qs.length, kind, prompt: "New question", options: ["Option A", "Option B", "Option C", "Option D"],
      correct_index: kind === "predict" ? null : 0, reviewed: true,
    });
    if (error) setMsg(error.message);
    load();
  }
  async function save(q: Q) {
    setMsg("");
    const { error } = await sb.current.from("trivia_questions").update({
      kind: q.kind, prompt: q.prompt, options: q.options, correct_index: q.kind === "predict" ? null : q.correct_index,
      explanation: q.explanation || null, seconds: q.seconds, points: q.points, reviewed: q.reviewed,
    }).eq("id", q.id);
    setMsg(error ? error.message : "Saved.");
    load();
  }
  async function remove(id: string) {
    if (!confirm("Delete this question?")) return;
    await sb.current.from("trivia_questions").delete().eq("id", id);
    load();
  }
  async function generate() {
    setBusy(true);
    setMsg("Drafting questions… this takes about 20 seconds.");
    const r = await fetch("/api/trivia/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ packId, topic, notes, count }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    setMsg(r.ok ? `${j.added} AI questions added. Read each one, fix anything off, then tick "I checked this".` : j.error ?? "Something went wrong.");
    load();
  }
  async function approve() {
    setBusy(true);
    const { error } = await sb.current.from("trivia_packs").update({ status: "approved" }).eq("id", packId);
    setBusy(false);
    setMsg(error ? error.message : "Approved. You can host this pack now.");
    load();
  }
  async function host() {
    setBusy(true);
    const { data, error } = await sb.current.rpc("trivia_create_game", { p_pack: packId, p_mode: mode, p_team_a: teamA, p_team_b: teamB });
    setBusy(false);
    if (error) setMsg(error.message);
    else router.push(`/trivia/${data}/host`);
  }

  if (!pack) return <div className="mx-auto max-w-2xl px-5 py-10 text-sm">Loading pack…</div>;
  const unchecked = qs.filter((q) => !q.reviewed).length;

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>{pack.title}</h1>
      <p className="mt-1 text-sm" style={{ color: "var(--text-faint)" }}>
        {qs.length} questions · {pack.status === "approved" ? "Approved, ready to host" : unchecked ? `${unchecked} still need your review` : "All checked, ready to approve"}
      </p>

      <section className="mt-5 rounded-2xl border p-4">
        <h2 className="font-bold">Draft with AI</h2>
        <p className="mb-3 text-xs" style={{ color: "var(--text-faint)" }}>
          AI drafts land as unchecked. Nothing can go live until you read each question and tick &quot;I checked this&quot;. AI can be wrong, so verify the facts.
        </p>
        <input className={inp} placeholder="Topic, e.g. HBCU marching band history" value={topic} onChange={(e) => setTopic(e.target.value)} />
        <textarea className={`${inp} mt-2`} rows={2} placeholder="Optional notes: school, year range, tone, things to include" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <div className="mt-2 flex items-center gap-2">
          <label className="text-sm">How many <input type="number" min={3} max={15} value={count} onChange={(e) => setCount(Number(e.target.value))} className="ml-1 w-16 rounded-lg border px-2 py-1" /></label>
          <button disabled={busy || topic.trim().length < 3} onClick={generate} className="ml-auto rounded-xl px-4 py-2 text-sm font-black text-white disabled:opacity-50" style={{ background: "#1b4fe4" }}>Draft questions</button>
        </div>
      </section>

      {msg && <p className="mt-3 text-sm font-semibold">{msg}</p>}

      <div className="mt-5 space-y-4">
        {qs.map((q, n) => (
          <div key={q.id} className="rounded-2xl border p-4" style={{ borderColor: q.reviewed ? undefined : "#f59e0b" }}>
            <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-wide">
              <span>Question {n + 1}</span>
              <select value={q.kind} onChange={(e) => patch(q.id, { kind: e.target.value as TriviaKind, correct_index: e.target.value === "predict" ? null : q.correct_index ?? 0 })} className="rounded border px-2 py-1 normal-case">
                <option value="mc">Trivia</option>
                <option value="stump">Stump the room</option>
                <option value="predict">Call it (real-world result)</option>
              </select>
            </div>
            <textarea className={inp} rows={2} value={q.prompt} onChange={(e) => patch(q.id, { prompt: e.target.value, reviewed: false })} />
            <div className="mt-2 grid gap-2">
              {q.options.map((o, i) => (
                <label key={i} className="flex items-center gap-2">
                  {q.kind !== "predict" && <input type="radio" name={`c-${q.id}`} checked={q.correct_index === i} onChange={() => patch(q.id, { correct_index: i, reviewed: false })} aria-label="Correct answer" />}
                  <input className={inp} value={o} onChange={(e) => patch(q.id, { options: q.options.map((x, j) => (j === i ? e.target.value : x)), reviewed: false })} />
                </label>
              ))}
            </div>
            {q.kind === "predict" && <p className="mt-1 text-xs" style={{ color: "var(--text-faint)" }}>You pick what really happened when you reveal this one live.</p>}
            <input className={`${inp} mt-2`} placeholder="Why it's right (shown after the reveal)" value={q.explanation ?? ""} onChange={(e) => patch(q.id, { explanation: e.target.value, reviewed: false })} />
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
              <label>Seconds <input type="number" min={5} max={120} value={q.seconds} onChange={(e) => patch(q.id, { seconds: Number(e.target.value) })} className="w-16 rounded border px-2 py-1" /></label>
              <label>Points <input type="number" min={10} max={1000} step={10} value={q.points} onChange={(e) => patch(q.id, { points: Number(e.target.value) })} className="w-20 rounded border px-2 py-1" /></label>
              <label className="flex items-center gap-1 font-semibold"><input type="checkbox" checked={q.reviewed} onChange={(e) => patch(q.id, { reviewed: e.target.checked })} /> I checked this</label>
              <span className="ml-auto flex gap-2">
                <button onClick={() => save(q)} className="rounded-lg bg-black px-3 py-1.5 text-white">Save</button>
                <button onClick={() => remove(q.id)} className="rounded-lg border px-3 py-1.5">Delete</button>
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        <button onClick={() => addQuestion("mc")} className="rounded-xl border px-3 py-2 font-semibold">+ Trivia question</button>
        <button onClick={() => addQuestion("stump")} className="rounded-xl border px-3 py-2 font-semibold">+ Stump the room</button>
        <button onClick={() => addQuestion("predict")} className="rounded-xl border px-3 py-2 font-semibold">+ Call it</button>
      </div>

      <section className="mt-8 rounded-2xl p-5 text-white" style={{ background: "linear-gradient(160deg,#2a1260,#0a0e1a)" }}>
        {pack.status !== "approved" ? (
          <>
            <p className="font-black">Approve to go live</p>
            <p className="mb-3 text-sm opacity-80">Save every question you changed, tick &quot;I checked this&quot; on each one, then approve.</p>
            <button disabled={busy || qs.length === 0 || unchecked > 0} onClick={approve} className="rounded-xl px-5 py-3 font-black text-black disabled:opacity-40" style={{ background: "#ffc531" }}>
              Approve pack
            </button>
          </>
        ) : (
          <>
            <p className="font-black">Host this pack</p>
            <div className="my-3 flex flex-wrap gap-3 text-sm">
              <label><input type="radio" checked={mode === "solo"} onChange={() => setMode("solo")} /> Everyone for themselves</label>
              <label><input type="radio" checked={mode === "team"} onChange={() => setMode("team")} /> Two teams</label>
            </div>
            {mode === "team" && (
              <div className="mb-3 grid grid-cols-2 gap-2">
                <input className={`${inp} text-black`} value={teamA} onChange={(e) => setTeamA(e.target.value)} maxLength={24} />
                <input className={`${inp} text-black`} value={teamB} onChange={(e) => setTeamB(e.target.value)} maxLength={24} />
              </div>
            )}
            <button disabled={busy} onClick={host} className="rounded-xl px-5 py-3 font-black text-black disabled:opacity-40" style={{ background: "#ffc531" }}>Start a live game</button>
          </>
        )}
      </section>
    </div>
  );
}
