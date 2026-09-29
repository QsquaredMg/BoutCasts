import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { scoringLabel, type DebateTopic } from "@/lib/debates";

export const metadata: Metadata = {
  title: "Debates",
  description: "Video debates on BoutCasts: pick a side, answer in 3 minutes or less, and let the crowd or judges decide.",
};

export default async function DebatesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [{ data: topicRows }, { data: matchRows }, { data: entryRows }, adminRow] = await Promise.all([
    supabase.from("debate_topics").select("*").order("created_at", { ascending: false }).limit(100),
    supabase.from("debate_matches").select("topic_id, status"),
    supabase.from("debate_entries").select("topic_id"),
    user ? supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const topics = (topicRows ?? []) as DebateTopic[];
  const isAdmin = Boolean((adminRow.data as { is_admin?: boolean } | null)?.is_admin);
  const live = (id: string) => (matchRows ?? []).filter((m) => m.topic_id === id && (m.status === "active" || m.status === "voting")).length;
  const signups = (id: string) => (entryRows ?? []).filter((e) => e.topic_id === id).length;

  const groups: [string, DebateTopic[]][] = [
    ["Open for debaters", topics.filter((t) => t.status === "open")],
    ["In progress", topics.filter((t) => t.status === "running")],
    ["Finished", topics.filter((t) => t.status === "closed")],
  ];

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: "var(--red)" }}>
            Debates
          </p>
          <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
            Make your case.
          </h1>
        </div>
        {isAdmin && (
          <Link href="/debates/new" className="bc-btn-solid rounded-full px-4 py-2 text-sm font-bold">
            + New debate topic
          </Link>
        )}
      </div>
      <p className="mb-7 text-sm" style={{ color: "var(--text-dim)" }}>
        Pick a side, answer on video in 3 minutes or less, and watch your opponent before you respond. The crowd or a
        panel of judges picks the winner.
      </p>

      {topics.length === 0 && (
        <p className="rounded-xl border p-5 text-center text-sm" style={{ borderColor: "var(--border)", color: "var(--text-faint)" }}>
          No debates yet — check back soon.
        </p>
      )}

      {groups.map(([label, list]) =>
        list.length === 0 ? null : (
          <section key={label} className="mb-8">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
              {label}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {list.map((t) => (
                <Link
                  key={t.id}
                  href={`/debates/${t.id}`}
                  className="group rounded-xl border p-4 hover:border-[var(--red)]"
                  style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                >
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--red)" }}>
                    {t.format === "bracket" ? `${t.bracket_size}-person bracket` : "Open debate"} · {t.rounds} round{t.rounds === 1 ? "" : "s"}
                  </p>
                  <p className="font-bold leading-snug group-hover:underline" style={{ fontFamily: "var(--font-display)" }}>
                    &ldquo;{t.statement}&rdquo;
                  </p>
                  <p className="mt-2 text-xs" style={{ color: "var(--text-faint)" }}>
                    {scoringLabel(t)} ·{" "}
                    {t.status === "open"
                      ? t.format === "bracket"
                        ? `${signups(t.id)}/${t.bracket_size} signed up`
                        : `${signups(t.id)} debater${signups(t.id) === 1 ? "" : "s"}`
                      : `${live(t.id)} live`}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )
      )}
    </div>
  );
}
