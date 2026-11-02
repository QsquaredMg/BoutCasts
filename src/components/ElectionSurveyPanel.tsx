"use client";

import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import SurveyResults from "@/components/SurveyResults";
import type { SurveyQuestion } from "@/lib/surveyBank";

type Manage = {
  status: "draft" | "open" | "closed" | null;
  questions: SurveyQuestion[];
  count: number;
  level: "middle" | "high" | null;
  electionClass: string;
  votingGroup: string;
  openAnswers: { id: string; question: string; text: string; hidden: boolean }[];
};

// Teacher controls for the election class / voting group labels and the voter survey.
export default function ElectionSurveyPanel({ id }: { id: string }) {
  const [m, setM] = useState<Manage | null>(null);
  const [cls, setCls] = useState("");
  const [grp, setGrp] = useState("");
  const [customs, setCustoms] = useState<{ type: "rating" | "open"; text: string }[]>([]);
  const [qr, setQr] = useState("");
  const [origin, setOrigin] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const edge = { borderColor: "var(--border)", background: "var(--surface)" } as const;
  const input = "w-full rounded-[10px] border px-3 py-2 text-sm";

  const load = useCallback(async () => {
    const res = await fetch(`/api/school-election/${id}/survey/manage`, { cache: "no-store" });
    if (!res.ok) return;
    const j = (await res.json()) as Manage;
    setM(j);
    setCls(j.electionClass);
    setGrp(j.votingGroup);
    setCustoms(j.questions.filter((q) => q.id.startsWith("c")).map((q) => ({ type: q.type === "open" ? "open" : "rating", text: q.text })));
  }, [id]);
  useEffect(() => {
    Promise.resolve().then(() => { setOrigin(window.location.origin); return load(); }).catch(() => {});
  }, [load]);
  useEffect(() => {
    if (!origin) return;
    QRCode.toDataURL(`${origin}/school-election/${id}/survey`, { margin: 1, width: 180 }).then(setQr).catch(() => {});
  }, [origin, id]);

  async function put(body: Record<string, unknown>, ok?: string) {
    setErr(null);
    setNote(null);
    const res = await fetch(`/api/school-election/${id}/survey/manage`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { setErr((await res.json().catch(() => ({}))).error ?? "Couldn't save."); return; }
    if (ok) setNote(ok);
    load();
  }
  async function hide(responseId: string, hidden: boolean) {
    await fetch(`/api/school-election/${id}/survey/manage`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ responseId, hidden }) });
    load();
  }

  if (!m) return null;
  const link = `${origin}/school-election/${id}/survey`;
  return (
    <div className="rounded-xl border p-4" style={edge}>
      <p className="font-bold">Election class, voting group and voter survey</p>
      <p className="mb-3 text-xs" style={{ color: "var(--text-faint)" }}>One class runs the election. A different class or grade votes. Candidates and supporters survey the voting group to build their campaigns on real information.</p>
      {err && <p role="alert" className="mb-2 text-sm font-bold text-red-700">{err}</p>}
      {note && <p role="status" className="mb-2 text-sm font-bold">{note}</p>}

      <div className="grid gap-2 sm:grid-cols-2">
        <input value={cls} onChange={(e) => setCls(e.target.value)} maxLength={80} placeholder="Election class (who runs it), like 8th grade, Mrs. Lee" className={input} style={edge} aria-label="Election class" />
        <input value={grp} onChange={(e) => setGrp(e.target.value)} maxLength={80} placeholder="Voting group (who votes), like 7th grade" className={input} style={edge} aria-label="Voting group" />
      </div>
      <button onClick={() => put({ action: "labels", electionClass: cls, votingGroup: grp }, "Saved.")} className="mt-2 rounded-full border px-4 py-1.5 text-xs font-bold" style={{ borderColor: "var(--border)" }}>Save names</button>

      {!m.status && (
        <div className="mt-4">
          <p className="text-sm font-bold">Set up the voter survey</p>
          <p className="text-xs" style={{ color: "var(--text-faint)" }}>Pick the starter questions for your school. 6 importance ratings, 2 pick-your-top-3 questions and 1 open question.</p>
          <div className="mt-2 flex gap-2">
            <button onClick={() => put({ action: "setup", level: "middle" })} className="rounded-full bg-[#1b4fe4] px-4 py-2 text-sm font-bold text-white">Middle school</button>
            <button onClick={() => put({ action: "setup", level: "high" })} className="rounded-full bg-[#1b4fe4] px-4 py-2 text-sm font-bold text-white">High school</button>
          </div>
        </div>
      )}

      {m.status && (
        <div className="mt-4 grid gap-3">
          <p className="text-sm"><b>Survey:</b> {m.status === "draft" ? "not open yet" : m.status === "open" ? "open" : "closed (results are out)"} · {m.count} response{m.count === 1 ? "" : "s"}</p>
          <ol className="list-decimal pl-5 text-sm">{m.questions.map((q) => <li key={q.id}>{q.text}</li>)}</ol>

          {m.count === 0 && (
            <div>
              <p className="text-sm font-bold">Your own questions (up to 3)</p>
              {customs.map((c, i) => (
                <div key={i} className="mt-1 flex gap-2">
                  <select value={c.type} onChange={(e) => setCustoms(customs.map((x, j) => (j === i ? { ...x, type: e.target.value as "rating" | "open" } : x)))} className="rounded-[10px] border px-2 py-2 text-sm" style={edge} aria-label="Type"><option value="rating">Rating 1-5</option><option value="open">Open answer</option></select>
                  <input value={c.text} onChange={(e) => setCustoms(customs.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} maxLength={200} placeholder="Your question" className={input} style={edge} />
                  <button onClick={() => setCustoms(customs.filter((_, j) => j !== i))} className="text-xs font-bold underline">Remove</button>
                </div>
              ))}
              <div className="mt-2 flex gap-2">
                {customs.length < 3 && <button onClick={() => setCustoms([...customs, { type: "rating", text: "" }])} className="rounded-full border px-3 py-1.5 text-xs font-bold" style={{ borderColor: "var(--border)" }}>Add a question</button>}
                <button onClick={() => put({ action: "custom", questions: customs }, "Questions saved.")} className="rounded-full border px-3 py-1.5 text-xs font-bold" style={{ borderColor: "var(--border)" }}>Save my questions</button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {m.status === "draft" && <button onClick={() => put({ action: "status", status: "open" })} className="rounded-full bg-[#1b4fe4] px-4 py-2 text-sm font-bold text-white">Open the survey</button>}
            {m.status === "open" && <button onClick={() => { if (confirm("Close the survey? Every candidate sees the results at the same moment.")) put({ action: "status", status: "closed" }); }} className="rounded-full bg-[#1b4fe4] px-4 py-2 text-sm font-bold text-white">Close and release results</button>}
            {m.status === "closed" && <button onClick={() => put({ action: "status", status: "open" })} className="rounded-full border px-4 py-2 text-sm font-bold" style={{ borderColor: "var(--border)" }}>Reopen</button>}
          </div>

          <div className="rounded-lg border p-3 text-sm" style={edge}>
            <p className="font-bold">Share with the voting group</p>
            <p className="mt-1 break-all text-xs">{link}</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              {qr && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qr} alt="QR code for the survey" width={120} height={120} />
              )}
              <ul className="grid gap-1 text-xs">
                <li><a className="underline" href={`/school-election/${id}/survey?kiosk=1`} target="_blank" rel="noreferrer">Kiosk mode for a hallway iPad</a></li>
                <li><a className="underline" href={`/school-election/${id}/survey/print`} target="_blank" rel="noreferrer">Print a paper copy</a></li>
                <li><a className="underline" href={`/school-election/${id}/survey?paper=1`} target="_blank" rel="noreferrer">Enter paper answers</a></li>
                <li><button onClick={() => navigator.clipboard?.writeText(link)} className="underline">Copy link</button></li>
              </ul>
            </div>
          </div>

          {m.openAnswers.length > 0 && (
            <div>
              <p className="text-sm font-bold">Open answers (hide any that name someone)</p>
              <ul className="mt-1 grid gap-1">
                {m.openAnswers.slice(0, 60).map((a) => (
                  <li key={`${a.id}-${a.question}`} className="flex items-start justify-between gap-2 rounded bg-[#f4f6fb] px-2 py-1 text-sm">
                    <span className={a.hidden ? "line-through opacity-60" : ""}>{a.text}</span>
                    <button onClick={() => hide(a.id, !a.hidden)} className="shrink-0 text-xs font-bold underline">{a.hidden ? "Show" : "Hide"}</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {m.count > 0 && <SurveyResults id={id} />}
        </div>
      )}
    </div>
  );
}
