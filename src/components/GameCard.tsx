import Link from "next/link";
import PredTeam from "@/components/PredTeam";
import LocalTime from "@/components/LocalTime";
import { hasPassed, isLocked, type PredGame } from "@/lib/predictions/types";

export default function GameCard({ game, mine }: { game: PredGame; mine?: { pred_home: number; pred_away: number; pts_total: number | null } | null }) {
  const final = game.status === "final";
  const cancelled = game.status === "cancelled";
  const started = isLocked(game);
  const open = !started && !cancelled;
  const label = cancelled ? "Cancelled" : final ? "Final" : started ? "In progress" : hasPassed(game.starts_at) ? "Started, picks open" : "Open for picks";
  return (
    <Link href={`/predictions/${game.id}`} className="bc-card block p-4">
      <div className="mb-3 flex items-center justify-between gap-2 text-xs font-bold" style={{ color: "var(--text-faint)" }}>
        <span>
          <LocalTime iso={game.starts_at} />
        </span>
        <span
          className="pt-pill"
          style={{ background: open ? "var(--blue)" : "var(--surface-2)", color: open ? "#fff" : "var(--text-dim)" }}
        >
          {open && <span className="pt-live" aria-hidden />}
          {label}
        </span>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
        <PredTeam name={game.home_name} logo={game.home_logo} />
        {final ? (
          <div className="pt-led flex items-center gap-2 px-4 py-2 text-3xl">
            <span>{game.home_score}</span>
            <span style={{ color: "#3a4274" }}>–</span>
            <span>{game.away_score}</span>
          </div>
        ) : (
          <div className="text-center text-xl font-black" style={{ fontFamily: "var(--font-display)", color: "var(--text-faint)" }}>VS</div>
        )}
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
