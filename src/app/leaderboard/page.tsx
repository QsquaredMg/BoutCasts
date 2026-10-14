import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Badge, UserBadge } from "@/lib/types";
import ChallengeButton from "@/components/ChallengeButton";
import { cloutTierFor } from "@/lib/clout";
import { effectiveStreak, streakAtRisk } from "@/lib/streak";
import MyTeamPicker from "@/components/MyTeamPicker";
import { absoluteLogo } from "@/lib/teams/directory";

export const metadata: Metadata = { title: "Leaderboard", description: "Top creators and fans on BoutCasts — wins, votes and badges." };

type TeamRow = {
  team_id: string; name: string; full_name: string; league: string; conference: string | null; logo_url: string | null;
  fans: number; points: number; points_per_fan: number; best_streak: number;
};

export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  const showTeams = view === "teams";
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
  let myAtRisk = false;
  let myTeam: { id: string; name: string; logo: string | null } | null = null;
  if (user) {
    const [{ data: badgeRows }, { data: myProfile }] = await Promise.all([
      supabase
        .from("user_badges")
        .select("*, badges(*)")
        .eq("user_id", user.id)
        .order("awarded_at", { ascending: false }),
      supabase
        .from("profiles")
        .select("points, current_streak, longest_streak, last_vote_date, favorite_team_id")
        .eq("id", user.id)
        .maybeSingle(),
    ]);
    myBadges = (badgeRows ?? []) as UserBadge[];
    myPoints = myProfile?.points ?? 0;
    myStreak = effectiveStreak(myProfile?.current_streak, myProfile?.last_vote_date);
    myAtRisk = streakAtRisk(myProfile?.current_streak, myProfile?.last_vote_date);
    myLongestStreak = myProfile?.longest_streak ?? 0;
    if (myProfile?.favorite_team_id) {
      const { data: t } = await supabase.from("team_directory").select("id, name, logo_url").eq("id", myProfile.favorite_team_id).maybeSingle();
      if (t) myTeam = { id: t.id, name: t.name, logo: t.logo_url ? absoluteLogo(t.logo_url) : null };
    }
  }

  let teamRows: TeamRow[] = [];
  if (showTeams) {
    const { data } = await supabase.rpc("team_leaderboard", { p_limit: 50 });
    teamRows = (data ?? []) as TeamRow[];
  }

  const clout = cloutTierFor(myPoints ?? 0);

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <Link href="/matchups" className="mb-4 inline-block text-sm font-semibold" style={{ color: "var(--blue)" }}>
        &larr; Back to matchups
      </Link>
      <h1 className="mb-1 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
        Leaderboard
      </h1>
      <p className="mb-6 text-sm" style={{ color: "var(--text-faint)" }}>
        Points for voting, predicting and getting submissions approved.
      </p>

      <div className="mb-5 flex gap-2" role="tablist" aria-label="Leaderboard">
        {[
          { key: "players", label: "Players", href: "/leaderboard" },
          { key: "teams", label: "Schools & teams", href: "/leaderboard?view=teams" },
        ].map((t) => {
          const active = (t.key === "teams") === showTeams;
          return (
            <Link key={t.key} href={t.href} role="tab" aria-selected={active} className="rounded-full px-4 py-1.5 text-sm font-bold" style={active ? { background: "var(--blue)", color: "#fff" } : { background: "var(--surface-2)", color: "var(--text-dim)" }}>
              {t.label}
            </Link>
          );
        })}
      </div>

      {user && myAtRisk && (
        <p className="mb-5 rounded-xl px-4 py-3 text-sm font-semibold" style={{ background: "var(--gold-soft)", color: "var(--gold)" }}>
          🔥 Your {myStreak}-day streak ends tonight. Vote or predict once today to keep it.
        </p>
      )}

      {showTeams ? (
        <>
          {user && <MyTeamPicker current={myTeam} />}
          {teamRows.length === 0 ? (
            <p className="bc-card p-4 text-sm" style={{ color: "var(--text-faint)" }}>
              No teams on the board yet. Pick yours to start the rivalry.
            </p>
          ) : (
            <ol className="bc-card overflow-hidden">
              {teamRows.map((t, i) => (
                <li key={t.team_id} className="flex items-center gap-3 px-4 py-3.5" style={{ borderTop: i > 0 ? "1px solid var(--border)" : "none", background: t.team_id === myTeam?.id ? "var(--red-soft)" : "transparent" }}>
                  <span className="w-6 text-right text-base font-bold" style={{ fontFamily: "var(--font-display)", color: i === 0 ? "var(--gold)" : "var(--text-faint)" }}>{i + 1}</span>
                  {t.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.logo_url} alt="" width={36} height={36} loading="lazy" className="h-9 w-9 shrink-0 object-contain" />
                  ) : (
                    <span className="h-9 w-9 shrink-0" aria-hidden />
                  )}
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{t.name}</span>
                    <span className="block truncate text-xs" style={{ color: "var(--text-faint)" }}>
                      {t.fans.toLocaleString()} {t.fans === 1 ? "fan" : "fans"} · {Number(t.points_per_fan).toLocaleString()} pts per fan{t.best_streak > 1 ? ` · 🔥 ${t.best_streak}` : ""}
                    </span>
                  </div>
                  <span className="text-base font-bold tabular-nums" style={{ fontFamily: "var(--font-display)" }}>{Number(t.points).toLocaleString()}</span>
                </li>
              ))}
            </ol>
          )}
          <p className="mt-3 text-xs" style={{ color: "var(--text-faint)" }}>
            A team&apos;s score is the combined points of its fans. Small schools can win bragging rights on points per fan.
          </p>
        </>
      ) : (
      <>
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
                <Link href={`/profile/${encodeURIComponent(p.username)}`} className="flex-1 text-sm font-bold hover:underline">
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
      </>
      )}
    </div>
  );
}
