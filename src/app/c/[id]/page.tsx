import { cardMetadata } from "@/lib/og/cardRoute";
import { isPublicBout } from "@/lib/publicBouts";
import type { Metadata } from "next";
import ShowcaseCards from "@/components/showcases/ShowcaseCards";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { roomThemeVars } from "@/lib/liveVoteEvents/roomTheme";
import ShareButton from "@/components/ShareButton";

// Public competition hub — "The [Sponsor] [Competition]" when a sponsor has
// bought the placement. Shows live bouts, brackets, recent winners and an
// entry call-to-action.

type Hub = {
  id: string;
  name: string;
  description: string | null;
  hub_banner_url: string | null;
  hub_color: string | null;
  owner_id: string | null;
  sponsors: { name: string; logo_url: string | null; website_url: string | null } | null;
};
type HubBout = {
  id: string;
  status: string;
  bracket_key: string | null;
  round_number: number | null;
  competitor_a_name: string;
  competitor_b_name: string;
  winner_side: string | null;
  closes_at: string | null;
  sponsor_prize_description: string | null;
  bout_mode: "open" | "closed";
  competitor_a_submission_id: string | null;
  competitor_b_submission_id: string | null;
};

async function loadHub(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("categories")
    .select("id, name, description, hub_banner_url, hub_color, owner_id, sponsors(name, logo_url, website_url)")
    .eq("id", id)
    .maybeSingle();
  return data as unknown as Hub | null;
}

function hubTitle(h: Hub) {
  if (!h.sponsors?.name) return h.name;
  return h.name.toLowerCase().includes(h.sponsors.name.toLowerCase()) ? h.name : `The ${h.sponsors.name} ${h.name}`;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const hub = await loadHub(id);
  if (!hub) return { title: "Competition" };
  return cardMetadata("competition", id, hubTitle(hub));
}

export default async function HubPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const hub = await loadHub(id);
  if (!hub) notFound();

  const supabase = await createClient();
  const { data: boutRows } = await supabase
    .from("bouts")
    .select("id, status, bracket_key, round_number, competitor_a_name, competitor_b_name, winner_side, closes_at, sponsor_prize_description, bout_mode, competitor_a_submission_id, competitor_b_submission_id")
    .eq("category_id", id)
    .order("created_at", { ascending: false })
    .limit(100);
  const bouts = (boutRows ?? []) as HubBout[];
  const live = bouts.filter((b) => b.status === "live" && isPublicBout(b));
  const brackets = Array.from(new Set(bouts.map((b) => b.bracket_key).filter(Boolean))) as string[];
  const winners = bouts.filter((b) => b.status === "final" && b.winner_side && isPublicBout(b)).slice(0, 6);
  const prize = bouts.find((b) => b.sponsor_prize_description)?.sponsor_prize_description;
  const title = hubTitle(hub);
  const theme = roomThemeVars(hub.hub_color, null) as React.CSSProperties;
  const box = { borderColor: "var(--border)", background: "var(--surface)" };

  return (
    <div style={theme}>
      <div
        className="relative overflow-hidden"
        style={{ background: hub.hub_color ?? "#0A0E1A", color: "#fff" }}
      >
        {hub.hub_banner_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={hub.hub_banner_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />
        )}
        <div className="relative mx-auto max-w-2xl px-5 py-12">
          {hub.sponsors && (
            <div className="mb-4 flex items-center gap-2.5">
              {hub.sponsors.logo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={hub.sponsors.logo_url} alt={hub.sponsors.name} className="h-10 w-10 rounded-lg bg-white object-contain p-1" />
              )}
              <span className="text-xs font-bold uppercase tracking-[0.14em]">Presented by {hub.sponsors.name}</span>
            </div>
          )}
          <h1 className="text-3xl font-bold leading-tight sm:text-4xl" style={{ fontFamily: "var(--font-display)" }}>
            {title}
          </h1>
          {hub.description && <p className="mt-2 max-w-xl text-sm opacity-90">{hub.description}</p>}
          {prize && (
            <p className="mt-3 inline-block rounded-full bg-white/15 px-3 py-1 text-xs font-bold">🏆 Prize: {prize}</p>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href={`/submit?category=${hub.id}`} className="rounded-full bg-white px-5 py-2.5 text-sm font-bold" style={{ color: "#0A0E1A" }}>
              Enter the competition
            </Link>
            <span
              style={{ "--text-dim": "#ffffff", "--text": "#ffffff", "--border": "rgba(255,255,255,0.6)" } as React.CSSProperties}
            >
              <ShareButton imageUrl={`/api/share-card/competition/${id}`} title={title} text={`${title} — watch the matchups and vote on BoutCasts`} />
            </span>
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-2xl flex-col gap-6 px-5 py-8">
        <ShowcaseCards categoryId={hub.id} heading="Showcases & panel debates" />
        <section>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
            Live now ({live.length})
          </h2>
          {live.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-faint)" }}>
              No matchups are live right now — check back soon, or enter to compete.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {live.map((b) => (
                <Link key={b.id} href={`/bout/${b.id}`} className="rounded-xl border p-3 hover:border-[var(--red)]" style={box}>
                  <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--live)" }}>
                    ● Live{b.round_number ? ` · Round ${b.round_number}` : ""}
                  </p>
                  <p className="font-semibold">
                    {b.competitor_a_name} <span style={{ color: "var(--text-faint)" }}>vs</span> {b.competitor_b_name}
                  </p>
                  {b.closes_at && (
                    <p className="text-xs" style={{ color: "var(--text-faint)" }}>
                      Voting closes {new Date(b.closes_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          )}
        </section>

        {brackets.length > 0 && (
          <section>
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
              Brackets
            </h2>
            <div className="flex flex-wrap gap-2">
              {brackets.map((k) => (
                <Link key={k} href={`/bracket/${k}`} className="rounded-full border px-4 py-2 text-sm font-semibold" style={box}>
                  {k} →
                </Link>
              ))}
            </div>
          </section>
        )}

        {winners.length > 0 && (
          <section>
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
              Recent winners
            </h2>
            <ul className="flex flex-col gap-1.5">
              {winners.map((b) => (
                <li key={b.id} className="flex justify-between gap-2 text-sm">
                  <Link href={`/bout/${b.id}`} className="hover:underline">
                    🏆 <b>{b.winner_side === "a" ? b.competitor_a_name : b.competitor_b_name}</b>{" "}
                    <span style={{ color: "var(--text-faint)" }}>
                      beat {b.winner_side === "a" ? b.competitor_b_name : b.competitor_a_name}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {hub.sponsors?.website_url && (
          <a
            href={hub.sponsors.website_url}
            target="_blank"
            rel="sponsored noopener noreferrer"
            className="flex items-center gap-3 rounded-xl border p-4"
            style={box}
          >
            {hub.sponsors.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={hub.sponsors.logo_url} alt="" className="h-12 w-12 rounded-lg object-contain" />
            )}
            <span className="text-sm">
              <span className="block text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-faint)" }}>
                Presenting sponsor
              </span>
              <span className="font-semibold">{hub.sponsors.name}</span> — visit their site ↗
            </span>
          </a>
        )}
      </div>
    </div>
  );
}
