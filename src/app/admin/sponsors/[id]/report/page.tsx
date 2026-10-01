import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PrintButton from "@/components/PrintButton";

export const metadata: Metadata = { title: "Sponsor report" };

type Report = {
  sponsor: { id: string; name: string; logo_url: string | null; website_url: string | null };
  since: string | null;
  totals: {
    bouts: number; votes: number; guest_votes: number; unique_accounts: number;
    shares: number; graphics: number; ad_impressions: number; ad_clicks: number;
  };
  bouts: {
    id: string; title: string; competitor_a_name: string; competitor_b_name: string; status: string;
    via: "bout" | "category"; votes: number; guest_votes: number; shares: number; graphics: number;
  }[];
};

const RANGES = [
  { key: "7", label: "Last 7 days", days: 7 },
  { key: "30", label: "Last 30 days", days: 30 },
  { key: "all", label: "All time", days: null },
] as const;

export default async function SponsorReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ range?: string }>;
}) {
  const { id } = await params;
  const { range = "all" } = await searchParams;
  const r = RANGES.find((x) => x.key === range) ?? RANGES[2];
  // eslint-disable-next-line react-hooks/purity
  const since = r.days ? new Date(Date.now() - r.days * 86_400_000).toISOString() : null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_sponsor_report", { p_sponsor_id: id, p_since: since });
  if (error || !data) notFound();
  const rep = data as Report;
  const t = rep.totals;
  const ctr = t.ad_impressions > 0 ? `${((t.ad_clicks / t.ad_impressions) * 100).toFixed(1)}%` : "—";
  const reach = t.votes + t.shares + t.graphics + t.ad_impressions;

  const stats: [string, string, string][] = [
    ["Votes on sponsored matchups", t.votes.toLocaleString(), `${t.guest_votes.toLocaleString()} from guests`],
    ["Voters with accounts", t.unique_accounts.toLocaleString(), "signed-in people who voted"],
    ["Shares", t.shares.toLocaleString(), "people who shared a sponsored matchup"],
    ["Vote graphics opened", t.graphics.toLocaleString(), "each one shows your logo"],
    ["Ad views", t.ad_impressions.toLocaleString(), `${t.ad_clicks.toLocaleString()} clicks · ${ctr} click rate`],
    ["Sponsored matchups", t.bouts.toLocaleString(), "your logo on the page and share image"],
  ];

  return (
    <div className="sponsor-report">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/admin/sponsors" className="text-sm font-semibold" style={{ color: "var(--red)" }}>
          ← Sponsors
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {RANGES.map((x) => (
            <Link
              key={x.key}
              href={`?range=${x.key}`}
              className="rounded-full border px-3 py-1.5 text-xs font-bold"
              style={{
                borderColor: "var(--border)",
                background: x.key === r.key ? "var(--surface-2)" : "transparent",
                color: x.key === r.key ? "var(--text)" : "var(--text-dim)",
              }}
            >
              {x.label}
            </Link>
          ))}
          <PrintButton />
        </div>
      </div>

      <div className="rounded-2xl border p-6 sm:p-8" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em]" style={{ color: "var(--red)" }}>
              BoutCasts sponsor results · {r.label}
            </p>
            <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
              {rep.sponsor.name}
            </h1>
          </div>
          {rep.sponsor.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={rep.sponsor.logo_url} alt="" className="h-14 w-auto max-w-[180px] object-contain" />
          )}
        </div>

        <p className="mt-4 text-sm" style={{ color: "var(--text-dim)" }}>
          <strong>{reach.toLocaleString()}</strong> brand moments: votes cast on matchups you present, shares, vote graphics
          and ad views.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {stats.map(([label, value, sub]) => (
            <div key={label} className="rounded-xl p-4" style={{ background: "var(--surface-2)" }}>
              <div className="text-xs font-semibold" style={{ color: "var(--text-dim)" }}>
                {label}
              </div>
              <div className="mt-1 text-2xl font-black tabular-nums" style={{ fontFamily: "var(--font-display)" }}>
                {value}
              </div>
              <div className="text-[11px]" style={{ color: "var(--text-faint)" }}>
                {sub}
              </div>
            </div>
          ))}
        </div>

        <h2 className="mb-2 mt-8 text-sm font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
          Matchups you presented
        </h2>
        {rep.bouts.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-faint)" }}>
            No matchups are linked to this sponsor yet. Assign the sponsor to a bout or category in Admin → Sponsors.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr style={{ color: "var(--text-faint)" }} className="text-xs uppercase">
                  <th className="py-2 pr-3 font-bold">Matchup</th>
                  <th className="py-2 pr-3 text-right font-bold">Votes</th>
                  <th className="py-2 pr-3 text-right font-bold">Shares</th>
                  <th className="py-2 text-right font-bold">Graphics</th>
                </tr>
              </thead>
              <tbody>
                {rep.bouts.map((b) => (
                  <tr key={b.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td className="py-2.5 pr-3">
                      <Link href={`/bout/${b.id}`} className="font-semibold hover:underline">
                        {b.competitor_a_name} vs {b.competitor_b_name}
                      </Link>
                      <div className="text-xs" style={{ color: "var(--text-faint)" }}>
                        {b.status === "final" ? "Final" : b.status === "live" ? "Live" : "Upcoming"}
                        {b.via === "category" ? " · via category sponsorship" : ""}
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{b.votes.toLocaleString()}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{b.shares.toLocaleString()}</td>
                    <td className="py-2.5 text-right tabular-nums">{b.graphics.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-8 text-[11px]" style={{ color: "var(--text-faint)" }}>
          Votes and shares are counted from BoutCasts records. Shares count taps on Share; the person may cancel before
          posting. Graphics counts each time the vote graphic is opened or saved.
        </p>
      </div>
    </div>
  );
}
