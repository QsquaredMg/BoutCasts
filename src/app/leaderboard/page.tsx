import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Badge, UserBadge } from "@/lib/types";

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
  if (user) {
    const [{ data: badgeRows }, { data: myProfile }] = await Promise.all([
      supabase
        .from("user_badges")
        .select("*, badges(*)")
        .eq("user_id", user.id)
        .order("awarded_at", { ascending: false }),
      supabase.from("profiles").select("points").eq("id", user.id).maybeSingle(),
    ]);
    myBadges = (badgeRows ?? []) as UserBadge[];
    myPoints = myProfile?.points ?? 0;
  }

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
                <span className="flex-1 text-sm font-bold">{p.username}</span>
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
