import type { Metadata } from "next";
import Link from "next/link";

// Trust page for school administrators. Every statement here maps to the repo:
//  - collection: profiles / guest_profiles / election_voters / election_kiosks (docs/sql, src/lib/schoolElection.ts)
//  - visibility: live_vote_events_select RLS + get_live_vote_tally (tally withheld for school elections until close)
//  - one vote: live_votes unique indexes (event_id,user_id) and (event_id,voter_token); kiosk_cast_ballot roster check
//  - Super Votes: src/lib/liveVoteEvents/tiers.ts, get_live_vote_tally (counted vs separate mode)
//  - certification: /api/school-election/[id]/certify and /school-election/[id]/certificate
// No compliance, certification or encryption claims are made on purpose.

export const metadata: Metadata = {
  title: "For school administrators: how BoutCasts keeps votes fair",
  description:
    "What BoutCasts collects, who can see results, and how school votes stay one per student. A plain-English guide for principals, advisors and district staff.",
  alternates: { canonical: "/for-administrators" },
};

const CONTACT = process.env.NEXT_PUBLIC_SCHOOLS_CONTACT_EMAIL?.trim() || "";
const SCHOOL_HREF = "/school-election/new";

const H2 = "mt-14 mb-4 text-2xl font-bold sm:text-3xl";
const P = "text-base leading-relaxed sm:text-[17px]";
const LIST = "list-disc space-y-2 pl-5 text-base leading-relaxed sm:text-[17px]";

const FAQ: { q: string; a: string }[] = [
  {
    q: "Do students need an account?",
    a: "Not for most votes. A student can vote from a link or QR code without signing up. Accounts are optional, and an organizer can choose to require a login for a given vote. On a shared kiosk device, students vote with a code and their name from the roster instead.",
  },
  {
    q: "Can someone vote twice?",
    a: "Each vote is limited to one per signed-in account and one per browser. A determined person could still switch browsers or devices on an open link, so for elections where that matters, use a roster with kiosk mode or require logins. See the one-vote section above for how each option works.",
  },
  {
    q: "Who can see the results?",
    a: "For school elections, the running tally stays hidden from voters until the vote closes. After that, results show on the vote page for anyone who can open it. Private events can only be opened with their code.",
  },
  {
    q: "Can we run a vote on one shared iPad or Chromebook?",
    a: "Yes. Kiosk mode is built for a shared device. A student enters a code from the roster and their name, casts one ballot, and the device moves on to the next student. The kiosk does not show a running tally, and a teacher PIN is needed to leave it.",
  },
  {
    q: "What do you do with student data?",
    a: "We collect only what the sections above list, and we use it to run the vote. Our Privacy Policy has the full details.",
  },
  {
    q: "Where is payout timing?",
    a: "Payout timing is shared during setup.",
  },
];

