"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// A judge's private, time-stamped notes on one contestant. Optional "at
// m:ss" pins a note to a moment in the performance clip.

export type JudgeNote = {
  id: string;
  option_id: string;
  body: string;
  clip_seconds: number | null;
  created_at: string;
  judge_name?: string;
};

export function formatClipTime(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
}

function parseClipTime(v: string): number | null | "invalid" {
  const t = v.trim();
  if (!t) return null;
  if (!/^\d{1,2}(:\d{1,2}){0,2}$/.test(t)) return "invalid";
  return t.split(":").reduce((acc, part) => acc * 60 + Number(part), 0);
}

export default function JudgeOptionNotes({
  token,
  optionId,
  notes,
  open,
  onChanged,
}: {
  token: string;
  optionId: string;
  notes: JudgeNote[];
  open: boolean;
  onChanged: () => void;
}) {
  const supabase = createClient();
  const [body, setBody] = useState("");
  const [at, setAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    const clip = parseClipTime(at);
    if (clip === "invalid") {
      setError("Use m:ss for the moment, like 1:23");
      return;
    }
    setBusy(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc("judge_add_note", {
      p_token: token,
      p_option_id: optionId,
      p_body: body,
      p_clip_seconds: clip,
    });
    setBusy(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setBody("");
    setAt("");
    onChanged();
  }

  async function remove(id: string) {
    await supabase.rpc("judge_delete_note", { p_token: token, p_note_id: id });
    onChanged();
  }

  return (
    <div className="mt-3 border-t pt-3" style={{ borderColor: "var(--border)" }}>
      <p className="mb-1.5 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
        Notes {notes.length > 0 && `(${notes.length})`}
      </p>
      {notes.length > 0 && (
        <ul className="mb-2 flex flex-col gap-1.5">
          {notes.map((n) => (
            <li key={n.id} className="rounded-lg px-2.5 py-1.5 text-sm" style={{ background: "var(--surface-2)" }}>
              <div className="flex items-baseline justify-between gap-2 text-[11px]" style={{ color: "var(--text-faint)" }}>
                <span>
                  {new Date(n.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                  {n.clip_seconds !== null && (
                    <b className="ml-1.5" style={{ color: "var(--red)" }}>
                      @ {formatClipTime(n.clip_seconds)}
                    </b>
                  )}
                </span>
                {open && (
                  <button type="button" onClick={() => remove(n.id)} aria-label="Delete note">
                    ✕
                  </button>
                )}
              </div>
              <p className="whitespace-pre-wrap">{n.body}</p>
            </li>
          ))}
        </ul>
      )}
      {open && (
        <div className="flex flex-col gap-1.5">
          <textarea
            className="w-full rounded-[10px] border px-3 py-2 text-sm"
            style={{ borderColor: "var(--border)", background: "var(--surface)", minHeight: 56 }}
            placeholder="Private note — only you and the organizer see these"
            maxLength={1000}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <div className="flex gap-2">
            <input
              className="w-24 rounded-[10px] border px-3 py-1.5 text-sm"
              style={{ borderColor: "var(--border)", background: "var(--surface)" }}
              placeholder="at 1:23"
              aria-label="Moment in the clip (optional)"
              value={at}
              onChange={(e) => setAt(e.target.value)}
            />
            <button
              type="button"
              onClick={add}
              disabled={busy || !body.trim()}
              className="flex-1 rounded-full border px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
              style={{ borderColor: "var(--red)", color: "var(--red)" }}
            >
              {busy ? "Saving…" : "Add note"}
            </button>
          </div>
          {error && (
            <p className="text-xs" style={{ color: "var(--red)" }}>
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
