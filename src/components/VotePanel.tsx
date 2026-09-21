"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Props = {
  boutId: string;
  aName: string;
  bName: string;
  initialTally: { a: number; b: number };
  votingOpen: boolean;
};

export default function VotePanel({
  boutId,
  aName,
  bName,
  initialTally,
  votingOpen,
}: Props) {
  const supabase = createClient();
  const router = useRouter();

  const [tally, setTally] = useState(initialTally);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [myVote, setMyVote] = useState<"a" | "b" | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageKind, setMessageKind] = useState<"error" | "info">("info");

  useEffect(() => {
    async function load() {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      setSignedIn(!!user);

      if (user) {
        const { data: existing } = await supabase
          .from("votes")
          .select("side")
          .eq("bout_id", boutId)
          .eq("user_id", user.id)
          .maybeSingle();
        if (existing) setMyVote(existing.side as "a" | "b");
      }
    }
    load();
  }, [boutId, supabase]);

  async function castVote(side: "a" | "b") {
    setMessage(null);
    setPending(true);

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) {
      router.push("/login");
      return;
    }

    const { error } = await supabase
      .from("votes")
      .insert({ bout_id: boutId, user_id: user.id, side });

    if (error) {
      if (error.code === "23505") {
        setMessageKind("error");
        setMessage("You've already voted on this bout.");
      } else {
        setMessageKind("error");
        setMessage(`Vote failed: ${error.message}`);
      }
      setPending(false);
      return;
    }

    setMyVote(side);
    setTally((prev) => ({ ...prev, [side]: prev[side] + 1 }));
    setMessageKind("info");
    setMessage("Vote cast!");
    setPending(false);
  }

  const total = tally.a + tally.b;
  const pctA = total > 0 ? Math.round((tally.a / total) * 100) : 0;
  const pctB = total > 0 ? 100 - pctA : 0;

  const sides: Array<{
    key: "a" | "b";
    name: string;
    pct: number;
    count: number;
    color: string;
    soft: string;
  }> = [
    { key: "a", name: aName, pct: pctA, count: tally.a, color: "var(--red)", soft: "var(--red-soft)" },
    { key: "b", name: bName, pct: pctB, count: tally.b, color: "var(--blue)", soft: "var(--blue-soft)" },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {sides.map((s) => {
        const voted = myVote === s.key;
        return (
          <div
            key={s.key}
            className="flex flex-col gap-3 rounded-2xl border p-4"
            style={{
              background: voted ? s.soft : "var(--surface)",
              borderColor: voted ? s.color : "var(--border)",
            }}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-base font-bold" style={{ fontFamily: "var(--font-display)" }}>
                {s.name}
              </span>
              <span
                className="text-lg font-bold tabular-nums"
                style={{ fontFamily: "var(--font-display)", color: s.color }}
              >
                {s.pct}%
              </span>
            </div>

            <div className="bc-vote-bar">
              <span style={{ width: `${s.pct}%`, background: s.color }} />
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-xs tabular-nums" style={{ color: "var(--text-faint)" }}>
                {s.count} votes
              </span>
              <button
                disabled={!votingOpen || pending || myVote !== null}
                onClick={() => castVote(s.key)}
                className="rounded-[10px] border px-4 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  fontFamily: "var(--font-display)",
                  borderColor: s.color,
                  color: voted ? "#fff" : s.color,
                  background: voted ? s.color : "transparent",
                }}
              >
                {voted ? "Voted ✓" : "Cast Vote →"}
              </button>
            </div>
          </div>
        );
      })}

      {!votingOpen && (
        <p className="col-span-full text-sm" style={{ color: "var(--text-faint)" }}>
          Voting is closed for this bout.
        </p>
      )}

      {signedIn === false && (
        <p className="col-span-full text-sm" style={{ color: "var(--text-faint)" }}>
          <a href="/login" className="font-semibold underline" style={{ color: "var(--red)" }}>
            Sign in
          </a>{" "}
          to cast your vote.
        </p>
      )}

      {message && (
        <p
          className="col-span-full text-sm font-medium"
          style={{ color: messageKind === "error" ? "var(--red)" : "var(--blue)" }}
        >
          {message}
        </p>
      )}
    </div>
  );
}
