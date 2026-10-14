import Link from "next/link";
import type { TourneyRow } from "@/lib/predictions/types";

// Standings for a tournament bracket: points first (wins and losses), then the championship score breaks ties.
export default function TourneyLeaderboard({ rows, meId, champFinal }: { rows: TourneyRow[]; meId?: string | null; champFinal: boolean }) {
  if (rows.length === 0) {
    return (
      <p className="bc-card p-5 text-center text-sm" style={{ color: "var(--text-dim)" }}>
        No entries yet. Standings appear here once players lock in their brackets and results come in.
      </p>
    );
  }
  return (
    <>
      <ol className="bc-card divide-y overflow-hidden" style={{ borderColor: "var(--border)" }}>
        {rows.map((r, i) => (
          <li key={r.user_id} className="flex items-center gap-3 px-4 py-3" style={{ borderColor: "var(--border)", background: r.user_id === meId ? "var(--surface-2)" : undefined }}>
            <span className={`pt-medal${i < 3 ? ` m${i + 1}` : ""}`}>{i + 1}</span>
            <div className="min-w-0 flex-1">
              {r.username ? (
                <Link href={`/profile/${encodeURIComponent(r.username)}`} className="block truncate text-sm font-bold">{r.username}</Link>
              ) : (
                <span className="block truncate text-sm font-bold">Player</span>
              )}
              <span className="text-xs" style={{ color: "var(--text-faint)" }}>
                {r.wins}-{r.losses} record · best case {r.max_points} pts
                {champFinal && r.champ_diff != null ? ` · title score off by ${r.champ_diff}` : ""}
              </span>
            </div>
            <span className="pt-led px-3 py-1.5 text-2xl">{r.points}</span>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-xs" style={{ color: "var(--text-faint)" }}>
        Points decide the standings. Ties are broken by the championship score (closest combined total, then closest margin), then by more correct picks, then by who entered first.
      </p>
    </>
  );
}