export default function ForAdministratorsPage() {
  const mailHref = CONTACT
    ? `mailto:${CONTACT}?subject=${encodeURIComponent("Question about BoutCasts for our school")}`
    : "";

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
      {/* 1. Hero */}
      <header>
        <h1 className="text-4xl font-extrabold leading-tight sm:text-5xl" style={{ fontFamily: "var(--font-display)" }}>
          Fair school votes your administrators can trust.
        </h1>
        <p className="mt-5 text-lg leading-relaxed sm:text-xl" style={{ color: "var(--text-dim)" }}>
          Here is exactly what BoutCasts collects, who sees results, and how we keep it one vote per student.
        </p>
        <div className="mt-7 flex flex-col items-stretch gap-4 sm:flex-row sm:items-center">
          <Link href={SCHOOL_HREF} className="bc-btn-solid block px-7 py-4 text-center text-base sm:inline-block sm:w-auto">
            Run a free school election
          </Link>
          {CONTACT ? (
            <a href={mailHref} className="text-center text-base font-semibold underline underline-offset-4 sm:text-left">
              Questions? Talk to the founder
            </a>
          ) : null}
        </div>
        <p className="mt-4 text-sm" style={{ color: "var(--text-faint)" }}>
          Free to start. Written for principals, advisors and district staff, though the same vote tools also run community
          polls and brand events.
        </p>
      </header>

      {/* 2. What we collect */}
      <section aria-labelledby="collect">
        <h2 id="collect" className={H2} style={{ fontFamily: "var(--font-display)" }}>
          What we collect
        </h2>
        <h3 className="mb-2 mt-6 text-lg font-bold">From people who vote</h3>
        <ul className={LIST}>
          <li>Most voters never create an account. A voter on an open link gets a random token stored in their own browser, and that token is what limits them to one vote.</li>
          <li>On a school kiosk, the roster holds each student&apos;s name and the code you give them. The roster records whether a student has voted. It does not link a student to which choice they picked.</li>
          <li>Voters who choose to sign up give a username and birthday, plus gender and ethnicity, and can add more to their profile. Signing up requires being 13 or older.</li>
        </ul>
        <h3 className="mb-2 mt-6 text-lg font-bold">From organizers</h3>
        <ul className={LIST}>
          <li>An organizer signs in with an account. They set up the election, its choices and its roster, and can add their school name, colors and logo.</li>
          <li>Roster entries can include an optional student reference and email if you add them.</li>
          <li>Kiosks are identified by a label you give them and a hashed device token, with a log of ballots cast and failed attempts.</li>
        </ul>
        <p className={`${P} mt-5`} style={{ color: "var(--text-dim)" }}>
          Voting never asks for a payment card, and ballots are not tied to a student&apos;s name.
        </p>
      </section>

      {/* 3. Who can see results */}
      <section aria-labelledby="results">
        <h2 id="results" className={H2} style={{ fontFamily: "var(--font-display)" }}>
          Who can see results
        </h2>
        <ul className={LIST}>
          <li>A vote is visible to the public only once it is live or closed, and only if it is not private.</li>
          <li>For school elections, the running count is withheld from everyone until the vote closes (or its closing time passes). Students cannot watch the lead change while voting is open.</li>
          <li>Private events can only be opened by someone who has the event link or access code.</li>
          <li>In kiosk mode on a shared device, a student sees only that their ballot was recorded, never the tally. A teacher PIN is required to leave kiosk mode.</li>
          <li>Individual ballots are not shown to other voters. A signed-in voter can see only their own vote records.</li>
        </ul>
      </section>

      {/* 4. One vote per person */}
      <section aria-labelledby="onevote">
        <h2 id="onevote" className={H2} style={{ fontFamily: "var(--font-display)" }}>
          How we keep it one vote per person
        </h2>
        <ul className={LIST}>
          <li><strong>Per login:</strong> a signed-in account can cast one vote per event. The database enforces this, not just the page.</li>
          <li><strong>Per device:</strong> on open links, each browser gets a token and the database accepts one vote per token. This limits a browser, not the physical hardware, so a student who clears their data or switches browsers could try again. If that is a concern, use a roster or require logins.</li>
          <li><strong>Roster and kiosk:</strong> a student needs a code from your roster plus a matching name. Once a student has voted, their code cannot vote again. After five failed attempts, a kiosk locks for five minutes.</li>
          <li><strong>Private events:</strong> only people with the event code can open and vote.</li>
        </ul>
        <h3 className="mb-2 mt-8 text-lg font-bold">Super Votes</h3>
        <p className={P}>
          Regular votes stay one per person. Super Votes are an optional extra that supporters can buy to add weight
          behind a choice. When an organizer turns them on, they choose whether Super Votes are added to the tally or shown
          separately beside it, so decide this before the vote starts. Up to 90% of Super Votes fundraising is paid out to
          the school.
        </p>
      </section>

      {/* 5. Verifying results */}
      <section aria-labelledby="verify">
        <h2 id="verify" className={H2} style={{ fontFamily: "var(--font-display)" }}>
          How organizers verify results
        </h2>
        <ul className={LIST}>
          <li>Because the tally is hidden until close, the result an organizer sees at close is the full count.</li>
          <li>The roster shows who has voted on kiosks, so you can compare turnout to the number of students on your list.</li>
          <li>After a vote closes, the organizer can certify it. Certified results get a certified stamp and a printable certificate page.</li>
          <li>Practice elections are separate, so you can test the whole flow before a real vote.</li>
        </ul>
      </section>

      {/* 6. FAQ */}
      <section aria-labelledby="faq">
        <h2 id="faq" className={H2} style={{ fontFamily: "var(--font-display)" }}>
          Common questions
        </h2>
        <div className="divide-y rounded-xl border" style={{ borderColor: "var(--border)" }}>
          {FAQ.map((item) => (
            <details key={item.q} className="group px-4 py-1">
              <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-4 py-3 text-base font-semibold sm:text-[17px] [&::-webkit-details-marker]:hidden">
                <span>{item.q}</span>
                <span aria-hidden="true" className="shrink-0 text-xl transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className={`${P} pb-4`} style={{ color: "var(--text-dim)" }}>
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* 7. Contact */}
      {CONTACT ? (
        <section aria-labelledby="contact" className="mt-14 rounded-2xl border p-6" style={{ borderColor: "var(--border)" }}>
          <h2 id="contact" className="mb-2 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
            Questions for the founder
          </h2>
          <p className={P} style={{ color: "var(--text-dim)" }}>
            Ask about your school&apos;s setup, your data, or how a vote would run.
          </p>
          <a href={mailHref} className="bc-btn-solid mt-5 block px-7 py-4 text-center text-base sm:inline-block">
            Email {CONTACT}
          </a>
        </section>
      ) : null}

      <p className="mt-10 text-sm" style={{ color: "var(--text-faint)" }}>
        See also our{" "}
        <Link href="/privacy" className="underline underline-offset-4">
          Privacy Policy
        </Link>{" "}
        and{" "}
        <Link href="/schools" className="underline underline-offset-4">
          school election overview
        </Link>
        .
      </p>
    </div>
  );
}
