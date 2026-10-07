import Link from "next/link";
import type { ReactNode } from "react";
import { PRESETS, rangeQuery, type Range } from "@/lib/analytics/range";

const SERIES = ["var(--blue)", "var(--gold)"];

const TABS = [
  { href: "/admin/analytics", label: "Overview", id: "overview" },
  { href: "/admin/analytics/ads", label: "Ads", id: "ads" },
  { href: "/admin/analytics/traffic", label: "Traffic", id: "traffic" },
  { href: "/admin/analytics/engagement", label: "Engagement", id: "engagement" },
  { href: "/admin/analytics/growth", label: "Growth & revenue", id: "growth" },
  { href: "/admin/analytics/health", label: "Health", id: "health" },
  { href: "/admin/analytics/links", label: "Report links", id: "links" },
];

export function AnalyticsShell({
  range, active, title, intro, exportKind, children,
}: { range: Range | null; active: string; title: string; intro: string; exportKind?: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="mb-1 text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Site analytics</h2>
      <nav aria-label="Analytics sections" className="mb-4 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={range && t.id !== "links" ? `${t.href}${rangeQuery(range)}` : t.href}
            aria-current={t.id === active ? "page" : undefined}
            className="rounded-full border px-3 py-1.5 text-xs font-bold"
            style={{
              borderColor: "var(--border)",
              background: t.id === active ? "var(--ink)" : "transparent",
              color: t.id === active ? "#fff" : "var(--text-dim)",
            }}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <h3 className="text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>{title}</h3>
      <p className="mb-4 text-sm" style={{ color: "var(--text-faint)" }}>{intro}</p>
      {range && <RangeBar range={range} active={active} exportKind={exportKind} />}
      {children}
    </div>
  );
}

function RangeBar({ range, active, exportKind }: { range: Range; active: string; exportKind?: string }) {
  const base = TABS.find((t) => t.id === active)?.href ?? "/admin/analytics";
  const chip = (on: boolean) => ({
    borderColor: "var(--border)",
    background: on ? "var(--surface-2)" : "transparent",
    color: on ? "var(--text)" : "var(--text-dim)",
  });
  return (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      {PRESETS.map((p) => (
        <Link
          key={p.key}
          href={`${base}${rangeQuery({ ...range, key: p.key }, {})}`}
          className="rounded-full border px-3 py-1.5 text-xs font-bold"
          style={chip(range.key === p.key)}
        >
          {p.label}
        </Link>
      ))}
      <form action={base} className="flex flex-wrap items-center gap-1.5">
        <label className="sr-only" htmlFor="rf">From</label>
        <input id="rf" type="date" name="from" defaultValue={range.fromDay} className="rounded-lg border px-2 py-1 text-xs" style={{ borderColor: "var(--border)", background: "var(--surface)" }} />
        <span className="text-xs" style={{ color: "var(--text-faint)" }}>to</span>
        <label className="sr-only" htmlFor="rt">To</label>
        <input id="rt" type="date" name="to" defaultValue={range.toDay} className="rounded-lg border px-2 py-1 text-xs" style={{ borderColor: "var(--border)", background: "var(--surface)" }} />
        {range.compare && <input type="hidden" name="compare" value="1" />}
        <button type="submit" className="rounded-full border px-3 py-1.5 text-xs font-bold" style={chip(range.key === "custom")}>Apply</button>
      </form>
      <Link
        href={`${base}${rangeQuery({ ...range, compare: !range.compare }, {})}`}
        className="rounded-full border px-3 py-1.5 text-xs font-bold"
        style={chip(range.compare)}
        aria-pressed={range.compare}
      >
        Compare to previous period
      </Link>
      {exportKind && (
        <a
          href={`/admin/analytics/export${rangeQuery(range, { kind: exportKind })}`}
          className="rounded-full border px-3 py-1.5 text-xs font-bold"
          style={{ borderColor: "var(--border)", color: "var(--text-dim)" }}
        >
          Download CSV
        </a>
      )}
    </div>
  );
}

