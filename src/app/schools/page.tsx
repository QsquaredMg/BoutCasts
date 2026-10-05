import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LIVE_VOTE_TIERS, ORG_LICENSE, ORGANIZER_PRO, SUPER_VOTES, type LiveVoteTier } from "@/lib/liveVoteEvents/tiers";
import SchoolBallotDemo, { type DemoRealEvent } from "@/components/SchoolBallotDemo";

export const metadata: Metadata = {
  title: "Student voting for schools, colleges & universities",
  description:
    "Run prom court, student council, homecoming, Best of the Best and debate votes in your school colors. One vote per student, a live tally for the big screen. Free to start.",
};

// Re-read the sample school every few minutes so new photos show up without a deploy.
export const revalidate = 300;

const CREATE_HREF = "/live-vote/new";
const MAIL_HREF = `mailto:support@boutcasts.com?subject=${encodeURIComponent("School license question")}`;

const MAROON = "#7a1f3d";
const DEEP = "#3b0d1f";
const GOLD = "#e0a93b";
const CREAM = "#fbf6ea";

async function loadSample(): Promise<DemoRealEvent | null> {
  try {
    const supabase = await createClient();
    const { data: ev } = await supabase
      .from("live_vote_events")
      .select("id, title, brand_name, brand_logo_url")
      .ilike("title", "JC High%(Sample)%")
      .eq("is_private", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!ev) return null;
    const { data: opts } = await supabase
      .from("live_vote_options")
      .select("name, description, image_url, sort_order")
      .eq("event_id", ev.id)
      .order("sort_order");
    return {
      id: ev.id,
      title: ev.title,
      brandName: ev.brand_name ?? "JC High School",
      logoUrl: ev.brand_logo_url ?? null,
      candidates: (opts ?? []).map((o) => ({
        name: o.name,
        note: (o.description ?? "").replace(/^Big issue:\s*/i, "").replace(/^./, (c: string) => c.toUpperCase()),
        imageUrl: o.image_url ?? null,
      })),
    };
  } catch {
    return null;
  }
}

