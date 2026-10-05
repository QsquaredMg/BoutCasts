import { crowdView, type CrowdStats } from "@/lib/predictions/crowd";

// What everyone predicted, shown once picks close (hidden before so it can't sway anyone).
export default function CrowdSummary({ stats, home, away }: { stats: CrowdStats; home: string; away: string }) {
  const v = crowdView(stats, home, away);
  if (!v) return null;
  return (
    <section className="bc-card mb-5 p-5" aria-label="Crowd predictions">
      <h2 className="mb-1 text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>What the crowd picked</h2>
      <p className="mb-3 text-sm" style={{ color: "var(--text-dim)" }}>
        {v.leader
          ? <>Out of {v.n} predictions, <strong>{v.leaderPct}%</strong> picked <strong>{v.leader === "home" ? home : away}</strong> to win.</>
          : <>Out of {v.n} predictions, the crowd is split right down the middle.</>}
      </p>
      <div className="mb-1 flex h-4 w-full overflow-hidden rounded-full" role="img" aria-label={`${home} ${v.homePct}%, ${away} ${v.awayPct}%${v.drawPct ? `, draw ${v.drawPct}%` : ""}`} style={{ background: "var(--surface-2)" }}>
        <div style={{ width: `${v.homePct}%`, background: "var(--blue)" }} />
        {v.drawPct > 0 && <div style={{ width: `${v.drawPct}%`, background: "var(--text-faint)" }} />}
        <div style={{ width: `${v.awayPct}%`, background: "var(--red)" }} />
      </div>
      <div className="mb-4 flex justify-between text-xs font-bold">
        <span style={{ color: "var(--blue)" }}>{home} {v.homePct}%</span>
        {v.drawPct > 0 && <span style={{ color: "var(--text-faint)" }}>Draw {v.drawPct}%</span>}
        <span style={{ color: "var(--red)" }}>{away} {v.awayPct}%</span>
      </div>
      <dl className="grid grid-cols-3 gap-2 text-center">
        {([
          ["Avg predicted score", v.avgText],
          ["Crowd spread", v.spreadText],
          ["Most common pick", v.topText ? `${v.topText} (${stats.top_count}×)` : "-"],
        ] as const).map(([k, val]) => (
          <div key={k} className="rounded-lg border p-2" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <dt className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-faint)" }}>{k}</dt>
            <dd className="mt-0.5 text-sm font-black tabular-nums">{val}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-center text-xs font-semibold" style={{ color: "var(--text-faint)" }}>Crowd mood: {v.confidence}</p>
    </section>
  );
}
