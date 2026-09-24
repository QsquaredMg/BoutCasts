import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LIVE_VOTE_TIERS, type LiveVoteTier } from "@/lib/liveVoteEvents/tiers";

// Marketing homepage. Its one job: explain BoutCasts in a glance (battles AND
// real-world voting — elections, polls, event votes) and funnel every visitor
// through one of two doors:
//   1. "Start a Live Vote"  → /live-vote/new (login first if signed out)
//   2. "Vote now"           → a live bout
// The old featured-bout + bracket view that used to live here is now /boutcard.

export const metadata: Metadata = {
  title: { absolute: "BoutCasts — Live voting for battles, elections, polls & events" },
  description:
    "Run live votes for class elections, polls, halftime shows and talent battles. One vote per voter, a public tally that updates in real time. Pay per event — no subscription.",
};

const CREATE_HREF = "/live-vote/new";
const LOGIN_CREATE_HREF = `/login?next=${encodeURIComponent(CREATE_HREF)}`;

type LiveRow = {
  id: string;
  title: string;
  status: "upcoming" | "live" | "final";
  competitor_a_name: string;
  competitor_b_name: string;
  round_number: number;
  bracket_key: string | null;
  categories: { name: string } | { name: string }[] | null;
};

function categoryName(c: LiveRow["categories"]): string | null {
  if (!c) return null;
  return Array.isArray(c) ? c[0]?.name ?? null : c.name ?? null;
}

// Clip titles often carry the event name ("Jackson State University Marching
// Band - HBCU Labor Day Classic BOTB"); show just the competitor part.
function shortName(name: string): string {
  const cut = name.split(/\s[-–—|]\s/)[0]?.trim();
  return cut && cut.length > 0 ? cut : name;
}

