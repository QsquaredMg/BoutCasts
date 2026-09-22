import Link from "next/link";
import type { Bout } from "@/lib/types";

const BOX_W = 208;
const BOX_H = 78;
const COL_GAP = 96;
const COL_W = BOX_W + COL_GAP;
const ROW_H = 116;
const PAD_TOP = 56;

type Positioned = { bout: Bout; x: number; y: number };

export default function BracketTree({ bouts, bracketKey }: { bouts: Bout[]; bracketKey: string }) {
  if (bouts.length === 0) return null;

  const byRound = new Map<number, Bout[]>();
  for (const b of bouts) {
    const list = byRound.get(b.round_number) ?? [];
    list.push(b);
    byRound.set(b.round_number, list);
  }
  const roundNumbers = Array.from(byRound.keys()).sort((a, b) => a - b);
  const lastRound = roundNumbers[roundNumbers.length - 1];
  const firstRoundCount = byRound.get(roundNumbers[0])?.length ?? 1;

  function roundLabel(n: number) {
    if (n === lastRound) return "Final";
    if (n === lastRound - 1) return "Semifinal";
    if (n === lastRound - 2) return "Quarterfinal";
    return `Round ${n}`;
  }

  const posById = new Map<string, Positioned>();
  const containerHeight = firstRoundCount * ROW_H + PAD_TOP;

  roundNumbers.forEach((rn, colIdx) => {
    const list = byRound.get(rn) ?? [];
    const x = colIdx * COL_W;
    if (colIdx === 0) {
      list.forEach((b, i) => {
        const y = PAD_TOP + i * ROW_H + ROW_H / 2 - BOX_H / 2;
        posById.set(b.id, { bout: b, x, y });
      });
    } else {
      list.forEach((b) => {
        const children = bouts.filter((c) => c.next_bout_id === b.id);
        let y: number;
        if (children.length > 0) {
          const ys = children
            .map((c) => posById.get(c.id))
            .filter((p): p is Positioned => !!p)
            .map((p) => p.y);
          y = ys.length ? ys.reduce((a, v) => a + v, 0) / ys.length : PAD_TOP;
        } else {
          y = PAD_TOP + (containerHeight - PAD_TOP) / 2 - BOX_H / 2;
        }
        posById.set(b.id, { bout: b, x, y });
      });
    }
  });

  const svgWidth = roundNumbers.length * COL_W - COL_GAP + BOX_W;
  const connectors: { d: string; live: boolean }[] = bouts
    .filter((b) => b.next_bout_id && posById.has(b.id) && posById.has(b.next_bout_id))
    .map((b) => {
      const from = posById.get(b.id)!;
      const to = posById.get(b.next_bout_id!)!;
      const x1 = from.x + BOX_W;
      const y1 = from.y + BOX_H / 2;
      const x2 = to.x;
      const y2 = to.y + BOX_H / 2;
      const midX = x1 + COL_GAP / 2;
      return {
        d: `M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`,
        live: b.status === "final" && !!b.winner_side,
      };
    });

  const themeByRound = new Map<number, { name: string; rules: string | null }>();
  for (const rn of roundNumbers) {
    const withTheme = (byRound.get(rn) ?? []).find((b) => b.round_theme_name);
    if (withTheme?.round_theme_name) {
      themeByRound.set(rn, { name: withTheme.round_theme_name, rules: withTheme.round_theme_rules });
    }
  }

  return (
    <>
      <div className="overflow-x-auto pb-4">
        <div
          className="relative"
          style={{ width: svgWidth, height: containerHeight, minWidth: svgWidth }}
        >
          {roundNumbers.map((rn, colIdx) => (
            <div
              key={`hdr-${rn}`}
              className="absolute top-0 flex flex-col items-center gap-1"
              style={{ left: colIdx * COL_W, width: BOX_W }}
            >
              <div
                className="text-center text-xs font-bold uppercase tracking-wide"
                style={{ fontFamily: "var(--font-display)", color: "var(--text-faint)" }}
              >
                {roundLabel(rn)}
              </div>
              <Link
                href={`/bracket/${bracketKey}/recap/${rn}`}
                className="text-center text-[10px] font-semibold"
                style={{ color: "var(--red)" }}
              >
                🎬 Recap
              </Link>
            </div>
          ))}

          <svg
            className="pointer-events-none absolute left-0 top-0"
            width={svgWidth}
            height={containerHeight}
            style={{ zIndex: 0 }}
          >
            {connectors.map((c, i) => (
              <path key={i} d={c.d} fill="none" stroke={c.live ? "var(--gold)" : "var(--border)"} strokeWidth={2} />
            ))}
          </svg>

          {Array.from(posById.values()).map(({ bout: b, x, y }) => (
            <Link
              key={b.id}
              href={`/bout/${b.id}`}
              className="absolute block overflow-hidden rounded-xl border text-sm transition hover:brightness-110"
              style={{
                left: x,
                top: y,
                width: BOX_W,
                borderColor:
                  b.status === "live"
                    ? "rgba(217,44,76,0.4)"
                    : b.round_number === lastRound
                    ? "rgba(169,122,18,0.35)"
                    : "var(--border)",
                background: "var(--surface)",
                zIndex: 1,
              }}
            >
              <div
                className="flex items-center justify-between px-3 py-2"
                style={{
                  background: b.winner_side === "a" ? "var(--gold-soft)" : "transparent",
                  color: b.winner_side === "a" ? "var(--gold)" : b.competitor_a_name ? "var(--text)" : "var(--text-faint)",
                  fontWeight: b.winner_side === "a" ? 700 : 500,
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <span className="truncate">
                  {b.seed_a && <span style={{ opacity: 0.6 }}>#{b.seed_a} </span>}
                  {b.competitor_a_name || "TBD"}
                </span>
                {b.winner_side === "a" && <span>🏆</span>}
              </div>
              <div
                className="flex items-center justify-between px-3 py-2"
                style={{
                  background: b.winner_side === "b" ? "var(--gold-soft)" : "transparent",
                  color: b.winner_side === "b" ? "var(--gold)" : b.competitor_b_name ? "var(--text)" : "var(--text-faint)",
                  fontWeight: b.winner_side === "b" ? 700 : 500,
                }}
              >
                <span className="truncate">
                  {b.seed_b && <span style={{ opacity: 0.6 }}>#{b.seed_b} </span>}
                  {b.competitor_b_name || "TBD"}
                </span>
                {b.winner_side === "b" && <span>🏆</span>}
              </div>
              <div
                className="px-3 py-1 text-center text-[10px] font-bold uppercase"
                style={{
                  fontFamily: "var(--font-display)",
                  background: "var(--surface-2)",
                  color: b.status === "live" ? "var(--red)" : "var(--text-faint)",
                }}
              >
                {b.status === "live" && <span className="bc-live-dot mr-1" />}
                {b.status}
              </div>
            </Link>
          ))}
        </div>
      </div>

      {themeByRound.size > 0 && (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {roundNumbers
            .filter((rn) => themeByRound.has(rn))
            .map((rn) => {
              const theme = themeByRound.get(rn)!;
              return (
                <div
                  key={rn}
                  className="rounded-xl border p-4"
                  style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                >
                  <div
                    className="mb-1 text-[10px] font-bold uppercase tracking-wide"
                    style={{ fontFamily: "var(--font-display)", color: "var(--red)" }}
                  >
                    {roundLabel(rn)} theme
                  </div>
                  <div className="mb-1 text-base font-bold" style={{ fontFamily: "var(--font-display)" }}>
                    {theme.name}
                  </div>
                  {theme.rules && (
                    <p className="text-sm" style={{ color: "var(--text-faint)" }}>
                      {theme.rules}
                    </p>
                  )}
                </div>
              );
            })}
        </div>
      )}
    </>
  );
}
