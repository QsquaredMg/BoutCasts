"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import TeamPicker from "@/components/TeamPicker";
import LogoUploadField from "@/components/LogoUploadField";
import ZonedDateTimeInput from "@/components/ZonedDateTimeInput";
import { TOURNEY_TIERS, money, roundLabel, roundPoints } from "@/lib/predictions/pricing";
import { getZone } from "@/lib/time/pref";
import { wallToIso } from "@/lib/time/zones";

const SIZES = [4, 8, 16, 32, 64] as const;
const rounds = (n: number) => Math.round(Math.log2(n));
const VOTE_HOURS = [6, 12, 24, 48, 72] as const;

type Mode = "score" | "votes";

// Organizer setup for a bracket. The "Advance by" choice decides what moves winners forward:
//   score: the organizer enters each game's final score (March Madness, playoffs). The organizer pays when they publish.
//   votes: the crowd votes on every matchup (talent shows, mascots, food). Free.
// Players always fill out and vote free.
export default function TourneyBuilder({ initialMode = "score" }: { initialMode?: Mode }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [voteHours, setVoteHours] = useState<number>(24);
  const [title, setTitle] = useState("");
  const [size, setSize] = useState<(typeof SIZES)[number]>(8);
  const [slots, setSlots] = useState<{ name: string; logo: string }[]>(() => Array.from({ length: 8 }, () => ({ name: "", logo: "" })));
  const [paste, setPaste] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [starts, setStarts] = useState<string[]>(["", "", ""]);
  const [cap, setCap] = useState<number>(TOURNEY_TIERS[1].cap);
  const [isPrivate, setIsPrivate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const teams = useMemo(() => slots.map((t) => t.name.trim()).filter(Boolean), [slots]);
  const dupes = useMemo(() => {
    const seen = new Set<string>();
    const d = new Set<string>();
    for (const t of teams) {
      const k = t.toLowerCase();
      if (seen.has(k)) d.add(t);
      seen.add(k);
    }
    return [...d];
  }, [teams]);
  const k = rounds(size);
  const votes = mode === "votes";
  const tier = TOURNEY_TIERS.find((t) => t.cap === cap) ?? TOURNEY_TIERS[1];

  function changeSize(n: (typeof SIZES)[number]) {
    setSize(n);
    setSlots((a) => Array.from({ length: n }, (_, i) => a[i] ?? { name: "", logo: "" }));
    setStarts((s) => Array.from({ length: rounds(n) }, (_, i) => s[i] ?? ""));
  }

  function setSlot(i: number, v: Partial<{ name: string; logo: string }>) {
    setSlots((a) => a.map((x, j) => (j === i ? { ...x, ...v } : x)));
  }

  function applyPaste() {
    const names = paste.split("\n").map((t) => t.trim()).filter(Boolean).slice(0, size);
    setSlots((a) => a.map((x, i) => (names[i] !== undefined ? { name: names[i], logo: "" } : x)));
    setPaste("");
    setShowPaste(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (teams.length !== size) {
      setError(`You listed ${teams.length} ${teams.length === 1 ? "team" : "teams"}. A ${size}-team bracket needs exactly ${size}, one per line.`);
      return;
    }
    if (dupes.length) {
      setError(`Every team needs a different name. Repeated: ${dupes.slice(0, 3).join(", ")}.`);
      return;
    }
    if (teams.some((t) => t.length > 40)) {
      setError("Team names can be up to 40 characters.");
      return;
    }
    const startIso = starts.map((s) => (s ? wallToIso(s, getZone()) : null));
    if (votes) {
      for (let i = 1; i < startIso.length; i++) {
        const prev = startIso[i - 1], cur = startIso[i];
        if (prev && cur && new Date(cur).getTime() < new Date(prev).getTime() + voteHours * 3600 * 1000) {
          setError(`${roundLabel(i + 1, k)} has to start at least ${voteHours} hours after ${roundLabel(i, k)}, so voting on the earlier round can finish first.`);
          return;
        }
      }
    }
    setBusy(true);
    try {
      const { data, error: rpcErr } = await createClient().rpc("create_pred_bracket", {
        p_title: title,
        p_teams: slots.map((t) => ({ name: t.name.trim(), logo: t.logo || null })),
        p_round_starts: startIso,
        p_cap: votes ? 1000 : cap,
        p_private: isPrivate,
        p_mode: mode,
        p_vote_hours: voteHours,
      });
      if (rpcErr) {
        setError(rpcErr.message);
        return;
      }
      const res = data as { ok: boolean; id?: string };
      if (!res?.id) {
        setError("We couldn't save the bracket. Please try again.");
        return;
      }
      router.push(`/predictions/slate/${res.id}`);
    } finally {
      setBusy(false);
    }
  }

  const field = "mt-1 h-11 w-full rounded-xl border bg-transparent px-3 text-sm";
  const border = { borderColor: "var(--border)" };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <fieldset className="bc-card p-4">
        <legend className="px-1 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>How does it advance?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {([
            { id: "score" as const, icon: "🏆", title: "Final score", body: "You enter each game's final score and the winner moves on. Best for real games and tournaments." },
            { id: "votes" as const, icon: "🗳️", title: "Crowd votes", body: "Fans vote on every matchup and the contestant with more votes moves on. Best for talent, mascots, food, anything." },
          ]).map((o) => {
            const active = mode === o.id;
            return (
              <button key={o.id} type="button" onClick={() => setMode(o.id)} aria-pressed={active} className="rounded-xl border p-3 text-left" style={{ borderColor: active ? "var(--blue)" : "var(--border)", background: active ? "var(--surface-2)" : "transparent", boxShadow: active ? "0 0 0 1px var(--blue)" : undefined }}>
                <span className="block text-sm font-bold">{o.icon} {o.title}</span>
                <span className="block text-xs" style={{ color: "var(--text-dim)" }}>{o.body}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-xs" style={{ color: "var(--text-faint)" }}>
          {votes
            ? "Players fill out the whole bracket first, then the crowd votes round by round and decides who really advances. Players are scored on how many winners they called."
            : "Players fill out the whole bracket first and are scored on the winners they called as you enter each final score."}
        </p>
      </fieldset>

      <fieldset className="bc-card p-4">
        <legend className="px-1 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>{votes ? "The bracket" : "The tournament"}</legend>
        <label className="block text-xs font-bold">
          Bracket name
          <input value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} maxLength={80} className={field} style={border} placeholder={votes ? "e.g. Best Halloween Costume 2026" : "e.g. Office March Madness 2027"} />
        </label>
        <label className="mt-3 block text-xs font-bold">
          Number of teams
          <select value={size} onChange={(e) => changeSize(Number(e.target.value) as (typeof SIZES)[number])} className={field} style={{ ...border, background: "var(--surface)" }}>
            {SIZES.map((n) => <option key={n} value={n}>{n} {votes ? "contestants" : "teams"}{n === 64 && !votes ? " (March Madness)" : ""}</option>)}
          </select>
        </label>
        <p className="mt-3 text-xs font-bold">{votes ? "Contestants" : "Teams"} ({teams.length} of {size})</p>
        <p className="mb-2 text-xs" style={{ color: "var(--text-faint)" }}>
          {votes
            ? "Add a name and, if you like, a photo or logo for each contestant. Each pair meets in Round 1: Game 1 is slots 1 and 2, Game 2 is slots 3 and 4, and winners then meet in the same order."
            : <>Pick from the team list (NCAA, NFL, NBA, MLB) to add the name and logo, or type your own. Each pair plays in Round 1: Game 1 is slots 1 and 2, Game 2 is slots 3 and 4, and winners then meet in the same order.
          For a seeded region, fill it top to bottom as 1, 16, 8, 9, 5, 12, 4, 13, 6, 11, 3, 14, 7, 10, 2, 15, then the next region.</>}
        </p>
        <ol className="flex flex-col gap-2">
          {slots.map((t, i) => (
            <li key={i} className={i % 2 === 1 ? "mb-2" : ""}>
              {i % 2 === 0 && <p className="mb-1 text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--text-faint)" }}>Game {i / 2 + 1}</p>}
              <div className="flex items-center gap-2">
                <span className="w-6 shrink-0 text-right text-xs font-bold" style={{ color: "var(--text-faint)" }}>{i + 1}</span>
                {t.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.logo} alt="" width={32} height={32} className="h-8 w-8 shrink-0 object-contain" />
                ) : (
                  <span className="h-8 w-8 shrink-0 rounded-full" style={{ background: "var(--surface-2)" }} aria-hidden />
                )}
                <input value={t.name} onChange={(e) => setSlot(i, { name: e.target.value, ...(t.logo && !votes ? { logo: "" } : {}) })} maxLength={40} placeholder={`${votes ? "Contestant" : "Team"} ${i + 1}`} aria-label={`${votes ? "Contestant" : "Team"} ${i + 1}`} className="h-10 min-w-0 flex-1 rounded-xl border bg-transparent px-3 text-sm" style={border} />
              </div>
              <div className="ml-8 mt-1">
                {votes ? (
                  <LogoUploadField value={t.logo} onChange={(url) => setSlot(i, { logo: url })} noun="photo" folder="applications" compact />
                ) : (
                  <TeamPicker label="Pick a team" onPick={(p) => setSlot(i, { name: p.name, logo: p.logo })} />
                )}
              </div>
            </li>
          ))}
        </ol>
        <button type="button" onClick={() => setShowPaste((v) => !v)} className="mt-1 text-xs font-bold" style={{ color: "var(--blue)" }}>
          {showPaste ? "Close" : "Paste a list of names instead"}
        </button>
        {showPaste && (
          <div className="mt-2">
            <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={6} className="w-full rounded-xl border bg-transparent p-3 text-sm" style={border} placeholder={"One team per line, in bracket order"} />
            <button type="button" onClick={applyPaste} className="mt-2 rounded-full border px-4 py-1.5 text-xs font-bold" style={border}>Fill the slots</button>
          </div>
        )}
      </fieldset>

      <fieldset className="bc-card p-4">
        <legend className="px-1 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>{votes ? "Voting schedule (your local time)" : "Round start times (your local time)"}</legend>
        {votes && (
          <label className="mb-3 block text-xs font-bold">
            Voting stays open on each matchup for
            <select value={voteHours} onChange={(e) => setVoteHours(Number(e.target.value))} className={field} style={{ ...border, background: "var(--surface)" }}>
              {VOTE_HOURS.map((h) => <option key={h} value={h}>{h} hours</option>)}
            </select>
          </label>
        )}
        <p className="mb-2 text-xs" style={{ color: "var(--text-faint)" }}>
          {votes
            ? `Everyone's bracket picks lock 15 minutes after Round 1 opens. Each round must open at least ${voteHours} hours after the one before it, so its voting can finish first. Results are tallied about once an hour after voting closes.`
            : "Everyone's picks lock 15 minutes after Round 1 starts. Each round must start after the one before it."}
        </p>
        {starts.map((s, i) => (
          <label key={i} className="mb-2 block text-xs font-bold">
            {roundLabel(i + 1, k)}{votes ? " voting opens" : ""} · {roundPoints(i + 1)} {roundPoints(i + 1) === 1 ? "point" : "points"} per correct pick
            <ZonedDateTimeInput value={s} onChange={(v) => setStarts((a) => a.map((x, j) => (j === i ? v : x)))} required className={field} style={border} />
          </label>
        ))}
      </fieldset>

      <fieldset className="bc-card p-4">
        <legend className="px-1 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>Who can enter</legend>
        {!votes && <div className="grid gap-2 sm:grid-cols-2">
          {TOURNEY_TIERS.map((t) => {
            const active = t.cap === cap;
            return (
              <button key={t.cap} type="button" onClick={() => setCap(t.cap)} aria-pressed={active} className="rounded-xl border p-3 text-left" style={{ borderColor: active ? "var(--blue)" : "var(--border)", background: active ? "var(--surface-2)" : "transparent", boxShadow: active ? "0 0 0 1px var(--blue)" : undefined }}>
                <span className="block text-sm font-bold">{t.label} · {money(t.cents)}</span>
                <span className="block text-xs" style={{ color: "var(--text-dim)" }}>Up to {t.cap.toLocaleString()} entrants</span>
              </button>
            );
          })}
        </div>}
        <label className="mt-3 flex items-start gap-2 text-sm font-semibold">
          <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} className="mt-1 h-4 w-4" />
          <span>
            Private pool
            <span className="block text-xs font-normal" style={{ color: "var(--text-dim)" }}>Invite-only with a link and 6-letter code. Hidden from public lists and leaderboards.</span>
          </span>
        </label>
        <p className="mt-3 text-xs" style={{ color: "var(--text-faint)" }}>
          {votes
            ? "Free for you and your players: up to 1,000 players can fill it out, and any signed-in fan can vote. Your bracket goes live as soon as you save it."
            : `Building is free. You pay ${money(tier.cents)} once when you publish, and your players always play free. Signed-in players only.`}
        </p>
      </fieldset>

      <div className="rounded-xl p-3 text-sm" style={{ background: "var(--surface-2)", color: "var(--text-dim)" }}>
        <p className="mb-1 font-bold" style={{ color: "var(--text)" }}>How it&apos;s graded</p>
        {votes ? (
          <ul className="list-disc pl-5">
            <li>Each correct pick earns points, and later rounds are worth more.</li>
            <li>When a matchup&apos;s voting closes, the contestant with more votes advances and everyone&apos;s pick is graded.</li>
            <li>If a matchup ends tied, you choose who advances.</li>
            <li>Players with the same points are ranked by who entered first.</li>
          </ul>
        ) : (
          <ul className="list-disc pl-5">
            <li>Wins and losses decide the standings: each correct pick earns points, and later rounds are worth more.</li>
            <li>Players also guess the championship score. That only breaks ties (closest total, then closest margin).</li>
            <li>The leaderboard updates every time you enter a final score.</li>
          </ul>
        )}
      </div>

      {error && <p role="alert" className="text-sm font-semibold" style={{ color: "var(--red)" }}>{error}</p>}
      <button type="submit" disabled={busy} className="bc-btn-solid rounded-full px-5 py-3 text-sm font-bold disabled:opacity-60">
        {busy ? "Saving…" : votes ? "Create my bracket" : "Save my bracket"}
      </button>
      {votes && (
        <p className="text-center text-xs" style={{ color: "var(--text-faint)" }}>
          Want video clips in a head-to-head bracket instead? <Link href="/competitions" className="font-bold underline">Use the clip bracket builder</Link>.
        </p>
      )}
    </form>
  );
}
