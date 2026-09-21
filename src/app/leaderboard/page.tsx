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
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/" className="mb-4 inline-block text-sm text-neutral-500 hover:underline">
        &larr; Back to bouts
      </Link>
      <h1 className="mb-1 text-2xl font-bold">Leaderboard</h1>
      <p className="mb-6 text-neutral-500">
        Points for voting and getting submissions approved.
      </p>

      {user && (
        <div className="mb-8 rounded-lg border border-neutral-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium text-neutral-600">Your points</span>
            <span className="text-xl font-bold text-red-600">{myPoints ?? 0}</span>
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
                    className="flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800"
                  >
                    <span>{badge.icon}</span>
                    {badge.name}
                  </span>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-neutral-400">
              No badges yet &mdash; vote on a bout to earn your first one.
            </p>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        {(topProfiles ?? []).length === 0 ? (
          <p className="p-4 text-sm text-neutral-500">No points on the board yet.</p>
        ) : (
          <ol>
            {(topProfiles ?? []).map((p, i) => (
              <li
                key={p.id}
                className={`flex items-center justify-between px-4 py-3 text-sm ${
                  i !== (topProfiles ?? []).length - 1 ? "border-b border-neutral-100" : ""
                } ${p.id === user?.id ? "bg-red-50" : ""}`}
              >
                <span className="flex items-center gap-3">
                  <span className="w-6 text-right font-mono text-neutral-400">{i + 1}</span>
                  <span className="font-medium">{p.username}</span>
                </span>
                <span className="font-bold text-neutral-800">{p.points}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
