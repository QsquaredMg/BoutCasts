"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import ShareButton from "@/components/ShareButton";
import type { ShareTarget } from "@/lib/shareLog";
import { HAS_VOTED_KEY } from "@/components/AdInterstitial";
import { isPublicBout, PUBLIC_BOUT_FIELDS } from "@/lib/publicBouts";

type NextBout = { id: string; competitor_a_name: string; competitor_b_name: string };

// Shown right after someone votes: confirms the pick, asks them to share it,
// points them at the next live bout, and invites them to host their own vote.
// This is the screen that turns one voter into more voters and organizers.
export default function AfterVote({
  title,
  pickedName,
  pickedPct,
  graphicUrl,
  excludeBoutId,
  signedIn,
  track,
}: {
  title: string;
  pickedName: string;
  /** Current share for the pick, or null when the tally is hidden. */
  pickedPct: number | null;
  /** Downloadable 1080×1080 vote graphic, when this contest has one. */
  graphicUrl?: string;
  excludeBoutId?: string;
  signedIn: boolean;
  /** What to count shares against in sponsor reports. */
  track?: ShareTarget;
}) {
  const [next, setNext] = useState<NextBout | null | undefined>(undefined);

  useEffect(() => {
    try {
      localStorage.setItem(HAS_VOTED_KEY, "1");
    } catch {
      // storage blocked — ads just stay off for this visitor
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("bouts")
        .select(`id, competitor_a_name, competitor_b_name, ${PUBLIC_BOUT_FIELDS}`)
        .eq("status", "live")
        .order("created_at", { ascending: false })
        .limit(20);
      let rows = ((data ?? []) as unknown as (NextBout & Parameters<typeof isPublicBout>[0])[]).filter(
        (b) => b.id !== excludeBoutId && isPublicBout(b)
      );
      if (signedIn && rows.length) {
        const { data: u } = await supabase.auth.getUser();
        if (u.user) {
          const { data: mine } = await supabase
            .from("votes")
            .select("bout_id")
            .eq("user_id", u.user.id)
            .in("bout_id", rows.map((r) => r.id));
          const done = new Set((mine ?? []).map((v) => v.bout_id));
          rows = rows.filter((r) => !done.has(r.id));
        }
      }
      if (!cancelled) setNext(rows[0] ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [excludeBoutId, signedIn]);

  const shareText = `I voted for ${pickedName} in "${title}" on BoutCasts. Who's your pick? 🗳️`;

  return (
    <div className="min-w-0 rounded-2xl border p-4 sm:p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <p className="text-xs font-extrabold uppercase tracking-[0.12em]" style={{ color: "var(--red)" }}>
        Vote counted ✓
      </p>
      <p className="mt-1 text-lg font-bold leading-tight" style={{ fontFamily: "var(--font-display)" }}>
        You picked {pickedName}
        {pickedPct !== null && (
          <span style={{ color: "var(--text-dim)" }}> · {pickedPct}% agree so far</span>
        )}
      </p>
      <p className="mt-1 text-sm" style={{ color: "var(--text-dim)" }}>
        Every share brings in more votes. Get your people behind your pick.
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <ShareButton title={title} text={shareText} label="📣 Share your vote" big track={track} />
        {graphicUrl && (
          <a
            href={graphicUrl}
            target="_blank"
            rel="noreferrer"
            download
            className="flex min-h-[44px] items-center justify-center rounded-full border px-4 text-sm font-bold"
            style={{ borderColor: "var(--border)", color: "var(--text)" }}
          >
            📸 Save graphic for your story
          </a>
        )}
      </div>

      {next && (
        <Link
          href={`/bout/${next.id}`}
          className="mt-4 flex items-center justify-between gap-3 rounded-xl border px-3 py-3 transition-colors hover:bg-[var(--surface-2)]"
          style={{ borderColor: "var(--border)" }}
        >
          <span className="min-w-0">
            <span className="block text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--text-faint)" }}>
              Up next
            </span>
            <span className="block truncate text-sm font-bold">
              {next.competitor_a_name} vs {next.competitor_b_name}
            </span>
          </span>
          <span className="flex-shrink-0 text-sm font-bold" style={{ color: "var(--red)" }}>
            {signedIn ? "Vote →" : "Watch →"}
          </span>
        </Link>
      )}

      <div
        className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-3"
        style={{ background: "var(--surface-2)" }}
      >
        <span className="text-sm">
          <strong>Running a show, election or game?</strong>{" "}
          <span style={{ color: "var(--text-dim)" }}>Host your own vote.</span>
        </span>
        <Link href="/live-vote/new" className="text-sm font-bold underline" style={{ color: "var(--red)" }}>
          Start free →
        </Link>
      </div>
    </div>
  );
}
