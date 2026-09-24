import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { cloutTierFor } from "@/lib/clout";
import FollowButton from "@/components/FollowButton";
import AppealButton from "@/components/AppealButton";
import type { Badge, UserBadge, PointEvent, Submission } from "@/lib/types";
import ClipSourceTag from "@/components/ClipSourceTag";
import ProfileAvatarUpload from "@/components/ProfileAvatarUpload";

const REASON_LABEL: Record<string, string> = {
  vote_cast: "Voted on a bout",
  submission_approved: "Submission approved",
  streak_bonus: "Voting streak bonus",
  referral_signup: "Referral signup bonus",
  challenge_accepted: "Challenge accepted",
};

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, points, current_streak, longest_streak, created_at, avatar_url")
    .eq("username", username)
    .maybeSingle();

  if (!profile) {
    notFound();
  }

  const { data: userData } = await supabase.auth.getUser();
  const viewer = userData.user;
  const isOwnProfile = viewer?.id === profile.id;

  const [
    { data: badgeRows },
    { data: pointRows },
    { data: submissionRows },
    { count: followerCount },
    { count: followingCount },
    { data: viewerFollow },
    { data: otherRows },
  ] = await Promise.all([
    supabase
      .from("user_badges")
      .select("*, badges(*)")
      .eq("user_id", profile.id)
      .order("awarded_at", { ascending: false }),
    supabase
      .from("point_events")
      .select("*")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(15),
    supabase
      .from("submissions")
      .select("*, categories(name)")
      .eq("user_id", profile.id)
      .eq("status", "approved")
      .order("created_at", { ascending: false }),
    supabase
      .from("follows")
      .select("follower_id", { count: "exact", head: true })
      .eq("followed_id", profile.id),
    supabase
      .from("follows")
      .select("followed_id", { count: "exact", head: true })
      .eq("follower_id", profile.id),
    viewer
      ? supabase
          .from("follows")
          .select("follower_id")
          .eq("follower_id", viewer.id)
          .eq("followed_id", profile.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    isOwnProfile
      ? supabase
          .from("submissions")
          .select("*, categories(name)")
          .eq("user_id", profile.id)
          .in("status", ["pending", "rejected", "appealed"])
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: null }),
  ]);

  const badges = (badgeRows ?? []) as UserBadge[];
  const pointEvents = (pointRows ?? []) as PointEvent[];
  const submissions = (submissionRows ?? []) as Submission[];
  const otherSubmissions = (otherRows ?? []) as Submission[];

  const submissionIds = submissions.map((s) => s.id);
  const { data: tiedBoutRows } = submissionIds.length
    ? await supabase
        .from("bouts")
        .select("id, title, status, bout_mode, competitor_a_submission_id, competitor_b_submission_id")
        .or(
          `competitor_a_submission_id.in.(${submissionIds.join(",")}),competitor_b_submission_id.in.(${submissionIds.join(",")})`
        )
    : { data: [] as { id: string; title: string; status: string; bout_mode: string; competitor_a_submission_id: string | null; competitor_b_submission_id: string | null }[] };
  const boutBySubmissionId = new Map<string, { id: string; title: string; status: string; bout_mode: string }>();
  for (const b of tiedBoutRows ?? []) {
    if (b.competitor_a_submission_id) boutBySubmissionId.set(b.competitor_a_submission_id, b);
    if (b.competitor_b_submission_id) boutBySubmissionId.set(b.competitor_b_submission_id, b);
  }
  const clout = cloutTierFor(profile.points ?? 0);
  const initial = (profile.username ?? "?").slice(0, 1).toUpperCase();
  const memberSince = new Date(profile.created_at).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <Link href="/leaderboard" className="mb-4 inline-block text-sm font-semibold" style={{ color: "var(--blue)" }}>
        &larr; Back to leaderboard
      </Link>

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="flex flex-col items-center gap-1.5">
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar_url}
              alt={`${profile.username} avatar`}
              className="h-16 w-16 rounded-2xl object-cover"
              style={{ boxShadow: "inset 0 0 0 1px var(--border)" }}
            />
          ) : (
            <div
              className="flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-bold"
              style={{ background: "var(--blue)", color: "var(--bg)", fontFamily: "var(--font-display)" }}
            >
              {initial}
            </div>
          )}
          {isOwnProfile && <ProfileAvatarUpload userId={profile.id} />}
        </div>
        <div className="min-w-[180px] flex-1">
          <h1 className="flex items-center gap-2 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
            {profile.username}
          </h1>
          <p className="text-sm" style={{ color: "var(--text-faint)" }}>
            Member since {memberSince} &middot; {followerCount ?? 0} follower{(followerCount ?? 0) === 1 ? "" : "s"} &middot; {followingCount ?? 0} following
          </p>
        </div>
        {isOwnProfile ? (
          <span className="rounded-lg border px-4 py-2 text-sm font-bold" style={{ borderColor: "var(--border)", color: "var(--text-faint)" }}>
            This is you
          </span>
        ) : (
          <FollowButton targetId={profile.id} initialFollowing={!!viewerFollow} />
        )}
      </div>

      <div className="mb-8 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {[
          { v: profile.points ?? 0, l: "Points" },
          { v: profile.current_streak ?? 0, l: "Streak" },
          { v: profile.longest_streak ?? 0, l: "Best streak" },
          { v: submissions.length, l: "Approved bouts" },
        ].map((stat) => (
          <div key={stat.l} className="bc-card p-3.5 text-center">
            <div className="text-xl font-bold tabular-nums" style={{ fontFamily: "var(--font-display)" }}>
              {stat.v}
            </div>
            <div className="mt-0.5 text-[11px] uppercase tracking-wide" style={{ color: "var(--text-faint)" }}>
              {stat.l}
            </div>
          </div>
        ))}
      </div>

      <div className="bc-card mb-8 p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <span className="text-sm font-bold" style={{ fontFamily: "var(--font-display)" }}>
            Clout: <span style={{ color: "var(--red)" }}>{clout.tier}</span>
          </span>
          {clout.next && (
            <span className="text-xs" style={{ color: "var(--text-faint)" }}>
              {clout.next.min - (profile.points ?? 0)} pts to {clout.next.name}
            </span>
          )}
        </div>
        <div className="mb-4 h-2 overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}>
          <div className="h-full rounded-full" style={{ width: `${clout.pct}%`, background: "var(--red)" }} />
        </div>
        {badges.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {badges.map((ub) => {
              const badge = ub.badges as Badge | null;
              if (!badge) return null;
              return (
                <span key={ub.id} title={badge.description} className="bc-badge-gold flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold">
                  <span>{badge.icon}</span>
                  {badge.name}
                </span>
              );
            })}
          </div>
        ) : (
          <p className="text-sm" style={{ color: "var(--text-faint)" }}>No badges yet.</p>
        )}
      </div>

      {submissions.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-3 text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>
            Bouts &amp; videos
          </h2>
          <div className="bc-card overflow-hidden">
            {submissions.map((s, i) => {
              const bout = boutBySubmissionId.get(s.id);
              return (
                <div
                  key={s.id}
                  className="flex items-center gap-3 px-4 py-3"
                  style={{ borderTop: i > 0 ? "1px solid var(--border)" : "none" }}
                >
                  <div className="flex-1">
                    <div className="text-sm font-bold">{s.title}</div>
                    <div className="mt-1 flex items-center gap-2 text-xs" style={{ color: "var(--text-faint)" }}>
                      <ClipSourceTag sourceType={s.source_type} sourceUrl={s.source_url} />
                      <span>
                        {s.categories?.name}
                        {s.crew_name ? ` · Crew: ${s.crew_name}` : ""}
                      </span>
                    </div>
                  </div>
                  {bout ? (
                    <Link
                      href={`/bout/${bout.id}`}
                      className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                      style={{
                        fontFamily: "var(--font-display)",
                        background: bout.status === "final" ? "var(--gold-soft)" : "var(--red-soft)",
                        color: bout.status === "final" ? "var(--gold)" : "var(--red)",
                      }}
                    >
                      {bout.bout_mode === "open" ? "Open bout" : "Bout"} &rarr;
                    </Link>
                  ) : (
                    <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase" style={{ background: "var(--surface-2)", color: "var(--text-faint)" }}>
                      Awaiting match
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isOwnProfile && otherSubmissions.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-3 text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>
            Your other submissions
          </h2>
          <div className="bc-card overflow-hidden">
            {otherSubmissions.map((s, i) => {
              const statusStyle =
                s.status === "pending"
                  ? { background: "var(--surface-2)", color: "var(--text-dim)" }
                  : s.status === "appealed"
                  ? { background: "var(--gold-soft)", color: "var(--gold)" }
                  : { background: "var(--red-soft)", color: "var(--red)" };
              return (
                <div
                  key={s.id}
                  className="flex items-center gap-3 px-4 py-3"
                  style={{ borderTop: i > 0 ? "1px solid var(--border)" : "none" }}
                >
                  <div className="flex-1">
                    <div className="text-sm font-bold">{s.title}</div>
                    <div className="mt-1 flex items-center gap-2 text-xs" style={{ color: "var(--text-faint)" }}>
                      <ClipSourceTag sourceType={s.source_type} sourceUrl={s.source_url} />
                      <span>{s.categories?.name}</span>
                    </div>
                    {s.status === "appealed" && s.appeal_message && (
                      <div className="mt-1 text-xs italic" style={{ color: "var(--text-faint)" }}>
                        Your appeal: &ldquo;{s.appeal_message}&rdquo;
                      </div>
                    )}
                  </div>
                  <span
                    className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase"
                    style={{ fontFamily: "var(--font-display)", ...statusStyle }}
                  >
                    {s.status}
                  </span>
                  {s.status === "rejected" && <AppealButton submissionId={s.id} />}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-3 text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>
          Recent activity
        </h2>
        {pointEvents.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-faint)" }}>No activity yet.</p>
        ) : (
          <div className="bc-card overflow-hidden">
            {pointEvents.map((e, i) => (
              <div
                key={e.id}
                className="flex items-center gap-3 px-4 py-3"
                style={{ borderTop: i > 0 ? "1px solid var(--border)" : "none" }}
              >
                <div className="flex-1 text-sm font-semibold">
                  {REASON_LABEL[e.reason] ?? e.reason}
                </div>
                <div className="text-xs" style={{ color: "var(--text-faint)" }}>
                  {new Date(e.created_at).toLocaleDateString()}
                </div>
                <div className="text-sm font-bold tabular-nums" style={{ fontFamily: "var(--font-display)", color: "var(--blue)" }}>
                  +{e.points}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
