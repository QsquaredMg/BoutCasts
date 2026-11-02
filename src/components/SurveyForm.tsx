"use client";

import { useEffect, useState } from "react";
import type { SurveyQuestion } from "@/lib/surveyBank";

type Loaded = { open: boolean; questions?: SurveyQuestion[]; grades?: string[]; group?: string | null };

// The anonymous voter survey. It asks no names or IDs. "kiosk" mode resets after each answer for a hallway iPad,
// and "paper" mode lets the signed-in teacher enter answers from a printed copy.
export default function SurveyForm({ id, mode }: { id: string; mode: "link" | "kiosk" | "paper" }) {
  const [data, setData] = useState<Loaded | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [grade, setGrade] = useState("");
  const [state, setState] = useState<"form" | "sending" | "done">("form");
  const [err, setErr] = useState<string | null>(null);
  const [entered, setEntered] = useState(0);

  useEffect(() => {
    Promise.resolve().then(async () => {
      const res = await fetch(`/api/school-election/${id}/survey${mode === "paper" ? "/manage" : ""}`, { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (mode === "paper") {
        // The teacher can enter paper answers while the survey is a draft or open.
        setData(res.ok && body.questions?.length ? { open: true, questions: body.questions, grades: body.level === "high" ? ["9th", "10th", "11th", "12th"] : ["6th", "7th", "8th"], group: body.votingGroup } : { open: false });
      } else setData(body);
    }).catch(() => setData({ open: false }));
  }, [id, mode]);

  useEffect(() => {
    if (state !== "done" || mode !== "kiosk") return;
    const t = setTimeout(() => { setAnswers({}); setGrade(""); setState("form"); }, 4000);
    return () => clearTimeout(t);
  }, [state, mode]);

  async function send() {
    setState("sending");
    setErr(null);
    const res = await fetch(`/api/school-election/${id}/survey`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers, grade: grade || undefined, source: mode }) });
    if (!res.ok) {
      setErr((await res.json().catch(() => ({}))).error ?? "Couldn't send. Please try again.");
      setState("form");
      return;
    }
    setEntered((n) => n + 1);
    if (mode === "paper") { setAnswers({}); setGrade(""); setState("form"); } else setState("done");
  }

  const card = "rounded-xl border bg-white p-4 shadow-sm";
  const edge = { borderColor: "var(--border)" } as const;
  if (!data) return <p className="text-sm">Loading…</p>;
  if (!data.open) return <div className={card} style={edge}><h1 className="text-xl font-black">Survey</h1><p className="mt-1 text-sm">This survey isn&apos;t open right now.</p></div>;
  if (state === "done") return <div className={card} style={edge}><h1 className="text-xl font-black">Thank you!</h1><p className="mt-1 text-sm">Your answers are anonymous and help the candidates hear what matters to you.</p></div>;

  const qs = data.questions ?? [];
  return (
    <div className="grid gap-3">
      <div className={card} style={edge}>
        <h1 className="text-xl font-black">{mode === "paper" ? "Enter a paper survey" : "Tell the candidates what matters to you"}</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-faint)" }}>{mode === "paper" ? `Entered so far: ${entered}. Answer only what is marked on the paper.` : "This is anonymous. We don't ask your name. Please don't name people in your answers."}</p>
      </div>
      {qs.map((q, i) => (
        <fieldset key={q.id} className={card} style={edge}>
          <legend className="sr-only">Question {i + 1}</legend>
          <p className="text-sm font-bold">{i + 1}. {q.text}</p>
          {q.type === "rating" && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs">Not important</span>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => setAnswers((a) => ({ ...a, [q.id]: n }))} aria-pressed={answers[q.id] === n} className={`h-10 w-10 rounded-full border text-sm font-bold ${answers[q.id] === n ? "bg-[#1b4fe4] text-white" : "bg-white"}`} style={edge}>{n}</button>
              ))}
              <span className="text-xs">Very important</span>
            </div>
          )}
          {q.type === "top3" && (
            <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {q.options.map((o) => {
                const picks = (answers[q.id] as string[] | undefined) ?? [];
                const on = picks.includes(o);
                return (
                  <li key={o}>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={on} disabled={!on && picks.length >= 3} onChange={() => setAnswers((a) => ({ ...a, [q.id]: on ? picks.filter((x) => x !== o) : [...picks, o] }))} className="h-4 w-4" />
                      {o}
                    </label>
                  </li>
                );
              })}
              <li className="text-xs sm:col-span-2" style={{ color: "var(--text-faint)" }}>Pick up to 3.</li>
            </ul>
          )}
          {q.type === "open" && (
            <textarea value={(answers[q.id] as string) ?? ""} onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))} maxLength={300} rows={3} className="mt-2 w-full rounded-[10px] border px-3 py-2 text-sm" style={edge} />
          )}
        </fieldset>
      ))}
      <div className={card} style={edge}>
        <label className="text-sm font-bold" htmlFor="grade">Your grade</label>
        <select id="grade" value={grade} onChange={(e) => setGrade(e.target.value)} className="mt-1 w-full rounded-[10px] border px-3 py-2 text-sm" style={edge}>
          <option value="">Skip</option>
          {(data.grades ?? []).map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>
      {err && <p role="alert" className="text-sm font-bold text-red-700">{err}</p>}
      <button onClick={send} disabled={state === "sending" || !Object.keys(answers).length} className="rounded-full bg-[#1b4fe4] px-6 py-3 text-base font-bold text-white disabled:opacity-50">{state === "sending" ? "Sending…" : mode === "paper" ? "Save this paper survey" : "Send my answers"}</button>
    </div>
  );
}