export function StatCard({
  label, value, sub, cur, prev,
}: { label: string; value: string; sub?: string; cur?: number; prev?: number | null }) {
  let delta: string | null = null;
  if (prev !== undefined && prev !== null && cur !== undefined) {
    if (prev === 0) delta = cur === 0 ? "no change" : "new";
    else {
      const d = ((cur - prev) / prev) * 100;
      delta = `${d >= 0 ? "▲" : "▼"} ${Math.abs(d).toFixed(0)}% vs previous`;
    }
  }
  return (
    <div className="rounded-xl p-4" style={{ background: "var(--surface-2)" }}>
      <div className="text-xs font-semibold" style={{ color: "var(--text-dim)" }}>{label}</div>
      <div className="mt-1 text-2xl font-black tabular-nums" style={{ fontFamily: "var(--font-display)" }}>{value}</div>
      {delta && <div className="text-[11px] font-semibold" style={{ color: "var(--text-dim)" }}>{delta}</div>}
      {sub && <div className="text-[11px]" style={{ color: "var(--text-faint)" }}>{sub}</div>}
    </div>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">{children}</div>;
}

export function Panel({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="bc-card mb-4 p-4">
      <h4 className="text-sm font-bold">{title}</h4>
      {note && <p className="mb-2 text-[11px]" style={{ color: "var(--text-faint)" }}>{note}</p>}
      <div className={note ? "" : "mt-2"}>{children}</div>
    </section>
  );
}

export function Empty({ text = "No data in this period yet." }: { text?: string }) {
  return <p className="py-3 text-sm" style={{ color: "var(--text-faint)" }}>{text}</p>;
}

function shortDay(day: string) {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

type ChartSeries = { name: string; values: number[] };

/** Daily trend. One axis only; second series (if any) must share the unit. */
export function TrendChart({
  days, series, kind = "line", label,
}: { days: string[]; series: ChartSeries[]; kind?: "line" | "bar"; label: string }) {
  const W = 640, H = 190, L = 38, R = 8, T = 10, B = 24;
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const nice = (() => {
    const p = Math.pow(10, Math.floor(Math.log10(max)));
    const m = max / p;
    return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
  })();
  const cw = W - L - R, ch = H - T - B;
  const x = (i: number) => L + (days.length <= 1 ? cw / 2 : (i / (days.length - 1)) * cw);
  const y = (v: number) => T + ch - (v / nice) * ch;
  const step = cw / Math.max(days.length, 1);
  const ticks = [0, nice / 2, nice];
  const labelIdx = days.length <= 2 ? days.map((_, i) => i) : [0, Math.floor(days.length / 2), days.length - 1];
  const total = series.map((s) => s.values.reduce((a, b) => a + b, 0));

  return (
    <figure className="m-0">
      {series.length > 1 && (
        <figcaption className="mb-1 flex flex-wrap gap-3 text-[11px] font-semibold" style={{ color: "var(--text-dim)" }}>
          {series.map((s, i) => (
            <span key={s.name} className="inline-flex items-center gap-1.5">
              <span aria-hidden className="inline-block h-0.5 w-4 rounded" style={{ background: SERIES[i] }} />
              {s.name} ({total[i].toLocaleString()})
            </span>
          ))}
        </figcaption>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="w-full" style={{ maxHeight: 230 }}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={1} />
            <text x={L - 6} y={y(t) + 3} textAnchor="end" fontSize={10} fill="var(--text-faint)">{Math.round(t).toLocaleString()}</text>
          </g>
        ))}
        {kind === "bar"
          ? series[0]?.values.map((v, i) => {
              const bw = Math.max(2, Math.min(18, step * 0.6));
              const h = Math.max(v > 0 ? 2 : 0, (v / nice) * ch);
              return <rect key={i} x={x(i) - bw / 2} y={T + ch - h} width={bw} height={h} rx={Math.min(4, bw / 2)} fill={SERIES[0]} />;
            })
          : series.map((s, si) => (
              <g key={s.name}>
                {si === 0 && series.length === 1 && days.length > 1 && (
                  <polygon
                    points={`${x(0)},${T + ch} ${s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")} ${x(s.values.length - 1)},${T + ch}`}
                    fill={SERIES[0]} opacity={0.08}
                  />
                )}
                <polyline points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")} fill="none" stroke={SERIES[si]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                {days.length <= 31 && s.values.map((v, i) => (
                  <circle key={i} cx={x(i)} cy={y(v)} r={2.5} fill={SERIES[si]} stroke="var(--surface)" strokeWidth={2} />
                ))}
              </g>
            ))}
        {labelIdx.map((i) => (
          <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? "start" : i === days.length - 1 ? "end" : "middle"} fontSize={10} fill="var(--text-faint)">
            {shortDay(days[i])}
          </text>
        ))}
        {days.map((d, i) => (
          <rect key={d} x={x(i) - step / 2} y={T} width={step} height={ch} fill="transparent">
            <title>{`${shortDay(d)}: ${series.map((s) => `${s.name} ${s.values[i].toLocaleString()}`).join(" · ")}`}</title>
          </rect>
        ))}
      </svg>
    </figure>
  );
}

export function BarList({
  rows, empty,
}: { rows: { label: string; value: number; hint?: string }[]; empty?: string }) {
  if (rows.length === 0) return <Empty text={empty} />;
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="m-0 list-none space-y-2 p-0">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-semibold" title={r.label}>{r.label}</span>
            <span className="shrink-0 tabular-nums" style={{ color: "var(--text-dim)" }}>
              {r.value.toLocaleString()}{r.hint ? ` · ${r.hint}` : ""}
            </span>
          </div>
          <div className="mt-1 h-2 w-full rounded-full" style={{ background: "var(--surface-2)" }}>
            <div className="h-2 rounded-r-full rounded-l-full" style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, background: "var(--blue)" }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export type Col<T> = { label: string; align?: "right"; render: (row: T) => ReactNode };

export function DataTable<T>({ cols, rows, empty }: { cols: Col<T>[]; rows: T[]; empty?: string }) {
  if (rows.length === 0) return <Empty text={empty} />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead>
          <tr className="text-xs uppercase" style={{ color: "var(--text-faint)" }}>
            {cols.map((c) => (
              <th key={c.label} className={`py-2 pr-3 font-bold ${c.align === "right" ? "text-right" : ""}`}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
              {cols.map((c) => (
                <td key={c.label} className={`py-2.5 pr-3 ${c.align === "right" ? "text-right tabular-nums" : ""}`}>{c.render(r)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Unavailable() {
  return (
    <p className="rounded-xl p-4 text-sm" style={{ background: "var(--surface-2)", color: "var(--text-dim)" }}>
      Analytics couldn&apos;t be loaded. Make sure you are signed in as an admin and try again.
    </p>
  );
}
