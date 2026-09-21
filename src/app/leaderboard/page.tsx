import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Badge, UserBadge } from "@/lib/types";
import ChallengeButton from "@/components/ChallengeButton";
import { cloutTierFor } from "@/lib/clout";

export default async function LeaderboardPage() {
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  const { data: topProfiles } = await supabase
    .from("profiles")
    .select("id, username, points")
    .order("points", { ascending: false })
    .limit(25);

  let myBadges: UserBadge[] = [];
  let myPoints: number | null = null;
  let myStreak = 0;
  let myLongestStreak = 0;
  if (user) {
    const [{ data: badgeRows }, { data: myProfile }] = await Promise.all([
      supabase
        .from("user_badges")
        .select("*, badges(*)")
        .eq("user_id", user.id)
        .order("awarded_at", { ascending: false }),
      supabase
        .from("profiles")
        .select("points, current_streak, longest_streak")
        .eq("id", user.id)
        .maybeSingle(),
    ]);
    myBadges = (badgeRows ?? []) as UserBadge[];
    myPoints = myProfile?.points ?? 0;
    myStreak = myProfile?.current_streak ?? 0;
    myLongestStreak = myProfile?.longest_streak ?? 0;
  }

  const clout = cloutTierFor(myPoints ?? 0);

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <Link href="/" className="mb-4 inline-block text-sm font-semibold" style={{ color: "var(--blue)" }}>
        &larr; Back to matchups
      </Link>
      <h1 className="mb-1 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
        Leaderboard
      </h1>
      <p className="mb-6 text-sm" style={{ color: "var(--text-faint)" }}>
        Points for voting and getting submissions approved.
      </p>

      {user && (
        <div className="bc-card mb-8 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold" style={{ color: "var(--text-dim)" }}>
              Your points
            </span>
            <span
              className="text-xl font-bold"
              style={{ fontFamily: "var(--font-display)", color: "var(--red)" }}
            >
              {myPoints ?? 0}
            </span>
          </div>

          {myStreak > 0 && (
            <div
              className="mb-3 inline-flex items-center gap-2 rounded-full px-4 py-2"
              style={{ background: "var(--gold-soft)" }}
            >
              <span>🔥</span>
              <span className="text-sm font-bold" style={{ fontFamily: "var(--font-display)", color: "var(--gold)" }}>
                {myStreak} day streak
              </span>
              {myLongestStreak > myStreak && (
                <span className="text-xs" style={{ color: "var(--text-faint)" }}>
                  (best: {myLongestStreak})
                </span>
              )}
            </div>
          )}

          <div className="mb-4">
            <div className="mb-1 flex items-baseline justify-between">
              <span className="text-sm font-bold" style={{ fontFamily: "var(--font-display)" }}>
                Clout: <span style={{ color: "var(--red)" }}>{clout.tier}</span>
              </span>
              {clout.next && (
                <span className="text-xs" style={{ color: "var(--text-faint)" }}>
                  {clout.next.min - (myPoints ?? 0)} pts to {clout.next.name}
                </span>
              )}
            </div>
            <div className="h-2 overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}>
              <div className="h-full rounded-full" style={{ width: `${clout.pct}%`, background: "var(--red)" }} />
            </div>
          </div>

          {myBadges.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {myBadges.map((ub) => {
                const badge = ub.badges as Badge | null;
                if (!badge) return null;
                return (
                  <span
                    key={ub.id}
                    title={badge.description}
                    className="bc-badge-gold flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold"
                  >
                    <span>{badge.icon}</span>
                    {badge.name}
                  </span>
                );
              })}
            </div>
          ) : (
            <p className="text-sm" style={{ color: "var(--text-faint)" }}>
              No badges yet — vote on a bout to earn your first one.
            </p>
          )}
        </div>
      )}

      <div className="bc-card overflow-hidden">
        {(topProfiles ?? []).length === 0 ? (
          <p className="p-4 text-sm" style={{ color: "var(--text-faint)" }}>
            No points on the board yet.
          </p>
        ) : (
          <ol>
            {(topProfiles ?? []).map((p, i) => (
              <li
                key={p.id}
                className="flex items-center gap-3.5 px-4 py-3.5"
                style={{
                  borderTop: i > 0 ? "1px solid var(--border)" : "none",
                  background: p.id === user?.id ? "var(--red-soft)" : "transparent",
                }}
              >
                <span
                  className="w-6 text-right text-base font-bold"
                  style={{ fontFamily: "var(--font-display)", color: i === 0 ? "var(--gold)" : "var(--text-faint)" }}
                >
                  {i + 1}
                </span>
                <Link href={`/profile/${p.username}`} className="flex-1 text-sm font-bold hover:underline">
                  {p.username}
                </Link>
                {user && p.id !== user.id && (
                  <ChallengeButton opponentId={p.id} opponentName={p.username ?? "this creator"} />
                )}
                <span
                  className="text-base font-bold tabular-nums"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {p.points}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
