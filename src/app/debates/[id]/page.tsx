import { cardMetadata } from "@/lib/og/cardRoute";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ShareButton from "@/components/ShareButton";
import DebateJoin from "@/components/debates/DebateJoin";
import DebateTopicAdmin from "@/components/debates/DebateTopicAdmin";
import { bracketRoundLabel, scoringLabel, SIDE_LABEL, type DebateMatch, type DebateTopic } from "@/lib/debates";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("debate_topics").select("statement").eq("id", id).maybeSingle();
  return cardMetadata("debate", id, data ? data.statement : "Debate");
}

const STATUS_TEXT: Record<DebateMatch["status"], string> = {
  waiting: "Waiting",
  active: "● Live",
  voting: "Voting",
  final: "Final",
};

export default async function DebateTopicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: t } = await supabase.from("debate_topics").select("*").eq("id", id).maybeSingle();
  if (!t) notFound();
  const topic = t as DebateTopic;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [{ data: matchRows }, { data: entryRows }, adminRow] = await Promise.all([
    supabase.from("debate_matches").select("*").eq("topic_id", id).order("bracket_round").order("bracket_pos").order("created_at", { ascending: false }),
    supabase.from("debate_entries").select("user_id, side, match_id").eq("topic_id", id),
    user ? supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const matches = (matchRows ?? []) as DebateMatch[];
  const entries = entryRows ?? [];
  const isAdmin = Boolean((adminRow.data as { is_admin?: boolean } | null)?.is_admin);

  const userIds = Array.from(
    new Set([...matches.flatMap((m) => [m.for_user_id, m.against_user_id]), topic.champion_user_id].filter(Boolean) as string[])
  );
  const { data: profs } = userIds.length
    ? await supabase.from("profiles").select("id, username").in("id", userIds)
    : { data: [] as { id: string; username: string }[] };
  const nameOf = (uid: string | null) => (uid ? (profs ?? []).find((p) => p.id === uid)?.username ?? "Debater" : "TBD");

  let judges: { id: string; name: string; token: string }[] = [];
  if (isAdmin && topic.scoring_mode !== "crowd") {
    const { data } = await supabase.from("debate_judges").select("id, name, token").eq("topic_id", id).order("created_at");
    judges = data ?? [];
  }

  const myEntry = user ? entries.find((e) => e.user_id === user.id) ?? null : null;
  const waitingFor = entries.filter((e) => !e.match_id && e.side === "for").length;
  const waitingAgainst = entries.filter((e) => !e.match_id && e.side === "against").length;
  const bracketRounds = Math.max(0, ...matches.map((m) => m.bracket_round ?? 0));

  const matchCard = (m: DebateMatch) => (
    <Link
      key={m.id}
      href={`/debates/match/${m.id}`}
      className="block rounded-xl border p-2.5 text-sm hover:border-[var(--red)]"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <p className="mb-1 text-[10px] font-bold uppercase tracking-wide" style={{ color: m.status === "active" ? "var(--live)" : "var(--text-faint)" }}>
        {STATUS_TEXT[m.status]}
        {m.status === "active" && ` · round ${m.current_round}/${topic.rounds}`}
      </p>
      {(["for", "against"] as const).map((s) => {
        const uid = s === "for" ? m.for_user_id : m.against_user_id;
        const won = m.winner_side === s;
        return (
          <p key={s} className="flex items-center justify-between gap-2" style={{ fontWeight: won ? 800 : 500, opacity: m.winner_side && !won ? 0.55 : 1 }}>
            <span className="truncate">
              <span className="text-[10px] font-bold uppercase" style={{ color: "var(--text-faint)" }}>
                {SIDE_LABEL[s]}{" "}
              </span>
              {nameOf(uid)}
            </span>
            {won && <span>🏆</span>}
          </p>
        );
      })}
    </Link>
  );

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <Link href="/debates" className="mb-3 inline-block text-sm font-semibold" style={{ color: "var(--blue)" }}>
        ← All debates
      </Link>
      <p className="text-xs font-extrabold uppercase tracking-[0.12em]" style={{ color: "var(--red)" }}>
        {topic.format === "bracket" ? `${topic.bracket_size}-person bracket` : "Open debate"} · {topic.rounds} round
        {topic.rounds === 1 ? "" : "s"} · {scoringLabel(topic)}
      </p>
      <div className="mb-2 flex items-start justify-between gap-3">
        <h1 className="text-3xl font-bold leading-tight" style={{ fontFamily: "var(--font-display)" }}>
          &ldquo;{topic.statement}&rdquo;
        </h1>
        <ShareButton
          imageUrl={`/api/share-card/debate/${id}`}
          title={topic.statement}
          text={`Debate: ${topic.statement} — join or vote on BoutCasts!`}
        />
      </div>
      {topic.description && (
        <p className="mb-4 whitespace-pre-line text-sm" style={{ color: "var(--text-dim)" }}>
          {topic.description}
        </p>
      )}
      <p className="mb-5 text-xs" style={{ color: "var(--text-faint)" }}>
        Answers up to 3:00 each · {topic.turn_hours}h to respond each turn · you must watch your opponent&apos;s video before replying ·
        two missed turns is a forfeit
      </p>

      {topic.champion_user_id && (
        <div className="mb-5 rounded-2xl p-4 text-white" style={{ background: "#0a0e1a" }}>
          <p className="text-xs font-extrabold uppercase tracking-[0.12em]" style={{ color: "#9fb8ff" }}>
            Champion
          </p>
          <p className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
            🏆 {nameOf(topic.champion_user_id)}
          </p>
        </div>
      )}

      <div className="mb-6">
        <DebateJoin
          topicId={topic.id}
          format={topic.format}
          bracketSize={topic.bracket_size}
          status={topic.status}
          signedIn={!!user}
          myEntry={myEntry ? { side: (myEntry.side as "for" | "against" | null) ?? null, match_id: myEntry.match_id } : null}
          waitingFor={waitingFor}
          waitingAgainst={waitingAgainst}
          entries={entries.length}
        />
      </div>

      {topic.format === "bracket" && bracketRounds > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
            Bracket
          </h2>
          <div className="-mx-5 overflow-x-auto px-5 pb-2">
            <div className="flex gap-3" style={{ minWidth: bracketRounds * 190 }}>
              {Array.from({ length: bracketRounds }, (_, i) => i + 1).map((r) => (
                <div key={r} className="flex w-[180px] shrink-0 flex-col justify-around gap-3">
                  <p className="text-center text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--text-faint)" }}>
                    {bracketRoundLabel(r, bracketRounds)}
                  </p>
                  {matches.filter((m) => m.bracket_round === r).map(matchCard)}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {topic.format === "open" && (
        <section>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
            Matches ({matches.length})
          </h2>
          {matches.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-faint)" }}>
              No matches yet — the first one starts when someone takes each side.
            </p>
          ) : (
            <div className="grid gap-2.5 sm:grid-cols-2">{matches.map(matchCard)}</div>
          )}
        </section>
      )}

      {isAdmin && <DebateTopicAdmin topicId={topic.id} status={topic.status} scoringMode={topic.scoring_mode} judges={judges} title={topic.statement} />}
    </div>
  );
}
