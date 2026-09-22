import Link from "next/link";
import SponsorBadge from "@/components/SponsorBadge";
import { createClient } from "@/lib/supabase/server";
import VotePanel from "@/components/VotePanel";
import CrowdComments from "@/components/CrowdComments";
import ShareButton from "@/components/ShareButton";
import ReportButton from "@/components/ReportButton";
import ContributeButton from "@/components/ContributeButton";
import ClipSourceTag from "@/components/ClipSourceTag";
import ClipPlayer from "@/components/ClipPlayer";
import AdBanner from "@/components/AdBanner";
import { getClipSourceTag } from "@/lib/clipSource";

// The full "duel" card — vote bars, sponsor banner, prize pool, comments —
// shared between the standalone /bout/[id] page and the BoutCard homepage,
// which features the platform's current live bout in the same layout.
export default async function FeaturedBout({
  boutId,
  showBackLink = false,
}: {
  boutId: string;
  showBackLink?: boolean;
}) {
  const supabase = await createClient();

  const { data: bout } = await supabase
    .from("bouts")
    .select(
      "*, categories(name, sponsor_id, sponsors(name, logo_url, website_url, opportunity_type, banner_style)), sponsors(name, logo_url, website_url, opportunity_type, banner_style)"
    )
    .eq("id", boutId)
    .maybeSingle();

  if (!bout) {
    return null;
  }

  const [{ data: subA }, { data: subB }] = await Promise.all([
    bout.competitor_a_submission_id
      ? supabase
          .from("submissions")
          .select("source_type, source_url")
          .eq("id", bout.competitor_a_submission_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    bout.competitor_b_submission_id
      ? supabase
          .from("submissions")
          .select("source_type, source_url")
          .eq("id", bout.competitor_b_submission_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // A player only makes sense for clips we host ourselves (uploaded or
  // recorded in-app) — an external link just opens on its own site, so
  // there's no playback here to gate with a pre-roll.
  function playableClip(sub: { source_type: string; source_url: string | null } | null) {
    if (!sub?.source_url) return null;
    if (sub.source_type !== "upload" && sub.source_type !== "record") return null;
    return { url: sub.source_url, isAudio: getClipSourceTag(sub.source_type, sub.source_url).isAudio };
  }
  const playableA = playableClip(subA);
  const playableB = playableClip(subB);

  const { data: votes } = await supabase.from("votes").select("side").eq("bout_id", boutId);

  const tally = { a: 0, b: 0 };
  for (const v of votes ?? []) {
    tally[v.side as "a" | "b"]++;
  }

  const votingOpen = bout.status !== "final";

  let nextBoutTitle: string | null = null;
  if (bout.next_bout_id) {
    const { data: nextBout } = await supabase
      .from("bouts")
      .select("title")
      .eq("id", bout.next_bout_id)
      .maybeSingle();
    nextBoutTitle = nextBout?.title ?? null;
  }

  const winnerName =
    bout.winner_side === "a"
      ? bout.competitor_a_name
      : bout.winner_side === "b"
      ? bout.competitor_b_name
      : null;

  const sponsor = bout.sponsors ?? bout.categories?.sponsors;

  const { data: pool } = await supabase
    .from("prize_pools")
    .select("id, goal_amount")
    .eq("bout_id", boutId)
    .maybeSingle();

  let poolRaised = 0;
  if (pool) {
    const { data: contributions } = await supabase
      .from("pool_contributions")
      .select("amount")
      .eq("pool_id", pool.id);
    poolRaised = (contributions ?? []).reduce((sum, c) => sum + c.amount, 0);
  }
  const poolPct = pool ? Math.min(100, Math.round((poolRaised / pool.goal_amount) * 100)) : 0;

  return (
    <div className="bc-card p-5">
      {showBackLink && (
        <Link
          href="/matchups"
          className="mb-4 inline-block text-sm font-semibold"
          style={{ color: "var(--blue)" }}
        >
          &larr; Back to matchups
        </Link>
      )}

      <div className="mb-3 flex items-center gap-2 flex-wrap">
        {bout.status === "live" && (
          <>
            <span className="bc-live-dot" />
            <span
              className="text-xs font-bold uppercase tracking-wide"
              style={{ fontFamily: "var(--font-display)", color: "var(--red)" }}
            >
              LIVE VOTE
            </span>
          </>
        )}
        <span className="text-xs" style={{ color: "var(--text-faint)" }}>
          {bout.categories?.name ?? "Uncategorized"}
          {bout.bracket_key && (
            <>
              {" · "}
              <Link
                href={`/bracket/${bout.bracket_key}`}
                className="underline"
                style={{ color: "var(--text-dim)" }}
              >
                Round {bout.round_number} · View bracket
              </Link>
            </>
          )}
        </span>
        <span
          className="ml-auto rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase"
          style={{
            fontFamily: "var(--font-display)",
            background: bout.status === "final" ? "var(--gold-soft)" : "var(--surface-2)",
            color: bout.status === "final" ? "var(--gold)" : "var(--text-dim)",
          }}
        >
          {bout.status}
        </span>
      </div>

      <h1 className="mb-1 text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
        {bout.title}
      </h1>

      {sponsor && (
        <div className="mb-4 text-xs font-medium" style={{ color: "var(--text-faint)" }}>
          {sponsor.website_url ? (
            <a href={sponsor.website_url} target="_blank" rel="noreferrer" className="underline">
              <SponsorBadge sponsor={sponsor} />
            </a>
          ) : (
            <SponsorBadge sponsor={sponsor} />
          )}
        </div>
      )}

      {bout.status === "final" && winnerName && (
        <div
          className="mb-4 rounded-xl p-3 text-center text-sm font-bold"
          style={{ background: "var(--gold-soft)", color: "var(--gold)" }}
        >
          🏆 {winnerName} wins this round
          {nextBoutTitle && <> — advances to &quot;{nextBoutTitle}&quot;</>}
        </div>
      )}

      {votingOpen && bout.closes_at && (
        <p className="mb-4 text-center text-xs" style={{ color: "var(--text-faint)" }}>
          Voting closes {new Date(bout.closes_at).toLocaleString()}
        </p>
      )}

      {bout.round_theme_name && (
        <div
          className="mb-3 rounded-xl border p-3 text-sm"
          style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
        >
          <div className="font-bold" style={{ fontFamily: "var(--font-display)" }}>
            📜 Round theme: {bout.round_theme_name}
          </div>
        </div>
      )}

      {bout.round_theme_rules && (
        <div
          className="mb-5 rounded-xl border p-3 text-sm"
          style={{ borderColor: "var(--border)", color: "var(--text-dim)" }}
        >
          <div className="mb-1 font-bold" style={{ color: "var(--text)" }}>
            Round rules
          </div>
          {bout.round_theme_rules}
        </div>
      )}

      {pool && (
        <div
          className="mb-5 rounded-xl border p-3"
          style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
        >
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="font-bold" style={{ fontFamily: "var(--font-display)" }}>
              🪙 Prize pool
            </span>
            <span style={{ color: "var(--text-faint)" }}>
              {poolRaised} of {pool.goal_amount} BB
            </span>
          </div>
          <div className="mb-2 h-2 overflow-hidden rounded-full" style={{ background: "var(--surface)" }}>
            <div
              className="h-full rounded-full"
              style={{ width: `${poolPct}%`, background: "var(--blue)" }}
            />
          </div>
          <ContributeButton poolId={pool.id} />
        </div>
      )}

      {(bout.seed_a || subA || bout.seed_b || subB) && (
        <div className="mb-3 grid gap-3 sm:grid-cols-2">
          <div className="flex items-center gap-2">
            {bout.seed_a && (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                style={{ background: "var(--surface-2)", color: "var(--text-faint)" }}
              >
                #{bout.seed_a} SEED
              </span>
            )}
            {subA && <ClipSourceTag sourceType={subA.source_type} sourceUrl={subA.source_url} />}
          </div>
          <div className="flex items-center gap-2">
            {bout.seed_b && (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                style={{ background: "var(--surface-2)", color: "var(--text-faint)" }}
              >
                #{bout.seed_b} SEED
              </span>
            )}
            {subB && <ClipSourceTag sourceType={subB.source_type} sourceUrl={subB.source_url} />}
          </div>
        </div>
      )}

      {(playableA || playableB) && (
        <div className="mb-5 grid gap-3 sm:grid-cols-2">
          <div>
            {playableA ? (
              <ClipPlayer src={playableA.url} isAudio={playableA.isAudio} label={bout.competitor_a_name} />
            ) : (
              <div />
            )}
          </div>
          <div>
            {playableB ? (
              <ClipPlayer src={playableB.url} isAudio={playableB.isAudio} label={bout.competitor_b_name} />
            ) : (
              <div />
            )}
          </div>
        </div>
      )}

      <VotePanel
        boutId={bout.id}
        aName={bout.competitor_a_name}
        bName={bout.competitor_b_name}
        initialTally={tally}
        votingOpen={votingOpen}
      />

      <div className="mt-4">
        <AdBanner />
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-faint)" }}>
          🔒 Verified voting — one vote per account
        </p>
        <div className="flex items-center gap-3">
          <a
            href={`/api/bouts/${bout.id}/vote-card`}
            target="_blank"
            rel="noreferrer"
            className="flex-shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold"
            style={{ borderColor: "var(--border)", color: "var(--text-dim)" }}
          >
            📊 Vote graphic
          </a>
          <ShareButton title={bout.title} />
          <ReportButton targetType="bout" targetId={bout.id} />
        </div>
      </div>

      <CrowdComments boutId={bout.id} />
    </div>
  );
}
