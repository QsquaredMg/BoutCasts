import Link from "next/link";
import type { LeaderRow } from "@/lib/predictions/types";

export default function PredLeaderboardTable({ rows, meId }: { rows: LeaderRow[]; meId?: string | null }) {
  if (rows.length === 0) {
    return (
      <p className="bc-card p-5 text-center text-sm" style={{ color: "var(--text-dim)" }}>
        No graded predictions yet. Points appear here as soon as a final score is entered.
      </p>
    );
  }
  return (
    <ol className="bc-card divide-y overflow-hidden" style={{ borderColor: "var(--border)" }}>
      {rows.map((r, i) => (
        <li key={r.user_id} className="flex items-center gap-3 px-4 py-3" style={{ borderColor: "var(--border)", background: r.user_id === meId ? "var(--surface-2)" : undefined }}>
          <span className="w-7 text-center text-sm font-black" style={{ fontFamily: "var(--font-display)", color: i < 3 ? "var(--red)" : "var(--text-faint)" }}>
            {i + 1}
          </span>
          <div className="min-w-0 flex-1">
            {r.username ? (
              <Link href={`/profile/${encodeURIComponent(r.username)}`} className="block truncate text-sm font-bold">{r.username}</Link>
            ) : (
              <span className="block truncate text-sm font-bold">Player</span>
            )}
            <span className="text-xs" style={{ color: "var(--text-faint)" }}>
              {r.games} {r.games === 1 ? "game" : "games"} · {r.winners} winners · {r.perfect} perfect
            </span>
          </div>
          <span className="text-lg font-black tabular-nums" style={{ fontFamily: "var(--font-display)" }}>{r.points}</span>
        </li>
      ))}
    </ol>
  );
}