function money(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function windowLabel(ms: number) {
  const hours = ms / 3_600_000;
  if (hours < 24) return `${hours}-hour voting window`;
  const days = hours / 24;
  return days === 1 ? "1-day voting window" : `${days}-day voting window`;
}

const TIER_NOTES: Record<LiveVoteTier, { fit: string; tag?: string }> = {
  small: { fit: "A class election, club vote or talent night" },
  medium: { fit: "Homecoming court, school-wide elections, game-day votes", tag: "Campus-wide" },
  large: { fit: "Fan-choice awards, citywide contests, stadium crowds" },
};

async function loadLiveBouts(): Promise<LiveRow[]> {
  try {
    const supabase = await createClient();
    const select =
      "id, title, status, competitor_a_name, competitor_b_name, round_number, bracket_key, categories(name)";
    const { data: live } = await supabase
      .from("bouts")
      .select(select)
      .eq("status", "live")
      .order("created_at", { ascending: false })
      .limit(3);
    let rows = (live as LiveRow[] | null) ?? [];
    if (rows.length < 3) {
      const { data: upcoming } = await supabase
        .from("bouts")
        .select(select)
        .eq("status", "upcoming")
        .order("created_at", { ascending: false })
        .limit(3 - rows.length);
      rows = rows.concat((upcoming as LiveRow[] | null) ?? []);
    }
    // Hide placeholder slots that don't have both competitors yet.
    return rows.filter(
      (b) => b.competitor_a_name && b.competitor_b_name && b.competitor_a_name !== "TBD" && b.competitor_b_name !== "TBD",
    );
  } catch {
    return [];
  }
}

export default async function Home() {
  const bouts = await loadLiveBouts();
  const sharedCategory =
    bouts.length > 0 && bouts.every((b) => categoryName(b.categories) === categoryName(bouts[0].categories))
      ? categoryName(bouts[0].categories)
      : null;
  const bracketKey = bouts.find((b) => b.bracket_key)?.bracket_key ?? null;

  return (
    <div className="lp">
      {/* ================= HERO ================= */}
      <section className="relative overflow-hidden" style={{ background: "var(--lp-ink)", color: "#fff" }}>
        <div aria-hidden className="lp-slash" />
        <div aria-hidden className="lp-stripe" />
        <div aria-hidden className="lp-watermark hidden lg:block" style={{ left: 40, bottom: -110, fontSize: 420 }}>
          VS
        </div>

        <div className="relative mx-auto grid max-w-[1280px] items-center gap-12 px-5 pb-16 pt-12 sm:px-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-16 lg:px-12 lg:pb-24 lg:pt-24">
          <div className="flex flex-col gap-6 lg:gap-7">
            <div className="lp-eyebrow flex items-center gap-2.5" style={{ color: "#9fb8ff" }}>
              <span className="lp-live-dot" aria-hidden />
              Real-time voting · Head-to-head battles
            </div>
            <h1 className="lp-display text-[58px] sm:text-[84px] lg:text-[104px]" style={{ lineHeight: 0.92 }}>
              Let the
              <br />
              crowd <br className="hidden sm:block" />
              <span style={{ color: "var(--lp-blue-light)" }}>decide.</span>
            </h1>
            <p className="max-w-[580px] text-[17px] leading-relaxed sm:text-[20px]" style={{ color: "var(--lp-body-dark)" }}>
              BoutCasts is live voting for anything that needs a winner — class elections, event polls, halftime votes,
              talent battles and brackets. One vote per voter. Results on screen the second they land.
            </p>
            <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href={CREATE_HREF}
                className="lp-btn px-7 py-4 text-[17px] sm:text-lg"
                style={{ background: "#fff", color: "var(--lp-ink)" }}
              >
                Start a Live Vote <ArrowIcon />
              </Link>
              <Link
                href={bouts[0] ? `/bout/${bouts[0].id}` : "/matchups"}
                className="lp-btn border-2 px-7 py-4 text-[17px] sm:text-lg"
                style={{ borderColor: "rgba(255,255,255,0.55)", color: "#fff" }}
              >
                Vote on today’s bouts
              </Link>
            </div>
            <p className="text-[15px]" style={{ color: "var(--lp-muted-dark)" }}>
              Already on BoutCasts?{" "}
              <Link href="/login" className="font-bold underline" style={{ color: "#fff" }}>
                Log in
              </Link>
            </p>
          </div>

          {/* Sample ballot — illustrates the product; clearly labeled as a sample. */}
          <div className="relative flex justify-center lg:justify-end">
            <div
              className="w-full max-w-[440px] rounded-3xl p-6 sm:p-7"
              style={{ background: "#fff", color: "var(--lp-ink)", boxShadow: "0 40px 80px rgba(0,0,0,0.45)" }}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-[13px] font-extrabold tracking-[0.1em]" style={{ color: "var(--lp-live)" }}>
                  <span className="lp-live-dot" aria-hidden /> LIVE VOTE
                </span>
                <span className="rounded-full px-2.5 py-1 text-[12px] font-semibold" style={{ background: "#f1f3f8", color: "#5a6275" }}>
                  Sample event
                </span>
              </div>
              <div className="mt-4 text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: "#5a6275" }}>
                Class of 2027 Election
              </div>
              <div className="lp-title mt-1 text-[24px] leading-tight sm:text-[28px]">Who should be Class President?</div>
              <div className="mt-5 flex flex-col gap-3">
                <SampleOption label="Candidate A" pct={48} leading />
                <SampleOption label="Candidate B" pct={34} />
                <SampleOption label="Candidate C" pct={18} />
              </div>
              <Link
                href="/live-vote"
                className="lp-btn mt-5 w-full rounded-2xl py-4 text-[17px]"
                style={{ background: "var(--lp-blue)", color: "#fff", borderRadius: 14 }}
              >
                See Live Vote
              </Link>
              <div className="mt-4 flex items-center gap-2 text-[13px]" style={{ color: "#5a6275" }}>
                <LockIcon size={16} /> One vote per account — or per device on an open link
              </div>
            </div>
            <div
              className="absolute -bottom-16 left-0 hidden items-center gap-3 rounded-2xl border px-4 py-3.5 sm:flex lg:left-2"
              style={{ background: "var(--lp-ink)", borderColor: "rgba(255,255,255,0.2)", boxShadow: "0 20px 40px rgba(0,0,0,0.4)" }}
            >
              <PulseIcon />
              <div>
                <div className="text-sm font-bold">Tally updates live</div>
                <div className="text-[13px]" style={{ color: "var(--lp-muted-dark)" }}>
                  Put it on the big screen
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= PROOF STRIP ================= */}
      <section style={{ background: "var(--lp-blue)", color: "#fff" }}>
        <div className="mx-auto grid max-w-[1280px] grid-cols-2 gap-x-6 gap-y-5 px-5 py-7 sm:px-8 lg:grid-cols-4 lg:gap-8 lg:px-12 lg:py-9">
          <ProofItem icon={<ShieldIcon />} text="One verified vote per account" />
          <ProofItem icon={<ListIcon />} text="Up to 20 options per vote" />
          <ProofItem icon={<BarsIcon />} text="Public tally, updated in real time" />
          <ProofItem icon={<CardIcon />} text="Pay per event — no subscription" />
        </div>
      </section>

      {/* ================= USE CASES ================= */}
      <section className="mx-auto max-w-[1280px] px-5 py-16 sm:px-8 lg:px-12 lg:py-28">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between lg:gap-16">
          <div className="flex max-w-[720px] flex-col gap-4">
            <div className="lp-eyebrow" style={{ color: "var(--lp-blue)" }}>
              More than entertainment
            </div>
            <h2 className="lp-display text-[40px] sm:text-[52px] lg:text-[64px]">
              Built for fun.
              <br />
              Trusted for decisions.
            </h2>
          </div>
          <p className="max-w-[400px] text-[17px] leading-relaxed lg:text-[19px]" style={{ color: "var(--lp-muted)" }}>
            The same engine that runs our battles runs your vote — any time a group needs a fair, fast, visible answer.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:mt-14 lg:grid-cols-3 lg:gap-6">
          <UseCase
            dark
            icon={<CapIcon />}
            title="School & class elections"
            body="Student council, class officers, homecoming court. One student, one vote — and a count everyone can see."
            footer="High schools · Colleges · Student government"
          />
          <UseCase
            icon={<ScreenIcon />}
            title="Live event voting"
            body="Halftime shows, talent nights, pageants, step shows. The crowd votes from their phones — the tally goes up on the big screen."
          />
          <UseCase
            icon={<ChatIcon />}
            title="Polls & quick decisions"
            body="Team names, theme nights, menu picks, meeting agendas. Ask the question, share one link, settle it in minutes."
          />
          <UseCase
            icon={<BracketIcon />}
            title="Battles & brackets"
            body="Music, dance, rap, singing, debate, highlights. Head-to-head clips, crowd-judged — winners advance automatically."
            link={{ href: "/matchups", label: "Browse matchups →" }}
          />
          <UseCase
            icon={<PeopleIcon />}
            title="Clubs, churches & orgs"
            body="Awards, board picks, community choices. A transparent count your members can trust — no hand-raising, no paper slips."
          />
          <UseCase
            icon={<TrophyIcon />}
            title="Brands & fan choice"
            body="Sponsor a category, run a fan-choice award, put your name on the bracket everyone’s voting on."
            link={{ href: "/sponsor", label: "For Brands →" }}
          />
        </div>
      </section>

      {/* ================= HOW IT WORKS ================= */}
      <section style={{ background: "var(--lp-paper)" }}>
        <div className="mx-auto max-w-[1280px] px-5 py-16 sm:px-8 lg:px-12 lg:py-28">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col gap-4">
              <div className="lp-eyebrow" style={{ color: "var(--lp-blue)" }}>
                How Live Vote works
              </div>
              <h2 className="lp-display text-[40px] sm:text-[52px] lg:text-[64px]">Live in three steps.</h2>
            </div>
            <Link href={CREATE_HREF} className="lp-btn self-start px-7 py-4 text-[17px] lg:self-auto" style={{ background: "var(--lp-blue)", color: "#fff" }}>
              Create your event <ArrowIcon />
            </Link>
          </div>
          <ol className="mt-10 grid gap-4 lg:mt-14 lg:grid-cols-3 lg:gap-6">
            <Step n="01" title="Create your event" body="Name it, add your options — up to 20 — and pick the size and voting window that fits your crowd." />
            <Step
              n="02"
              title="Share one link"
              body="Text it, post it, email it or flash it on the scoreboard. Require a BoutCasts account for verified voting, or share an open link — no account needed."
            />
            <Step n="03" dark title="Watch it count" body="The public tally moves in real time. When the window closes, the winner is locked in." />
          </ol>
        </div>
      </section>

      {/* ================= HAPPENING NOW ================= */}
      {bouts.length > 0 && (
        <section style={{ background: "var(--lp-ink)", color: "#fff" }}>
          <div className="mx-auto max-w-[1280px] px-5 py-16 sm:px-8 lg:px-12 lg:py-28">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex flex-col gap-4">
                <div className="lp-eyebrow flex items-center gap-2.5" style={{ color: "#ff8391" }}>
                  <span className="lp-live-dot" aria-hidden /> Happening now{sharedCategory ? ` · ${sharedCategory}` : ""}
                </div>
                <h2 className="lp-display text-[38px] sm:text-[52px] lg:text-[64px]">Vote on today’s bouts</h2>
                <p className="text-[17px]" style={{ color: "var(--lp-muted-dark)" }}>
                  Head-to-head, crowd-judged. Watch both sides, then cast your vote.
                </p>
              </div>
              {bracketKey && (
                <Link
                  href={`/bracket/${bracketKey}`}
                  className="lp-btn shrink-0 self-start whitespace-nowrap border-2 px-6 py-3.5 text-[16px] lg:self-auto"
                  style={{ borderColor: "rgba(255,255,255,0.55)", color: "#fff" }}
                >
                  See the full bracket
                </Link>
              )}
            </div>
            <div className={`mt-10 grid gap-4 lg:mt-12 lg:gap-6 ${bouts.length === 1 ? "md:max-w-[440px]" : bouts.length === 2 ? "md:grid-cols-2 lg:max-w-[880px]" : "md:grid-cols-3"}`}>
              {bouts.map((b) => (
                <div
                  key={b.id}
                  className="flex flex-col gap-5 rounded-3xl border p-6 lg:p-7"
                  style={{ background: "var(--lp-ink-2)", borderColor: "var(--lp-ink-line)" }}
                >
                  <div className="flex items-center justify-between text-[12px] font-extrabold tracking-[0.1em]">
                    {b.status === "live" ? (
                      <span className="flex items-center gap-2" style={{ color: "#ff8391" }}>
                        <span className="lp-live-dot" aria-hidden /> LIVE
                      </span>
                    ) : (
                      <span style={{ color: "var(--lp-muted-dark)" }}>UP NEXT</span>
                    )}
                    <span style={{ color: "var(--lp-muted-dark)" }}>
                      {b.bracket_key ? `ROUND ${b.round_number}` : categoryName(b.categories)?.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="lp-title line-clamp-2 text-[22px] leading-tight lg:text-[24px]">{shortName(b.competitor_a_name)}</div>
                    <div className="lp-title text-[14px] tracking-[0.2em]" style={{ color: "var(--lp-blue-light)", fontStretch: "125%" }}>
                      VS
                    </div>
                    <div className="lp-title line-clamp-2 text-[22px] leading-tight lg:text-[24px]">{shortName(b.competitor_b_name)}</div>
                  </div>
                  <Link
                    href={`/bout/${b.id}`}
                    className="lp-btn mt-auto py-3.5 text-[16px]"
                    style={{ background: "var(--lp-blue)", color: "#fff", borderRadius: 12 }}
                  >
                    Watch &amp; vote
                  </Link>
                </div>
              ))}
            </div>
            <div className="mt-8 flex flex-col gap-3 text-[15px] sm:flex-row sm:items-center" style={{ color: "var(--lp-muted-dark)" }}>
              <span className="flex items-center gap-2">
                <LockIcon size={16} /> Sign in to vote — one verified vote per account.
                <Link href="/login" className="font-bold underline" style={{ color: "#fff" }}>
                  Log in or sign up
                </Link>
              </span>
              <span className="hidden flex-1 sm:block" />
              <Link href="/matchups" className="font-bold" style={{ color: "#fff" }}>
                Browse all matchups →
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ================= PRICING ================= */}
      <section id="pricing" className="mx-auto max-w-[1280px] px-5 py-16 sm:px-8 lg:px-12 lg:py-28">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="lp-eyebrow" style={{ color: "var(--lp-blue)" }}>
            Live Vote pricing
          </div>
          <h2 className="lp-display text-[40px] sm:text-[52px] lg:text-[64px]">
            Pay per event.
            <br />
            No subscription.
          </h2>
          <p className="text-[17px] lg:text-[19px]" style={{ color: "var(--lp-muted)" }}>
            Pick the size that fits your crowd.
          </p>
        </div>
        <div className="mt-10 grid gap-4 lg:mt-14 lg:grid-cols-3 lg:gap-6">
          {(Object.keys(LIVE_VOTE_TIERS) as LiveVoteTier[]).map((key) => {
            const t = LIVE_VOTE_TIERS[key];
            const note = TIER_NOTES[key];
            const featured = key === "medium";
            return (
              <div
                key={key}
                className="flex flex-col gap-4 rounded-3xl p-7 lg:p-10"
                style={
                  featured
                    ? { background: "var(--lp-ink)", color: "#fff" }
                    : { border: "2px solid var(--lp-line)" }
                }
              >
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold">{t.label}</span>
                  {note.tag && (
                    <span className="rounded-full px-3 py-1 text-[13px] font-bold" style={{ background: "var(--lp-blue)", color: "#fff" }}>
                      {note.tag}
                    </span>
                  )}
                </div>
                <div className="lp-display text-[56px] lg:text-[64px]" style={{ lineHeight: 1 }}>
                  {money(t.priceCents)}
                </div>
                <div className="text-[17px] leading-relaxed" style={{ color: featured ? "var(--lp-body-dark)" : "var(--lp-muted)" }}>
                  Up to <strong style={{ color: featured ? "#fff" : "var(--lp-ink)" }}>{t.voteCap.toLocaleString("en-US")} votes</strong>
                  <br />
                  {windowLabel(t.durationMs)}
                </div>
                <div
                  className="border-t pt-4 text-[15px]"
                  style={{ borderColor: featured ? "var(--lp-ink-line)" : "var(--lp-line)", color: featured ? "var(--lp-body-dark)" : "var(--lp-muted)" }}
                >
                  Great for: {note.fit}
                </div>
                <Link
                  href={CREATE_HREF}
                  className="lp-btn mt-auto py-3.5 text-[16px]"
                  style={
                    featured
                      ? { background: "var(--lp-blue)", color: "#fff", borderRadius: 12 }
                      : { border: "2px solid var(--lp-blue)", color: "var(--lp-blue)", borderRadius: 12 }
                  }
                >
                  Create a {t.label} event
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      {/* ================= FAIR PLAY ================= */}
      <section style={{ background: "var(--lp-paper)" }}>
        <div className="mx-auto grid max-w-[1280px] gap-8 px-5 py-14 sm:grid-cols-2 sm:px-8 lg:grid-cols-4 lg:gap-10 lg:px-12 lg:py-20">
          <div className="flex flex-col gap-3">
            <div className="lp-eyebrow" style={{ color: "var(--lp-blue)" }}>
              Fair play
            </div>
            <h2 className="lp-display text-[34px] lg:text-[40px]" style={{ lineHeight: 1.02 }}>
              Votes you can trust.
            </h2>
          </div>
          <FairItem title="Verified voting" body="Bouts are locked to one vote per account, every time. No ballot stuffing, no double taps." />
          <FairItem title="Moderated entries" body="Every submitted clip is reviewed before it competes — with a one-time appeal if it’s rejected." />
          <FairItem title="Transparent results" body="A public live tally, plus a Report button on every bout if something looks off." />
        </div>
      </section>

      {/* ================= FINAL CTA ================= */}
      <section className="relative overflow-hidden" style={{ background: "var(--lp-blue)", color: "#fff" }}>
        <div className="relative mx-auto flex max-w-[1280px] flex-col gap-8 px-5 py-16 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:gap-16 lg:px-12 lg:py-28">
          <div className="flex max-w-[760px] flex-col gap-4">
            <h2 className="lp-display text-[48px] sm:text-[64px] lg:text-[80px]">
              Your crowd
              <br />
              is waiting.
            </h2>
            <p className="text-[17px] leading-relaxed lg:text-[20px]" style={{ color: "var(--lp-blue-pale)" }}>
              Run your election, poll or battle on BoutCasts — or jump in and vote on what’s live right now.
            </p>
          </div>
          <div className="flex w-full shrink-0 flex-col gap-3 lg:w-[340px]">
            <Link href={CREATE_HREF} className="lp-btn py-5 text-[18px]" style={{ background: "#fff", color: "var(--lp-ink)" }}>
              Start a Live Vote
            </Link>
            <Link href={LOGIN_CREATE_HREF} className="lp-btn border-2 py-[18px] text-[18px]" style={{ borderColor: "#fff", color: "#fff" }}>
              Log in / Sign up
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ---------- small building blocks ---------- */

function SampleOption({ label, pct, leading = false }: { label: string; pct: number; leading?: boolean }) {
  return (
    <div
      className="relative overflow-hidden rounded-[14px] border-2 px-4 py-3.5"
      style={{ borderColor: leading ? "var(--lp-blue)" : "var(--lp-line)" }}
    >
      <div aria-hidden className="absolute inset-y-0 left-0" style={{ width: `${pct}%`, background: leading ? "var(--lp-blue-pale)" : "#f1f3f8" }} />
      <div className="relative flex justify-between text-[16px] font-bold sm:text-[17px]">
        <span>{label}</span>
        <span style={{ color: leading ? "var(--lp-blue)" : "#5a6275" }}>{pct}%</span>
      </div>
    </div>
  );
}

function ProofItem({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="shrink-0">{icon}</span>
      <span className="text-[15px] font-bold leading-snug lg:text-[17px]">{text}</span>
    </div>
  );
}

function UseCase({
  icon,
  title,
  body,
  footer,
  link,
  dark = false,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  footer?: string;
  link?: { href: string; label: string };
  dark?: boolean;
}) {
  return (
    <div
      className="flex flex-col gap-4 rounded-3xl p-7 lg:min-h-[300px] lg:p-9"
      style={dark ? { background: "var(--lp-ink)", color: "#fff" } : { background: "var(--lp-paper)" }}
    >
      <div
        className="flex h-14 w-14 items-center justify-center rounded-2xl"
        style={dark ? { background: "var(--lp-blue)", color: "#fff" } : { background: "#fff", border: "1px solid var(--lp-line)", color: "var(--lp-blue)" }}
      >
        {icon}
      </div>
      <h3 className="lp-title text-[23px] lg:text-[26px]">{title}</h3>
      <p className="text-[16px] leading-relaxed lg:text-[17px]" style={{ color: dark ? "var(--lp-body-dark)" : "var(--lp-muted)" }}>
        {body}
      </p>
      {footer && (
        <div className="mt-auto text-[14px] font-bold" style={{ color: "#9fb8ff" }}>
          {footer}
        </div>
      )}
      {link && (
        <Link href={link.href} className="mt-auto text-[15px] font-bold" style={{ color: "var(--lp-blue)" }}>
          {link.label}
        </Link>
      )}
    </div>
  );
}

function Step({ n, title, body, dark = false }: { n: string; title: string; body: string; dark?: boolean }) {
  return (
    <li
      className="flex flex-col gap-3 rounded-3xl p-7 lg:p-10"
      style={dark ? { background: "var(--lp-ink)", color: "#fff" } : { background: "#fff" }}
    >
      <div className="lp-display text-[56px] lg:text-[72px]" style={{ lineHeight: 1, fontStretch: "125%", color: dark ? "var(--lp-blue-light)" : "var(--lp-blue)" }}>
        {n}
      </div>
      <h3 className="lp-title text-[24px] lg:text-[28px]">{title}</h3>
      <p className="text-[16px] leading-relaxed lg:text-[17px]" style={{ color: dark ? "var(--lp-body-dark)" : "var(--lp-muted)" }}>
        {body}
      </p>
    </li>
  );
}

function FairItem({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col gap-2.5">
      <h3 className="text-[20px] font-bold" style={{ fontFamily: "var(--font-body)" }}>
        {title}
      </h3>
      <p className="text-[16px] leading-relaxed" style={{ color: "var(--lp-muted)" }}>
        {body}
      </p>
    </div>
  );
}

/* ---------- icons (inline stroke SVG, inherit currentColor) ---------- */

function Svg({ size = 28, children }: { size?: number; children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  );
}
function ArrowIcon() {
  return (
    <Svg size={20}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </Svg>
  );
}
function LockIcon({ size = 18 }: { size?: number }) {
  return (
    <Svg size={size}>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </Svg>
  );
}
function PulseIcon() {
  return (
    <span style={{ color: "var(--lp-blue-light)" }}>
      <Svg size={22}>
        <path d="M3 12h4l3-8 4 16 3-8h4" />
      </Svg>
    </span>
  );
}
function ShieldIcon() {
  return (
    <Svg size={28}>
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
      <path d="M9 12l2 2 4-4" />
    </Svg>
  );
}
function ListIcon() {
  return (
    <Svg size={28}>
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </Svg>
  );
}
function BarsIcon() {
  return (
    <Svg size={28}>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </Svg>
  );
}
function CardIcon() {
  return (
    <Svg size={28}>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18M7 15h3" />
    </Svg>
  );
}
function CapIcon() {
  return (
    <Svg>
      <path d="M3 9l9-5 9 5-9 5-9-5z" />
      <path d="M7 11v5c0 1.5 2.5 3 5 3s5-1.5 5-3v-5" />
    </Svg>
  );
}
function ScreenIcon() {
  return (
    <Svg>
      <rect x="2" y="4" width="20" height="13" rx="2" />
      <path d="M8 21h8M12 17v4" />
      <path d="M10 8l4 2.5-4 2.5z" />
    </Svg>
  );
}
function ChatIcon() {
  return (
    <Svg>
      <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.8 8.8 0 0 1-4-1L3 20l1.2-4.5A8.4 8.4 0 1 1 21 11.5z" />
      <path d="M8 11h.01M12 11h.01M16 11h.01" />
    </Svg>
  );
}
function BracketIcon() {
  return (
    <Svg>
      <path d="M3 5h5v5H3zM3 14h5v5H3z" />
      <path d="M8 7.5h4v9H8M12 12h4" />
      <path d="M16 9.5h5v5h-5z" />
    </Svg>
  );
}
function PeopleIcon() {
  return (
    <Svg>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6" />
      <circle cx="17.5" cy="9" r="2.5" />
      <path d="M16 14.2c3 .2 5.5 2.3 5.5 5.3" />
    </Svg>
  );
}
function TrophyIcon() {
  return (
    <Svg>
      <path d="M8 21h8M12 17v4" />
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4z" />
      <path d="M17 6h3v2a3 3 0 0 1-3 3M7 6H4v2a3 3 0 0 0 3 3" />
    </Svg>
  );
}
