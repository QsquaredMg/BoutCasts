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
      // Postgres unique_violation
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

  return (
    <div>
      <div className="mb-4">
        <div className="flex h-3 overflow-hidden rounded-full bg-neutral-200">
          <div className="h-full bg-red-500" style={{ width: `${pctA}%` }} />
          <div className="h-full bg-blue-500" style={{ width: `${pctB}%` }} />
        </div>
        <div className="mt-1 flex justify-between text-sm text-neutral-600">
          <span>
            {aName}: {pctA}% ({tally.a} votes)
          </span>
          <span>
            {bName}: {pctB}% ({tally.b} votes)
          </span>
        </div>
      </div>

      {votingOpen ? (
        <div className="grid grid-cols-2 gap-3">
          <button
            disabled={pending || myVote !== null}
            onClick={() => castVote("a")}
            className={`rounded-lg border-2 py-3 font-semibold transition ${
              myVote === "a"
                ? "border-red-500 bg-red-50 text-red-700"
                : "border-neutral-300 hover:border-red-400"
            } disabled:cursor-not-allowed disabled:opacity-60`}
          >
            {myVote === "a" ? "Voted ✓" : `Vote ${aName}`}
          </button>
          <button
            disabled={pending || myVote !== null}
            onClick={() => castVote("b")}
            className={`rounded-lg border-2 py-3 font-semibold transition ${
              myVote === "b"
                ? "border-blue-500 bg-blue-50 text-blue-700"
                : "border-neutral-300 hover:border-blue-400"
            } disabled:cursor-not-allowed disabled:opacity-60`}
          >
            {myVote === "b" ? "Voted ✓" : `Vote ${bName}`}
          </button>
        </div>
      ) : (
        <p className="text-sm text-neutral-500">Voting is closed for this bout.</p>
      )}

      {signedIn === false && (
        <p className="mt-3 text-sm text-neutral-500">
          <a href="/login" className="font-medium text-red-600 underline">
            Sign in
          </a>{" "}
          to cast your vote.
        </p>
      )}

      {message && (
        <p
          className={`mt-3 text-sm ${
            messageKind === "error" ? "text-red-600" : "text-green-700"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
