"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type EntrantPick = { id: string; entrant_name: string; pred_home: number; pred_away: number };

type Parsed = { name: string; pred_home: number; pred_away: number };

// One person per line: "Dana, 24, 17", "Dana 24-17" or a pasted spreadsheet row ("Dana<tab>24<tab>17").
export function parsePickLines(text: string): { picks: Parsed[]; bad: string[] } {
  const picks: Parsed[] = [];
  const bad: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^(.*?)[\s,;\t]+(\d{1,3})\s*[-–,;:\t ]\s*(\d{1,3})\s*$/);
    const name = m?.[1].trim().replace(/^["']|["']$/g, "").trim();
    if (!m || !name) bad.push(line);
    else picks.push({ name, pred_home: Number(m[2]), pred_away: Number(m[3]) });
  }
  return { picks, bad };
}

// Organizer tool: enter picks for a whole group (a work group, a class, a family) in one go.
export default function EntrantPicksPanel({ gameId, home, away, existing }: { gameId: string; home: string; away: string; existing: EntrantPick[] }) {
  const router = useRouter();
  const sb = createClient();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save() {
    const { picks, bad } = parsePickLines(text);
    if (bad.length) return setMsg({ ok: false, text: `Couldn't read: "${bad[0]}"${bad.length > 1 ? ` and ${bad.length - 1} more` : ""}. Use a name, then the ${home} score, then the ${away} score.` });
    if (!picks.length) return setMsg({ ok: false, text: "Add at least one line first." });
    setBusy(true);
    setMsg(null);
    const { data, error } = await sb.rpc("set_entrant_picks", { p_game: gameId, p_picks: picks });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.message });
    setText("");
    setMsg({ ok: true, text: `Saved ${data ?? picks.length} ${picks.length === 1 ? "pick" : "picks"}.` });
    router.refresh();
  }

  async function remove(id: string) {
    setBusy(true);
    const { error } = await sb.rpc("delete_entrant_pick", { p_id: id });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.message });
    router.refresh();
  }

  return (
    <section className="bc-card p-5">
      <h2 className="pt-h2 mb-1">Enter picks for a group</h2>
      <p className="mb-3 text-sm" style={{ color: "var(--text-dim)" }}>
        Type or paste one person per line: name, then the <strong>{home}</strong> score, then the <strong>{away}</strong> score. They score and rank like any other player once the final score is in.
      </p>
      <label htmlFor="entrant-picks" className="sr-only">Group picks</label>
      <textarea
        id="entrant-picks"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        placeholder={"Dana, 24, 17\nSam, 10, 14\nMary Ann 21-20"}
        className="w-full rounded-xl border bg-transparent p-3 font-mono text-sm"
        style={{ borderColor: "var(--border)" }}
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" disabled={busy || !text.trim()} onClick={save} className="rounded-full px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50" style={{ background: "var(--blue)" }}>
          {busy ? "Saving…" : "Save picks"}
        </button>
        <span className="text-xs" style={{ color: "var(--text-faint)" }}>Entering a name again replaces that person&apos;s pick.</span>
      </div>
      {msg && <p role={msg.ok ? "status" : "alert"} className="mt-3 text-sm font-semibold" style={{ color: msg.ok ? "var(--blue)" : "var(--red)" }}>{msg.text}</p>}

      {existing.length > 0 && (
        <div className="mt-5">
          <h3 className="mb-2 text-sm font-bold">Entered so far ({existing.length})</h3>
          <ul className="divide-y rounded-xl border" style={{ borderColor: "var(--border)" }}>
            {existing.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm" style={{ borderColor: "var(--border)" }}>
                <span className="min-w-0 truncate font-semibold">{e.entrant_name}</span>
                <span className="tabular-nums" style={{ color: "var(--text-dim)" }}>{e.pred_home} – {e.pred_away}</span>
                <button type="button" disabled={busy} onClick={() => remove(e.id)} className="text-xs font-bold underline disabled:opacity-50" style={{ color: "var(--red)" }}>Remove</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