function money(cents: number) {
  return cents === 0 ? "Free" : `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}
function windowLabel(ms: number) {
  const h = ms / 3_600_000;
  return h < 24 ? `${h}-hour window` : h === 24 ? "24-hour window" : `${h / 24}-day window`;
}

const USES = [
  {
    title: "Student council and class elections",
    body: "One student, one vote. Every candidate gets a photo, a platform line and a speech of up to three minutes, so the vote is about ideas and not just popularity.",
    how: "Pick-one or ranked choice",
  },
  {
    title: "Prom court",
    body: "Share a single link or QR code on the morning announcements. Voting stays open for the window you set, then the court is crowned with a tally everyone can see.",
    how: "Private code, live tally",
  },
  {
    title: "Homecoming court",
    body: "Vote class by class or school-wide, keep it to your own students with an access code, and put the count on the gym screen at the pep rally.",
    how: "Access code, big-screen results",
  },
  {
    title: "Best of the Best",
    body: "Best teacher, best lunch, best club, senior superlatives. Run one vote per category with up to 20 choices each and publish the winners in the yearbook.",
    how: "Up to 20 choices per vote",
  },
  {
    title: "Debates and speech contests",
    body: "Two sides, one resolution. Invite judges by email so each gets a private scoring link, and let the audience vote alongside them.",
    how: "Judge panels and audience votes",
    link: { href: "/debates", label: "See debates" },
  },
  {
    title: "Band, talent and spirit week",
    body: "Battle of the bands, talent night, step shows, Greek week, spirit awards. The crowd votes from their phones while the scoreboard shows the standings.",
    how: "Open link or access code",
  },
];

const TOOLS = [
  { t: "Private to your students", b: "Share an access code or QR code and the vote stays out of public listings. Only people with the code can find it." },
  { t: "Looks like your school", b: "Your logo, colors and background on the ballot, and a white-label page with no BoutCasts branding competing for attention." },
  { t: "One person, one vote", b: "Require a BoutCasts account for verified voting, or share an open link that allows one vote per device. You choose per event." },
  { t: "Candidate profiles", b: "Photos, a platform line and a speech or video up to three minutes. Candidates can send their own media through a private link, and you approve it first." },
  { t: "Ranked choice or pick-one", b: "Run a classic single vote or a ranked-choice ballot for officer elections with several candidates." },
  { t: "Judge panels", b: "Invite faculty or community judges by email. Each gets a private link to score entries, and you release the results when scoring is done." },
  { t: "Fundraise while they vote", b: `Add sponsor spots and optional Super Votes. Fans buy vote packs and you keep ${Math.round(SUPER_VOTES.organizerShare * 100)}% of sales, paid out after the vote closes.` },
  { t: "Know your turnout", b: "Turnout over time, optional demographic breakdowns and a CSV export for your records with Pro." },
];

const FAQ = [
  {
    q: "Do students need an account to vote?",
    a: "Your choice. Require a BoutCasts account and each account gets exactly one vote. Or share an open link, where each device gets one vote, which suits assemblies and events.",
  },
  {
    q: "Can we keep the vote to our own students?",
    a: "Yes. Make the event private, and students join with an access code or by scanning a QR code. Private votes don't appear in public listings.",
  },
  {
    q: "How long does setup take?",
    a: "Name the vote, add your candidates, choose your colors, and share the link. Photos and speeches can be added as you go, so you can open the ballot first and polish it after.",
  },
  {
    q: "Can we try it before we pay?",
    a: `Yes. A free event covers up to ${LIVE_VOTE_TIERS.free.voteCap} votes with a pick-one ballot, enough for a club election or a classroom test run. Branding, ranked choice and judges come with paid events.`,
  },
  {
    q: "We need an invoice or purchase order.",
    a: "Email support@boutcasts.com and we'll set it up. The School & League License can be paid by card or invoice.",
  },
  {
    q: "What about trust in the results?",
    a: "The tally is public while the vote runs, every ballot has a Report button, and verified voting stops double votes. Judged events keep scores hidden until you release them.",
  },
];

export default async function SchoolsPage() {
  const real = await loadSample();
  const tiers = Object.keys(LIVE_VOTE_TIERS) as LiveVoteTier[];

  return (
    <div className="lp" style={{ background: "#fff" }}>
      {/* ================= HERO ================= */}
      <section className="relative overflow-hidden" style={{ background: DEEP, color: "#fff" }}>
        {/* a long diagonal in the school's maroon, like a banner hung in the gym */}
        <div aria-hidden className="absolute -right-40 -top-24 hidden h-[1200px] w-[620px] rotate-[14deg] lg:block" style={{ background: MAROON }} />
        <div aria-hidden className="absolute -right-20 -top-24 hidden h-[1200px] w-[18px] rotate-[14deg] lg:block" style={{ background: GOLD }} />

        <div className="relative mx-auto grid max-w-[1280px] grid-cols-[minmax(0,1fr)] items-center gap-12 px-5 pb-16 pt-12 sm:px-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-14 lg:px-12 lg:pb-24 lg:pt-20">
          <div className="flex min-w-0 flex-col gap-6">
            <p className="text-[15px] font-bold sm:text-[16px]" style={{ color: GOLD }}>
              For high schools, colleges and universities
            </p>
            <h1 className="lp-display text-[44px] sm:text-[64px] lg:text-[68px]" style={{ lineHeight: 0.94 }}>
              Every student vote, counted in the open.
            </h1>
            <p className="max-w-[560px] text-[17px] leading-relaxed sm:text-[19px]" style={{ color: "#ecd5de" }}>
              Prom court, student council, homecoming, Best of the Best and debates, all in your school colors. One vote per
              student, and a live tally you can put on the big screen.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href={CREATE_HREF} className="lp-btn px-7 py-4 text-[17px]" style={{ background: GOLD, color: DEEP }}>
                Start a free vote
              </Link>
              <div className="lg:hidden">
                <a href="#ballot" className="lp-btn w-full border-2 px-7 py-4 text-[17px]" style={{ borderColor: "rgba(255,255,255,0.5)", color: "#fff" }}>
                  Try the sample ballot
                </a>
              </div>
              <div className="hidden lg:block">
                <a href="#pricing" className="lp-btn border-2 px-7 py-4 text-[17px]" style={{ borderColor: "rgba(255,255,255,0.5)", color: "#fff" }}>
                  See school pricing
                </a>
              </div>
            </div>
            <p className="text-[14px]" style={{ color: "#d9b9c4" }}>
              Free events need no card. Branding, ranked choice and judges are available on paid events.
            </p>
          </div>

          <div id="ballot" className="relative flex min-w-0 justify-center lg:justify-end">
            <SchoolBallotDemo real={real} />
          </div>
        </div>
      </section>

      {/* ================= WHO IT'S FOR ================= */}
      <section style={{ background: CREAM }}>
        <div className="mx-auto grid max-w-[1280px] gap-6 px-5 py-8 sm:grid-cols-2 sm:px-8 lg:grid-cols-4 lg:gap-10 lg:px-12 lg:py-10">
          <Fact t="Activities directors" b="Run every school vote from one place" />
          <Fact t="Student government advisors" b="Fair, visible elections students trust" />
          <Fact t="Band and arts directors" b="Crowd votes for shows and competitions" />
          <Fact t="Campus life offices" b="Awards, court and organization votes" />
        </div>
      </section>

      {/* ================= USE CASES ================= */}
      <section className="mx-auto max-w-[1280px] px-5 py-16 sm:px-8 lg:px-12 lg:py-28">
        <div className="flex max-w-[760px] flex-col gap-4">
          <h2 className="lp-display text-[38px] sm:text-[52px] lg:text-[62px]" style={{ color: DEEP }}>
            Every vote on your calendar
          </h2>
          <p className="text-[17px] leading-relaxed lg:text-[19px]" style={{ color: "var(--lp-muted)" }}>
            One platform for the votes that fill a school year, from the first officer election to the last senior superlative.
          </p>
        </div>

        <ul className="mt-10 divide-y lg:mt-14" style={{ borderTop: `3px solid ${MAROON}`, borderColor: "var(--lp-line)" }}>
          {USES.map((u) => (
            <li key={u.title} className="grid gap-3 py-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_240px] lg:items-start lg:gap-10 lg:py-9" style={{ borderColor: "var(--lp-line)" }}>
              <h3 className="lp-title text-[24px] leading-tight lg:text-[30px]" style={{ color: DEEP }}>
                {u.title}
              </h3>
              <p className="text-[16px] leading-relaxed lg:text-[17px]" style={{ color: "var(--lp-muted)" }}>
                {u.body}
                {u.link && (
                  <>
                    {" "}
                    <Link href={u.link.href} className="font-bold underline" style={{ color: MAROON }}>
                      {u.link.label}
                    </Link>
                  </>
                )}
              </p>
              <p className="text-[14px] font-bold lg:text-right" style={{ color: MAROON }}>
                {u.how}
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-[16px]" style={{ color: "var(--lp-muted)" }}>
          Colleges and universities use the same tools for student government, Greek week, campus awards and homecoming.
        </p>
      </section>

      {/* ================= JC HIGH WALKTHROUGH ================= */}
      <section style={{ background: MAROON, color: "#fff" }}>
        <div className="mx-auto max-w-[1280px] px-5 py-16 sm:px-8 lg:px-12 lg:py-28">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-16">
            <div className="flex flex-col gap-5">
              <h2 className="lp-display text-[38px] sm:text-[52px] lg:text-[60px]">See it run: JC High class president</h2>
              <p className="max-w-[520px] text-[17px] leading-relaxed" style={{ color: "#f2dbe3" }}>
                Our sample school, JC High, runs a three-way class president race. The candidates and school are fictional. The
                ballot is real, so you can vote on it yourself.
              </p>
              {real && (
                <Link href={`/live-vote/${real.id}`} className="lp-btn self-start px-7 py-4 text-[17px]" style={{ background: "#fff", color: DEEP }}>
                  Vote on the JC High ballot
                </Link>
              )}
            </div>

            <ol className="flex flex-col gap-0">
              <Walk n="1" t="Build the ballot" b="Add each candidate with a photo and a platform line. Attach a speech of up to three minutes, as a video, a recording or a link." />
              <Walk n="2" t="Dress it in school colors" b="Upload the logo, set the colors and background. JC High's ballot is maroon and cream because that is the school's look." />
              <Walk n="3" t="Share one link" b="Post the link, print the QR code, or read out the access code on the announcements. Students vote from their phones." />
              <Walk n="4" t="Announce the winner" b="Watch the tally move live. When the window closes, the result is locked in and ready for the assembly." last />
            </ol>
          </div>

          {real && real.candidates.length > 0 && (
            <div className="mt-12 grid gap-4 sm:grid-cols-3 lg:mt-16">
              {real.candidates.map((c) => (
                <div key={c.name} className="flex items-center gap-4 rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)" }}>
                  {c.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.imageUrl} alt={c.name} width={72} height={72} className="h-[72px] w-[72px] shrink-0 rounded-full object-cover" style={{ border: `3px solid ${GOLD}` }} />
                  ) : (
                    <span aria-hidden className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full text-[22px] font-extrabold" style={{ background: GOLD, color: DEEP }}>
                      {c.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                    </span>
                  )}
                  <div>
                    <div className="text-[18px] font-extrabold leading-tight">{c.name}</div>
                    <div className="mt-1 text-[14px] leading-snug" style={{ color: "#f2dbe3" }}>
                      {c.note}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ================= TOOLS ================= */}
      <section className="mx-auto max-w-[1280px] px-5 py-16 sm:px-8 lg:px-12 lg:py-28">
        <div className="flex max-w-[760px] flex-col gap-4">
          <h2 className="lp-display text-[38px] sm:text-[52px] lg:text-[62px]" style={{ color: DEEP }}>
            Built for the front office
          </h2>
          <p className="text-[17px] leading-relaxed lg:text-[19px]" style={{ color: "var(--lp-muted)" }}>
            Everything an advisor needs to run a vote students believe in.
          </p>
        </div>
        <dl className="mt-10 grid gap-x-12 gap-y-9 sm:grid-cols-2 lg:mt-14 lg:gap-y-12">
          {TOOLS.map((x) => (
            <div key={x.t} className="border-l-4 pl-5" style={{ borderColor: MAROON }}>
              <dt className="text-[20px] font-extrabold lg:text-[22px]" style={{ color: DEEP }}>
                {x.t}
              </dt>
              <dd className="mt-1.5 text-[16px] leading-relaxed lg:text-[17px]" style={{ color: "var(--lp-muted)" }}>
                {x.b}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ================= PRICING ================= */}
      <section id="pricing" style={{ background: CREAM }}>
        <div className="mx-auto max-w-[1280px] px-5 py-16 sm:px-8 lg:px-12 lg:py-28">
          <div className="flex max-w-[760px] flex-col gap-4">
            <h2 className="lp-display text-[38px] sm:text-[52px] lg:text-[62px]" style={{ color: DEEP }}>
              Pay for one vote, or cover the whole year
            </h2>
            <p className="text-[17px] leading-relaxed lg:text-[19px]" style={{ color: "var(--lp-muted)" }}>
              Most schools run a handful of votes a year. The license covers all of them.
            </p>
          </div>

          <div className="mt-10 grid gap-5 lg:mt-14 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-6">
            {/* featured: school license */}
            <div className="flex flex-col gap-5 rounded-3xl p-8 lg:p-10" style={{ background: DEEP, color: "#fff" }}>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[20px] font-extrabold">School &amp; League License</span>
                <span className="rounded-full px-3 py-1 text-[13px] font-extrabold" style={{ background: GOLD, color: DEEP }}>
                  Best for schools
                </span>
              </div>
              <div className="lp-display text-[64px] lg:text-[80px]" style={{ lineHeight: 1 }}>
                {money(ORG_LICENSE.priceCents)}
                <span className="ml-2 text-[20px] normal-case tracking-normal" style={{ fontWeight: 700, color: "#d9b9c4" }}>
                  per year
                </span>
              </div>
              <ul className="flex flex-col gap-2.5 text-[17px]" style={{ color: "#f2dbe3" }}>
                <Check>Unlimited Small and Medium votes all year</Check>
                <Check>{ORG_LICENSE.seats} staff seats for advisors and coaches</Check>
                <Check>Your logo, colors and white-label page on every vote</Check>
                <Check>Pro analytics and CSV export on every vote</Check>
                <Check>Pay by card, or email us for an invoice or purchase order</Check>
              </ul>
              <div className="mt-auto flex flex-col gap-3 pt-3 sm:flex-row">
                <Link href="/org" className="lp-btn px-7 py-4 text-[17px]" style={{ background: GOLD, color: DEEP }}>
                  Get the school license
                </Link>
                <a href={MAIL_HREF} className="lp-btn border-2 px-7 py-4 text-[17px]" style={{ borderColor: "rgba(255,255,255,0.5)", color: "#fff" }}>
                  Ask a question
                </a>
              </div>
            </div>

            <div className="flex flex-col gap-5">
              {/* per event */}
              <div className="rounded-3xl bg-white p-7 lg:p-8" style={{ border: "2px solid var(--lp-line)" }}>
                <h3 className="text-[19px] font-extrabold" style={{ color: DEEP }}>
                  One vote at a time
                </h3>
                <table className="mt-4 w-full text-left text-[15px]">
                  <caption className="sr-only">Live Vote prices by size</caption>
                  <thead>
                    <tr style={{ color: "var(--lp-muted)" }}>
                      <th scope="col" className="pb-2 font-semibold">Size</th>
                      <th scope="col" className="pb-2 font-semibold">Votes</th>
                      <th scope="col" className="pb-2 font-semibold">Window</th>
                      <th scope="col" className="pb-2 text-right font-semibold">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tiers.map((k) => {
                      const t = LIVE_VOTE_TIERS[k];
                      return (
                        <tr key={k} style={{ borderTop: "1px solid var(--lp-line)" }}>
                          <th scope="row" className="py-2.5 font-bold">{t.label}</th>
                          <td className="py-2.5">{t.voteCap.toLocaleString("en-US")}</td>
                          <td className="py-2.5">{windowLabel(t.durationMs).replace(" window", "")}</td>
                          <td className="py-2.5 text-right font-extrabold">{money(t.priceCents)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p className="mt-3 text-[14px]" style={{ color: "var(--lp-muted)" }}>
                  Free events are pick-one only. Paid events add your branding, ranked choice and judges.
                </p>
              </div>

              {/* pro */}
              <div className="rounded-3xl bg-white p-7 lg:p-8" style={{ border: "2px solid var(--lp-line)" }}>
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-[19px] font-extrabold" style={{ color: DEEP }}>
                    Organizer Pro
                  </h3>
                  <span className="text-[19px] font-extrabold">{money(ORGANIZER_PRO.priceCents)}/month</span>
                </div>
                <p className="mt-2 text-[15px] leading-relaxed" style={{ color: "var(--lp-muted)" }}>
                  Includes {ORGANIZER_PRO.includedEventsPerPeriod} Small or Medium events each period, with Pro analytics on every
                  event. A good fit for one busy activities office.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= FAQ ================= */}
      <section className="mx-auto max-w-[900px] px-5 py-16 sm:px-8 lg:py-28">
        <h2 className="lp-display text-[38px] sm:text-[52px]" style={{ color: DEEP }}>
          Questions advisors ask
        </h2>
        <div className="mt-8 divide-y" style={{ borderTop: `3px solid ${MAROON}`, borderColor: "var(--lp-line)" }}>
          {FAQ.map((f) => (
            <details key={f.q} className="group py-5" style={{ borderColor: "var(--lp-line)" }}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[18px] font-extrabold lg:text-[20px]" style={{ color: DEEP }}>
                {f.q}
                <span aria-hidden className="text-[26px] leading-none transition-transform group-open:rotate-45" style={{ color: MAROON }}>
                  +
                </span>
              </summary>
              <p className="mt-3 max-w-[70ch] text-[16px] leading-relaxed lg:text-[17px]" style={{ color: "var(--lp-muted)" }}>
                {f.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* ================= FINAL CTA ================= */}
      <section style={{ background: DEEP, color: "#fff" }}>
        <div className="mx-auto flex max-w-[1280px] flex-col gap-8 px-5 py-16 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:gap-16 lg:px-12 lg:py-24">
          <div className="max-w-[720px]">
            <h2 className="lp-display text-[42px] sm:text-[60px] lg:text-[72px]">Open the polls this week</h2>
            <p className="mt-4 text-[17px] leading-relaxed lg:text-[19px]" style={{ color: "#ecd5de" }}>
              Start a free vote in a few minutes, or tell us what your school needs and we&apos;ll help you set it up.
            </p>
          </div>
          <div className="flex w-full shrink-0 flex-col gap-3 lg:w-[320px]">
            <Link href={CREATE_HREF} className="lp-btn py-5 text-[18px]" style={{ background: GOLD, color: DEEP }}>
              Start a free vote
            </Link>
            <a href={MAIL_HREF} className="lp-btn border-2 py-[18px] text-[18px]" style={{ borderColor: "rgba(255,255,255,0.55)", color: "#fff" }}>
              Email us
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}

function Fact({ t, b }: { t: string; b: string }) {
  return (
    <div>
      <div className="text-[17px] font-extrabold" style={{ color: DEEP }}>
        {t}
      </div>
      <div className="text-[15px]" style={{ color: "var(--lp-muted)" }}>
        {b}
      </div>
    </div>
  );
}

function Walk({ n, t, b, last = false }: { n: string; t: string; b: string; last?: boolean }) {
  return (
    <li className="flex gap-5">
      <div className="flex flex-col items-center">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[18px] font-extrabold" style={{ background: GOLD, color: DEEP }}>
          {n}
        </span>
        {!last && <span aria-hidden className="my-1 w-[2px] flex-1" style={{ background: "rgba(255,255,255,0.3)" }} />}
      </div>
      <div className={last ? "pb-0" : "pb-8"}>
        <h3 className="lp-title text-[22px] leading-tight lg:text-[26px]">{t}</h3>
        <p className="mt-1.5 max-w-[520px] text-[16px] leading-relaxed" style={{ color: "#f2dbe3" }}>
          {b}
        </p>
      </div>
    </li>
  );
}

function Check({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="mt-0.5 shrink-0">
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
      <span>{children}</span>
    </li>
  );
}
