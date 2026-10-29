import Link from "next/link";
import SignInCard from "@/components/SignInCard";
import SharedWithMe from "@/components/SharedWithMe";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft", color: "var(--text-dim)" },
  live: { label: "Voting open", color: "var(--live)" },
  closed: { label: "Closed", color: "var(--text-faint)" },
};

// Everything a signed-in organizer runs as a school election, in one place under Schools.
export default async function MySchoolElections() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return (
      <SignInCard
        eyebrow="Schools"
        title="Run your school election"
        body="Sign in to set up and manage school elections: student council, class officers and homecoming, with kiosks, vote by link and certified results."
        next="/school-election"
      />
    );
  }
  const { data } = await createAdminClient()
    .from("school_elections")
    .select("id, title, school_name, status, closes_at, is_practice, created_at")
    .eq("organizer_id", auth.user.id)
    .order("created_at", { ascending: false })
    .limit(200);
  const elections = data ?? [];

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>Schools</p>
          <h1 className="text-3xl font-extrabold">My school elections</h1>
        </div>
        <Link href="/school-election/new" className="bc-btn-solid rounded-full px-5 py-2.5 text-sm font-bold">New school election</Link>
      </div>

      <SharedWithMe kind="school_election" />

      {elections.length === 0 ? (
        <p className="rounded-xl border p-4 text-sm" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          You haven&apos;t set up a school election yet. <Link href="/schools" className="font-semibold underline">See how it works</Link> or <Link href="/school-election/new" className="font-semibold underline">start one now</Link>.
        </p>
      ) : (
        <ul className="grid gap-2">
          {elections.map((e) => {
            const st = STATUS[e.status] ?? STATUS.draft;
            return (
              <li key={e.id} className="flex items-center gap-2 rounded-xl border pr-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                <Link href={`/school-election/${e.id}`} className="flex min-w-0 flex-1 items-center justify-between gap-3 px-4 py-3">
                  <span className="min-w-0">
                    <span className="block truncate font-bold">{e.title}</span>
                    <span className="block truncate text-xs" style={{ color: "var(--text-faint)" }}>
                      {[e.school_name, e.is_practice ? "Practice" : null, new Date(e.created_at).toLocaleDateString()].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-bold" style={{ color: st.color }}>{st.label}</span>
                </Link>
                {e.status !== "closed" && (
                  <Link href={`/school-election/${e.id}/edit`} className="shrink-0 rounded-full border px-4 py-1.5 text-xs font-bold" style={{ borderColor: "var(--border)" }}>✎ Edit</Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-8 text-sm" style={{ color: "var(--text-dim)" }}>
        Looking for an open poll or event vote instead? Those live under <Link href="/live-vote" className="font-semibold underline">My Live Votes</Link>.
      </p>
    </div>
  );
}
