import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Create",
  description: "Host a live vote, enter a head-to-head matchup, or join a debate on BoutCasts.",
};

type Option = { href: string; icon: string; title: string; body: string; tag?: string };

// One "Create" button, one place to pick a format.
const FOR_EVERYONE: Option[] = [
  {
    href: "/live-vote/new",
    icon: "🗳️",
    title: "Host a Live Vote",
    body: "Class elections, homecoming court, halftime crowd votes, talent nights. One link, one vote each, live results.",
    tag: "Free to start",
  },
  {
    href: "/submit",
    icon: "🥊",
    title: "Enter a head-to-head",
    body: "Submit your clip — band, dance, rap, singing and more. We match you with an opponent and the crowd decides.",
  },
  {
    href: "/debates",
    icon: "🎙️",
    title: "Join a debate",
    body: "Pick a side on an open topic, record your argument, and go head to head in rounds.",
  },
];

const FOR_ADMINS: Option[] = [
  { href: "/showcase/new", icon: "🎬", title: "Showcase", body: "One video with up to 16 groups. Voters pick a favorite." },
  { href: "/showcase/new?kind=debate", icon: "👥", title: "Panel debate", body: "One debate video, several debaters. Vote for the best." },
  { href: "/debates/new", icon: "⚖️", title: "1-on-1 debate topic", body: "Open a topic with a sign-up queue or a bracket." },
  { href: "/admin/bouts", icon: "🏆", title: "Bout or bracket", body: "Pair clips by hand or build a bracket." },
];

export default async function CreatePage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  let isAdmin = false;
  let myEvents = 0;
  if (user) {
    const [{ data: profile }, { count }] = await Promise.all([
      supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle(),
      supabase.from("live_vote_events").select("id", { count: "exact", head: true }).eq("organizer_id", user.id),
    ]);
    isAdmin = !!profile?.is_admin;
    myEvents = count ?? 0;
  }

  return (
    <div className="mx-auto max-w-[900px] px-5 py-8">
      <h1 className="mb-1 text-3xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
        Create
      </h1>
      <p className="mb-6 text-sm" style={{ color: "var(--text-dim)" }}>
        What do you want to put to a vote?
      </p>

      {myEvents > 0 && (
        <Link
          href="/live-vote"
          className="bc-card mb-5 flex items-center justify-between gap-3 p-4 transition-colors hover:bg-[var(--surface-2)]"
        >
          <span className="font-bold">Your Live Votes ({myEvents})</span>
          <span className="text-sm font-bold" style={{ color: "var(--red)" }}>
            Manage →
          </span>
        </Link>
      )}

      <div className="flex flex-col gap-3">
        {FOR_EVERYONE.map((o) => (
          <OptionCard key={o.href} o={o} />
        ))}
      </div>

      {isAdmin && (
        <>
          <h2 className="mb-3 mt-10 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
            Admin formats
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {FOR_ADMINS.map((o) => (
              <OptionCard key={o.href} o={o} compact />
            ))}
          </div>
        </>
      )}

      {!user && (
        <p className="mt-8 text-sm" style={{ color: "var(--text-faint)" }}>
          You&apos;ll be asked to log in or create a free account before you publish.
        </p>
      )}
    </div>
  );
}

function OptionCard({ o, compact = false }: { o: Option; compact?: boolean }) {
  return (
    <Link
      href={o.href}
      className={`bc-card flex items-start gap-4 transition-colors hover:bg-[var(--surface-2)] ${compact ? "p-4" : "p-5"}`}
    >
      <span className={compact ? "text-2xl" : "text-3xl"} aria-hidden>
        {o.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className={`font-bold ${compact ? "" : "text-lg"}`} style={{ fontFamily: "var(--font-display)" }}>
            {o.title}
          </span>
          {o.tag && (
            <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: "var(--red-soft)", color: "var(--red)" }}>
              {o.tag}
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-sm" style={{ color: "var(--text-dim)" }}>
          {o.body}
        </span>
      </span>
      <span className="self-center text-lg font-bold" style={{ color: "var(--red)" }} aria-hidden>
        →
      </span>
    </Link>
  );
}
