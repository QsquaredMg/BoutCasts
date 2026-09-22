function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

export default function VersusCard({
  categoryName,
  levelText,
  sponsorName,
  aName,
  aPct,
  bName,
  bPct,
  winnerSide,
}: {
  categoryName: string;
  levelText: string;
  sponsorName?: string | null;
  aName: string;
  aPct: number;
  bName: string;
  bPct: number;
  winnerSide: "a" | "b" | null;
}) {
  const panel = (side: "a" | "b", name: string, pct: number) => {
    const isWinner = winnerSide === side;
    const color = side === "a" ? "var(--red)" : "var(--blue)";
    return (
      <div
        className="flex flex-1 flex-col items-center gap-1.5 rounded-xl p-3"
        style={{ background: isWinner ? "var(--gold-soft)" : "var(--surface-2)" }}
      >
        {isWinner && (
          <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--gold)" }}>
            🏆 Winner
          </span>
        )}
        <span
          className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white"
          style={{ background: color }}
        >
          {initials(name)}
        </span>
        <span className="truncate text-center text-xs font-bold">{name}</span>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-bold"
          style={{ background: "var(--surface)", color }}
        >
          {pct}%
        </span>
      </div>
    );
  };

  return (
    <div className="bc-card overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-3">
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
          style={{ background: "var(--surface-2)", color: "var(--text-dim)" }}
        >
          {categoryName}
        </span>
      </div>
      <div className="px-4 pt-1 text-[11px]" style={{ color: "var(--text-faint)" }}>
        {levelText}
      </div>
      <div className="flex items-stretch gap-2 p-4">
        {panel("a", aName, aPct)}
        <span
          className="flex items-center px-1 text-xs font-bold"
          style={{ fontFamily: "var(--font-display)", color: "var(--text-faint)" }}
        >
          VS
        </span>
        {panel("b", bName, bPct)}
      </div>
      {sponsorName && (
        <div
          className="px-4 py-2 text-center text-[11px] font-bold"
          style={{ background: "var(--surface-2)", color: "var(--text-dim)" }}
        >
          🏆 Presented by {sponsorName}
        </div>
      )}
    </div>
  );
}
