"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AfterVote from "@/components/AfterVote";
import ShareButton from "@/components/ShareButton";
import JudgeInviteButton from "@/components/JudgeInviteButton";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import SharedVideoPlayer from "@/components/showcases/SharedVideoPlayer";
import { CRITERIA, formatClock, KIND_LABEL, type Showcase, type ShowcaseChoice } from "@/lib/showcases";
import { timeLeft } from "@/lib/debates";

const GUEST_TOKEN_KEY = "bc_guest_vote_token";
function guestToken(): string {
  try {
    let t = localStorage.getItem(GUEST_TOKEN_KEY);
    if (!t) {
      t = `${crypto.randomUUID()}-${crypto.randomUUID()}`;
      localStorage.setItem(GUEST_TOKEN_KEY, t);
    }
    return t;
  } catch {
    return `${crypto.randomUUID()}-${crypto.randomUUID()}`;
  }
}

type State = {
  total: number;
  my_vote: string | null;
  guest_used_today: boolean;
  resets_at: string;
  counts: Record<string, number> | null;
};

export default function ShowcaseView({
  showcase,
  choices,
  isAdmin,
  judges,
}: {
  showcase: Showcase;
  choices: ShowcaseChoice[];
  isAdmin: boolean;
  judges: { id: string; name: string; token: string }[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const [me, setMe] = useState<string | null | undefined>(undefined);
  const [state, setState] = useState<State | null>(null);
  const [seek, setSeek] = useState<{ t: number; n: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [judgeName, setJudgeName] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const labels = KIND_LABEL[showcase.kind];
  const [now] = useState(() => Date.now());
  const live = showcase.status === "live" && (!showcase.closes_at || new Date(showcase.closes_at).getTime() > now);
  const crowdVoting = live && showcase.scoring_mode !== "judges";

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id ?? null;
    setMe(uid);
    const { data } = await supabase.rpc("get_showcase_state", {
      p_showcase_id: showcase.id,
      p_guest_token: uid ? null : guestToken(),
    });
    setState(data as State);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showcase.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [load]);

  async function vote(choiceId: string) {
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.rpc("cast_showcase_vote", {
      p_showcase_id: showcase.id,
      p_choice_id: choiceId,
      p_guest_token: me ? null : guestToken(),
    });
    setBusy(false);
    if (error) {
      const m = error.message;
      setMsg(/^(guest_limit|already|closed):/.test(m) ? m.split(":").slice(1).join(":").trim() : m);
      return;
    }
    load();
  }

  async function adminClose() {
    if (!confirm("Close voting now and announce the winner?")) return;
    const { error } = await supabase.rpc("admin_close_showcase", { p_showcase_id: showcase.id });
    if (error) return setMsg(error.message);
    router.refresh();
  }
  async function adminDelete() {
    if (!confirm("Delete this showcase and all its votes? This can't be undone.")) return;
    const { error } = await supabase.rpc("admin_delete_showcase", { p_showcase_id: showcase.id });
    if (error) return setMsg(error.message);
    router.push(showcase.kind === "debate" ? "/debates" : "/matchups");
  }
  async function addJudge() {
    if (!judgeName.trim()) return;
    const { error } = await supabase.rpc("admin_add_showcase_judge", { p_showcase_id: showcase.id, p_name: judgeName.trim() });
    if (error) return setMsg(error.message);
    setJudgeName("");
    router.refresh();
  }
  async function removeJudge(id: string) {
    if (!confirm("Remove this judge?")) return;
    await supabase.rpc("admin_remove_showcase_judge", { p_judge_id: id });
    router.refresh();
  }

  const counts = state?.counts ?? null;
  const total = state?.total ?? 0;
  const closed = showcase.status === "closed";
  const winner = choices.find((c) => c.id === showcase.winner_choice_id) ?? null;
  const ordered = closed
    ? [...choices].sort((a, b) => (a.id === showcase.winner_choice_id ? -1 : b.id === showcase.winner_choice_id ? 1 : (b.crowd_votes ?? 0) - (a.crowd_votes ?? 0)))
    : choices;
  const canVote = crowdVoting && !state?.my_vote && !(me === null && state?.guest_used_today);

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <Link href={showcase.kind === "debate" ? "/debates" : "/matchups"} className="mb-3 inline-block text-sm font-semibold" style={{ color: "var(--blue)" }}>
        ← {showcase.kind === "debate" ? "Debates" : "Matchups"}
      </Link>
      <p className="text-xs font-extrabold uppercase tracking-[0.12em]" style={{ color: live ? "var(--live)" : "var(--text-faint)" }}>
        {live ? "● Live" : closed ? "Final" : "Closed"} · {labels.noun} · {choices.length} {labels.choice}s
        {showcase.scoring_mode === "judges" ? " · Judges decide" : showcase.scoring_mode === "both" ? ` · Crowd ${showcase.crowd_weight}% / Judges ${100 - showcase.crowd_weight}%` : ""}
      </p>
      <div className="mb-2 flex items-start justify-between gap-3">
        <h1 className="text-3xl font-bold leading-tight" style={{ fontFamily: "var(--font-display)" }}>
          {showcase.title}
        </h1>
        <ShareButton
          title={showcase.title}
          text={`${showcase.title} — watch and vote for your favorite on BoutCasts!`}
          track={{ type: "showcase", id: showcase.id }}
        />
      </div>
      {showcase.description && (
        <p className="mb-4 whitespace-pre-line text-sm" style={{ color: "var(--text-dim)" }}>
          {showcase.description}
        </p>
      )}

      <div className="mb-3">
        <SharedVideoPlayer sourceUrl={showcase.source_url} label={showcase.title} seek={seek} />
      </div>
      <p className="mb-5 text-xs" style={{ color: "var(--text-faint)" }}>
        {live && showcase.closes_at ? `Voting closes ${timeLeft(showcase.closes_at)} · ` : ""}
        Tap a {labels.choice}&apos;s time to jump to their part.
      </p>

      {closed && winner && (
        <div className="mb-5 flex items-center gap-3 rounded-2xl p-4 text-white" style={{ background: "#0a0e1a" }}>
          {winner.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={winner.image_url} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
          )}
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.12em]" style={{ color: "#9fb8ff" }}>
              Winner
            </p>
            <p className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
              🏆 {winner.name}
            </p>
            {winner.team_name && <p className="text-sm" style={{ color: "#c9d0e0" }}>{winner.team_name}</p>}
          </div>
        </div>
      )}

      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>
          {closed ? "Results" : labels.question}
        </h2>
        <span className="text-xs" style={{ color: "var(--text-faint)" }}>
          {total.toLocaleString()} vote{total === 1 ? "" : "s"}
        </span>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {ordered.map((c) => {
          const n = closed ? c.crowd_votes ?? 0 : counts?.[c.id] ?? null;
          const pct = n != null && total > 0 ? Math.round((n / total) * 100) : null;
          const mine = state?.my_vote === c.id;
          const isWinner = closed && c.id === showcase.winner_choice_id;
          return (
            <div
              key={c.id}
              className="relative overflow-hidden rounded-xl border p-3"
              style={{ borderColor: mine || isWinner ? "var(--red)" : "var(--border)", background: "var(--surface)" }}
            >
              {pct != null && (
                <div aria-hidden className="absolute inset-y-0 left-0 opacity-10" style={{ width: `${pct}%`, background: "var(--red)" }} />
              )}
              <div className="relative flex items-center gap-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg text-xl font-bold" style={{ background: "var(--surface-2)", color: "var(--red)", fontFamily: "var(--font-display)" }}>
                  {c.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.image_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    (c.name.match(/[a-z0-9]/i)?.[0] ?? "★").toUpperCase()
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">
                    {isWinner && "🏆 "}
                    {c.name}
                  </p>
                  {c.team_name && (
                    <p className="truncate text-xs" style={{ color: "var(--text-dim)" }}>
                      {c.team_name}
                    </p>
                  )}
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    {c.start_seconds != null && (
                      <button type="button" onClick={() => setSeek({ t: c.start_seconds!, n: Date.now() })} className="font-bold" style={{ color: "var(--red)" }}>
                        ▶ {formatClock(c.start_seconds)}
                      </button>
                    )}
                    {pct != null && (
                      <span style={{ color: "var(--text-faint)" }}>
                        {n} · {pct}%
                      </span>
                    )}
                    {closed && c.judge_score != null && showcase.scoring_mode !== "crowd" && (
                      <span style={{ color: "var(--text-faint)" }}>Judges {c.judge_score}/40</span>
                    )}
                  </div>
                </div>
                {crowdVoting && (
                  <button
                    type="button"
                    onClick={() => vote(c.id)}
                    disabled={busy || !canVote}
                    className={mine ? "shrink-0 rounded-full px-3 py-2 text-xs font-bold text-white" : "bc-btn-solid shrink-0 rounded-full px-3 py-2 text-xs font-bold disabled:opacity-40"}
                    style={mine ? { background: "var(--red)" } : undefined}
                  >
                    {mine ? "Voted ✓" : "Vote"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {state?.my_vote && me !== undefined && (() => {
        const picked = choices.find((c) => c.id === state.my_vote);
        if (!picked) return null;
        const count = state.counts?.[picked.id];
        const pct = state.counts && state.total > 0 && count !== undefined ? Math.round((count / state.total) * 100) : null;
        return (
          <div className="mt-4">
            <AfterVote
              title={showcase.title}
              pickedName={picked.name}
              pickedPct={pct}
              signedIn={!!me}
              track={{ type: "showcase", id: showcase.id }}
            />
          </div>
        );
      })()}

      {live && showcase.scoring_mode === "judges" && (
        <p className="mt-3 text-sm" style={{ color: "var(--text-dim)" }}>
          A judging panel decides this one. Results post when it closes.
        </p>
      )}
      {crowdVoting && me === null && (
        <p className="mt-3 text-xs" style={{ color: "var(--text-faint)" }}>
          {state?.guest_used_today && !state?.my_vote ? "You've used today's free vote. " : "No account needed — 1 free vote a day. "}
          <Link href={`/signup?next=${encodeURIComponent(`/showcase/${showcase.id}`)}`} className="font-semibold underline" style={{ color: "var(--red)" }}>
            Create a free account
          </Link>{" "}
          to vote everywhere.
        </p>
      )}
      {showcase.hide_tally && live && (
        <p className="mt-2 text-xs" style={{ color: "var(--text-faint)" }}>
          Vote counts are hidden until voting closes.
        </p>
      )}
      {msg && (
        <p className="mt-3 text-sm" style={{ color: "var(--danger)" }}>
          {msg}
        </p>
      )}

      {isAdmin && (
        <div className="mt-8 rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <p className="mb-3 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
            Admin
          </p>
          {showcase.scoring_mode !== "crowd" && (
            <div className="mb-4">
              <p className="mb-2 text-sm font-bold">Judges ({judges.length})</p>
              {judges.map((j) => (
                <div key={j.id} className="mb-1.5 flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border)" }}>
                  <span className="font-semibold">{j.name}</span>
                  <span className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(`${window.location.origin}/showcase/judge/${j.token}`);
                        setCopied(j.id);
                      }}
                      className="text-xs font-bold"
                      style={{ color: "var(--red)" }}
                    >
                      {copied === j.id ? "Copied!" : "Copy link"}
                    </button>
                    <JudgeInviteButton
                      judgeName={j.name}
                      judgeId={j.id}
                      judgeKind="showcase"
                      link={`/showcase/judge/${j.token}`}
                      title={showcase.title}
                      kind="showcase"
                      criteria={[...CRITERIA[showcase.kind]]}
                      deadline={showcase.closes_at}
                    />
                    <button type="button" onClick={() => removeJudge(j.id)} className="text-xs" style={{ color: "var(--text-faint)" }}>
                      Remove
                    </button>
                  </span>
                </div>
              ))}
              <div className="flex gap-2">
                <input value={judgeName} onChange={(e) => setJudgeName(e.target.value)} placeholder="Judge name" className="flex-1 rounded-[10px] border px-3 py-2 text-sm" style={{ borderColor: "var(--border)", background: "var(--surface)" }} />
                <button type="button" onClick={addJudge} className="rounded-full border px-4 py-2 text-sm font-bold" style={{ borderColor: "var(--border)" }}>
                  Add judge
                </button>
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {showcase.status === "live" && (
              <button type="button" onClick={adminClose} className="bc-btn-solid rounded-full px-4 py-2 text-xs font-bold">
                Close voting & announce winner
              </button>
            )}
            <button type="button" onClick={adminDelete} className="rounded-full border px-4 py-2 text-xs font-bold" style={{ borderColor: "var(--border)", color: "var(--text-faint)" }}>
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
