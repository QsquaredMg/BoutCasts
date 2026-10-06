import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolveRange, type RangeParams } from "@/lib/analytics/range";
import { loadCurrentAndPrev, n, pct } from "@/lib/analytics/data";
import { AnalyticsShell, BarList, DataTable, Panel, StatCard, StatGrid, Unavailable } from "@/components/analytics/ui";

export const metadata: Metadata = {
  title: "Engagement analytics",
  description: "Votes, Live Vote events, predictions, shares and the most active bouts on BoutCasts.",
};

type Eng = {
  totals: Record<string, number>;
  top_bouts: { id: string; title: string; competitor_a_name: string; competitor_b_name: string; status: string; votes: number; accounts: number }[];
  live_events: { id: string; title: string; status: string; votes: number }[];
  shares: { target: string; action: string; count: number }[];
  top_teams: { name: string; games: number }[];
};

export default async function EngagementPage({ searchParams }: { searchParams: Promise<RangeParams> }) {
  const r = resolveRange(await searchParams);
  const supabase = await createClient();
  const { cur, prev } = await loadCurrentAndPrev<Eng>(supabase, "engagement", r);
  if (!cur) return <AnalyticsShell range={r} active="engagement" title="Engagement" intro=""><Unavailable /></AnalyticsShell>;
  const t = cur.totals, p = prev?.totals;
  const card = (label: string, k: string, sub?: string) => (
    <StatCard label={label} value={n(t[k])} cur={t[k]} prev={p ? p[k] : undefined} sub={sub} />
  );

  return (
    <AnalyticsShell
      range={r}
      active="engagement"
      title="Engagement"
      intro="What people do once they're here: voting, Live Vote, predictions and sharing."
      exportKind="bouts"
    >
      <h4 className="mb-2 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>Voting</h4>
      <StatGrid>
        {card("Bout votes", "bout_votes", `${pct(t.guest_votes, t.bout_votes)} from guests`)}
        {card("Showcase votes", "showcase_votes")}
        {card("Live Vote votes", "live_votes", `${n(t.live_events_created)} events created`)}
        {card("Comments", "comments")}
      </StatGrid>
      <h4 className="mb-2 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>Predictions and content</h4>
      <StatGrid>
        {card("Prediction games created", "games_created")}
        {card("Predictions entered", "predictions")}
        {card("Brackets created", "brackets_created", `${n(t.brackets_paid)} paid`)}
        {card("Clips submitted", "clips_submitted")}
      </StatGrid>

      <Panel title="Most voted-on bouts" note="Top ten in this period.">
        <DataTable rows={cur.top_bouts} cols={[
          { label: "Bout", render: (b) => (<><Link href={`/bout/${b.id}`} className="font-semibold hover:underline">{b.competitor_a_name} vs {b.competitor_b_name}</Link><div className="text-xs" style={{ color: "var(--text-faint)" }}>{b.title} · {b.status}</div></>) },
          { label: "Votes", align: "right", render: (b) => n(b.votes) },
          { label: "Accounts", align: "right", render: (b) => n(b.accounts) },
        ]} />
      </Panel>
      <Panel title="Busiest Live Vote events">
        <DataTable rows={cur.live_events} cols={[
          { label: "Event", render: (e) => (<><div className="font-semibold">{e.title}</div><div className="text-xs" style={{ color: "var(--text-faint)" }}>{e.status}</div></>) },
          { label: "Votes", align: "right", render: (e) => n(e.votes) },
        ]} />
      </Panel>
      <Panel title="Sharing" note="Shares are taps on Share; graphics are vote or prediction graphics opened or saved.">
        <BarList rows={cur.shares.map((s) => ({ label: `${s.target} · ${s.action.replace(/_/g, " ")}`, value: s.count }))} />
      </Panel>
      <Panel title="Most-used teams in prediction games" note="Shows which sports to add content for next.">
        <BarList rows={cur.top_teams.map((s) => ({ label: s.name, value: s.games }))} />
      </Panel>
    </AnalyticsShell>
  );
}
