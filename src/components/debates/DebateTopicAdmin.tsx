"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import JudgeInviteButton from "@/components/JudgeInviteButton";

type Judge = { id: string; name: string; token: string };

// Admin-only tools on a debate topic: judge panel links and closing sign-ups.
export default function DebateTopicAdmin({
  topicId,
  status,
  scoringMode,
  judges,
  title,
}: {
  topicId: string;
  title: string;
  status: "open" | "running" | "closed";
  scoringMode: "crowd" | "judges" | "both";
  judges: Judge[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function addJudge() {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    const { error: e } = await supabase.rpc("admin_add_debate_judge", { p_topic_id: topicId, p_name: name.trim() });
    setBusy(false);
    if (e) return setError(e.message);
    setName("");
    router.refresh();
  }

  async function removeJudge(id: string) {
    if (!confirm("Remove this judge? Their link stops working and their scores are deleted.")) return;
    await supabase.rpc("admin_remove_debate_judge", { p_judge_id: id });
    router.refresh();
  }

  async function closeTopic() {
    if (!confirm("Close sign-ups for this topic? Matches already running will finish normally.")) return;
    await supabase.rpc("admin_close_debate_topic", { p_topic_id: topicId });
    router.refresh();
  }

  function copy(token: string) {
    navigator.clipboard?.writeText(`${window.location.origin}/debates/judge/${token}`);
    setCopied(token);
  }

  return (
    <div className="mt-8 rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <p className="mb-3 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
        Admin
      </p>
      {scoringMode !== "crowd" && (
        <div className="mb-4">
          <p className="mb-2 text-sm font-bold">Judges ({judges.length})</p>
          <p className="mb-2 text-xs" style={{ color: "var(--text-faint)" }}>
            Each judge gets a private link — no account needed. They score every debate in this topic while it&apos;s in voting.
          </p>
          <div className="mb-2 flex flex-col gap-1.5">
            {judges.map((j) => (
              <div key={j.id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border)" }}>
                <span className="font-semibold">{j.name}</span>
                <span className="flex gap-2">
                  <button type="button" onClick={() => copy(j.token)} className="text-xs font-bold" style={{ color: "var(--red)" }}>
                    {copied === j.token ? "Copied!" : "Copy link"}
                  </button>
                  <JudgeInviteButton
                    judgeName={j.name}
                    link={`/debates/judge/${j.token}`}
                    title={title}
                    kind="debate"
                    criteria={["Argument", "Evidence", "Rebuttal", "Delivery"]}
                  />
                  <button type="button" onClick={() => removeJudge(j.id)} className="text-xs" style={{ color: "var(--text-faint)" }}>
                    Remove
                  </button>
                </span>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Judge name"
              className="flex-1 rounded-[10px] border px-3 py-2 text-sm"
              style={{ borderColor: "var(--border)", background: "var(--surface)" }}
            />
            <button type="button" onClick={addJudge} disabled={busy || !name.trim()} className="rounded-full border px-4 py-2 text-sm font-bold disabled:opacity-50" style={{ borderColor: "var(--border)" }}>
              Add judge
            </button>
          </div>
        </div>
      )}
      {status === "open" && (
        <button type="button" onClick={closeTopic} className="rounded-full border px-4 py-2 text-xs font-bold" style={{ borderColor: "var(--border)", color: "var(--text-dim)" }}>
          Close sign-ups
        </button>
      )}
      {error && (
        <p className="mt-2 text-sm" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
