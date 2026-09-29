"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SIDE_COLOR, SIDE_LABEL, type DebateSide } from "@/lib/debates";

export default function DebateJoin({
  topicId,
  format,
  bracketSize,
  status,
  signedIn,
  myEntry,
  waitingFor,
  waitingAgainst,
  entries,
}: {
  topicId: string;
  format: "open" | "bracket";
  bracketSize: number | null;
  status: "open" | "running" | "closed";
  signedIn: boolean;
  myEntry: { side: DebateSide | null; match_id: string | null } | null;
  waitingFor: number;
  waitingAgainst: number;
  entries: number;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join(side: DebateSide | null) {
    setBusy(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("join_debate", { p_topic_id: topicId, p_side: side });
    setBusy(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    const matchId = (data as { match_id: string | null } | null)?.match_id;
    if (matchId) {
      fetch("/api/debates/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId }),
      }).catch(() => {});
      router.push(`/debates/match/${matchId}`);
      return;
    }
    router.refresh();
  }

  async function leave() {
    setBusy(true);
    await supabase.rpc("leave_debate", { p_topic_id: topicId });
    setBusy(false);
    router.refresh();
  }

  const card = "rounded-2xl border p-4";
  const cardStyle = { borderColor: "var(--border)", background: "var(--surface)" };

  if (myEntry?.match_id) {
    return (
      <div className={card} style={cardStyle}>
        <p className="font-bold">You&apos;re in a match on this topic.</p>
        <Link href={`/debates/match/${myEntry.match_id}`} className="bc-btn-solid mt-3 inline-block rounded-full px-5 py-2.5 text-sm font-bold">
          Go to my debate →
        </Link>
      </div>
    );
  }

  if (status !== "open") return null;

  if (!signedIn) {
    return (
      <div className={card} style={cardStyle}>
        <p className="font-bold">Want to debate this?</p>
        <p className="mt-1 text-sm" style={{ color: "var(--text-dim)" }}>
          Sign in to pick a side and get matched with an opponent.
        </p>
        <div className="mt-3 flex gap-2">
          <Link href={`/signup?next=${encodeURIComponent(`/debates/${topicId}`)}`} className="bc-btn-solid rounded-full px-5 py-2.5 text-sm font-bold">
            Create a free account
          </Link>
          <Link href={`/login?next=${encodeURIComponent(`/debates/${topicId}`)}`} className="rounded-full border px-5 py-2.5 text-sm font-bold" style={{ borderColor: "var(--border)" }}>
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  if (myEntry) {
    return (
      <div className={card} style={cardStyle}>
        <p className="font-bold">
          {format === "bracket"
            ? `You're in! ${entries} of ${bracketSize} spots filled.`
            : `You're in the queue for ${SIDE_LABEL[myEntry.side ?? "for"]}.`}
        </p>
        <p className="mt-1 text-sm" style={{ color: "var(--text-dim)" }}>
          {format === "bracket"
            ? "The bracket starts as soon as it fills up. We'll notify you when your first debate begins."
            : "You'll be matched as soon as someone takes the other side. We'll notify you."}
        </p>
        <button type="button" onClick={leave} disabled={busy} className="mt-3 text-xs font-semibold underline" style={{ color: "var(--text-faint)" }}>
          Leave the queue
        </button>
      </div>
    );
  }

  return (
    <div className={card} style={cardStyle}>
      {format === "bracket" ? (
        <>
          <p className="font-bold">
            Enter the bracket · {entries} of {bracketSize} spots filled
          </p>
          <p className="mt-1 text-sm" style={{ color: "var(--text-dim)" }}>
            Sides (For / Against) are assigned for each match, so be ready to argue either way. Win and you advance.
          </p>
          <button type="button" onClick={() => join(null)} disabled={busy} className="bc-btn-solid mt-3 rounded-full px-5 py-2.5 text-sm font-bold disabled:opacity-60">
            {busy ? "Joining…" : "Enter the bracket"}
          </button>
        </>
      ) : (
        <>
          <p className="font-bold">Pick your side</p>
          <p className="mt-1 text-sm" style={{ color: "var(--text-dim)" }}>
            You&apos;ll be matched with the next person who takes the other side.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {(["for", "against"] as DebateSide[]).map((s) => {
              const waiting = s === "for" ? waitingAgainst : waitingFor;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => join(s)}
                  disabled={busy}
                  className="rounded-xl border-2 px-3 py-3 text-sm font-bold disabled:opacity-60"
                  style={{ borderColor: SIDE_COLOR[s], color: SIDE_COLOR[s] }}
                >
                  Debate {SIDE_LABEL[s]}
                  <span className="block text-xs font-semibold" style={{ color: "var(--text-dim)" }}>
                    {waiting > 0 ? `${waiting} opponent${waiting === 1 ? "" : "s"} waiting — instant match` : "Join the queue"}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
      {error && (
        <p className="mt-2 text-sm" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
