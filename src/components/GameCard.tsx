import Link from "next/link";
import PredTeam from "@/components/PredTeam";
import LocalTime from "@/components/LocalTime";
import { hasPassed, isLocked, type PredGame } from "@/lib/predictions/types";

export default function GameCard({ game, mine }: { game: PredGame; mine?: { pred_home: number; pred_away: number; pts_total: number | null } | null }) {
  const final = game.status === "final";
  const cancelled = game.status === "cancelled";
  const started = isLocked(game);
  const label = cancelled ? "Cancelled" : final ? "Final" : started ? "In progress" : hasPassed(game.starts_at) ? "Started, picks open" : "Open for picks";
  return (
    <Link href={`/predictions/${game.id}`} className="bc-card block p-4 transition hover:opacity-95">
      <div className="mb-3 flex items-center justify-between text-xs font-bold" style={{ color: "var(--text-faint)" }}>
        <span>
          <LocalTime iso={game.starts_at} />
        </span>
        <span
          className="rounded-full px-2 py-0.5"
          style={{ background: !started && !cancelled ? "var(--blue)" : "var(--surface-2)", color: !started && !cancelled ? "#fff" : "var(--text-dim)" }}
        >
          {label}
        </span>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
        <PredTeam name={game.home_name} logo={game.home_logo} />
        <div className="text-center text-2xl font-black tabular-nums" style={{ fontFamily: "var(--font-display)" }}>
          {final ? `${game.home_score} – ${game.away_score}` : "vs"}
        </div>
        <PredTeam name={game.away_name} logo={game.away_logo} />
      </div>
      {mine && (
        <p className="mt-3 text-center text-xs font-semibold" style={{ color: "var(--text-dim)" }}>
          Your pick: {mine.pred_home} – {mine.pred_away}
          {mine.pts_total != null ? ` · ${mine.pts_total} pts` : ""}
        </p>
      )}
    </Link>
  );
}
