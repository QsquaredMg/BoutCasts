"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import AfterVote from "@/components/AfterVote";

// Guests (no account) get one free bout vote per day, tracked by a random
// token kept on this device. The database also caps free votes per network.
const GUEST_TOKEN_KEY = "bc_guest_vote_token";

function getGuestToken(): string {
  try {
    let t = localStorage.getItem(GUEST_TOKEN_KEY);
    if (!t) {
      t = `${crypto.randomUUID()}-${crypto.randomUUID()}`;
      localStorage.setItem(GUEST_TOKEN_KEY, t);
    }
    return t;
  } catch {
    // Storage blocked (private mode etc.) — a per-visit token still works,
    // and the per-network cap keeps it fair.
    return `${crypto.randomUUID()}-${crypto.randomUUID()}`;
  }
}

function resetTime(iso: string | null): string {
  if (!iso) return "tomorrow";
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) === "12:00 AM"
    ? "midnight"
    : new Date(iso).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" });
}

type Props = {
  boutId: string;
  /** Bout title, used in the share message. */
  title?: string;
  aName: string;
  bName: string;
  initialTally: { a: number; b: number };
  votingOpen: boolean;
  /** True while a bracket slot is still waiting on an earlier round's winner. */
  awaitingOpponent?: boolean;
};

export default function VotePanel({
  boutId,
  title,
  aName,
  bName,
  initialTally,
  votingOpen,
  awaitingOpponent = false,
}: Props) {
  const supabase = createClient();

  const [tally, setTally] = useState(initialTally);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [myVote, setMyVote] = useState<"a" | "b" | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageKind, setMessageKind] = useState<"error" | "info">("info");
  // Guest state: used today's free vote (on this or another bout).
  const [guestUsedToday, setGuestUsedToday] = useState(false);
  const [guestVotedHere, setGuestVotedHere] = useState(false);
  const [resetsAt, setResetsAt] = useState<string | null>(null);

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
      } else {
        const { data: status } = await supabase.rpc("get_guest_vote_status", { p_guest_token: getGuestToken() });
        const st = status as { voted_today: boolean; bout_id: string | null; side: "a" | "b" | null; resets_at: string } | null;
        if (st) {
          setResetsAt(st.resets_at);
          setGuestUsedToday(st.voted_today);
          if (st.voted_today && st.bout_id === boutId && st.side) {
            setMyVote(st.side);
            setGuestVotedHere(true);
          }
        }
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
      const { data, error } = await supabase.rpc("cast_guest_bout_vote", {
        p_bout_id: boutId,
        p_side: side,
        p_guest_token: getGuestToken(),
      });
      setPending(false);
      if (error) {
        const m = error.message ?? "";
        setMessageKind("error");
        if (m.includes("guest_limit")) {
          setGuestUsedToday(true);
          setMessage(m.split("guest_limit:")[1]?.trim() || "You've used your free vote for today.");
        } else if (m.includes("closed:")) {
          setMessage("Voting is closed for this bout.");
        } else {
          setMessage("Your vote didn't go through. Please try again.");
        }
        return;
      }
      const res = data as { resets_at?: string } | null;
      if (res?.resets_at) setResetsAt(res.resets_at);
      setMyVote(side);
      setGuestVotedHere(true);
      setGuestUsedToday(true);
      setTally((prev) => ({ ...prev, [side]: prev[side] + 1 }));
      setMessage(null);
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
    setMessage(null);
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
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                {s.count} {s.count === 1 ? "vote" : "votes"}
              </span>
              <button
                disabled={!votingOpen || pending || myVote !== null || (signedIn === false && guestUsedToday)}
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
          {awaitingOpponent
            ? "Voting opens once both competitors are set — waiting on the previous round to finish."
            : "Voting is closed for this bout."}
        </p>
      )}

      {signedIn === false && votingOpen && !guestUsedToday && myVote === null && (
        <p className="col-span-full text-sm" style={{ color: "var(--text-faint)" }}>
          No account needed — you get <strong>1 free vote a day</strong>.{" "}
          <Link href={`/signup?next=${encodeURIComponent(`/bout/${boutId}`)}`} className="font-semibold underline" style={{ color: "var(--red)" }}>
            Sign up free
          </Link>{" "}
          to vote on every bout.
        </p>
      )}

      {myVote !== null && signedIn !== null && (
        <div className="col-span-full min-w-0">
          <AfterVote
            title={title || `${aName} vs ${bName}`}
            pickedName={myVote === "a" ? aName : bName}
            pickedPct={myVote === "a" ? pctA : pctB}
            graphicUrl={`/api/bouts/${boutId}/vote-card`}
            excludeBoutId={boutId}
            signedIn={signedIn}
            track={{ type: "bout", id: boutId }}
          />
        </div>
      )}

      {signedIn === false && (guestVotedHere || guestUsedToday) && (
        <div
          className="col-span-full relative overflow-hidden rounded-2xl p-5"
          style={{ background: "#0a0e1a", color: "#fff" }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute"
            style={{ right: -70, top: -60, width: 110, height: 320, background: "#1b4fe4", transform: "rotate(14deg)" }}
          />
          <div className="relative max-w-[78%]">
            <p className="text-xs font-extrabold uppercase tracking-[0.12em]" style={{ color: "#9fb8ff" }}>
              {guestVotedHere ? "Vote counted ✓" : "Free vote used"}
            </p>
            <p className="mt-1 text-lg font-bold leading-tight" style={{ fontFamily: "var(--font-display)" }}>
              {guestVotedHere
                ? "Want to vote on every bout?"
                : "You've used today's free vote."}
            </p>
            <p className="mt-1.5 text-sm" style={{ color: "#c9d0e0" }}>
              Guests get 1 vote a day (next one at {resetTime(resetsAt)}). Create a free account to vote on every
              bout, earn points and badges, and build your streak.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href={`/signup?next=${encodeURIComponent(`/bout/${boutId}`)}`}
                className="inline-flex min-h-[42px] items-center rounded-full px-4 text-sm font-bold"
                style={{ background: "#1b4fe4", color: "#fff" }}
              >
                Create a free account
              </Link>
              <Link
                href={`/login?next=${encodeURIComponent(`/bout/${boutId}`)}`}
                className="inline-flex min-h-[42px] items-center rounded-full border-2 px-4 text-sm font-bold"
                style={{ borderColor: "rgba(255,255,255,0.35)", color: "#fff" }}
              >
                Sign in
              </Link>
            </div>
          </div>
        </div>
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
