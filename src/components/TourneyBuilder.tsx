"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ZonedDateTimeInput from "@/components/ZonedDateTimeInput";
import { TOURNEY_TIERS, money, roundLabel, roundPoints } from "@/lib/predictions/pricing";
import { getZone } from "@/lib/time/pref";
import { wallToIso } from "@/lib/time/zones";

const SIZES = [4, 8, 16, 32, 64] as const;
const rounds = (n: number) => Math.round(Math.log2(n));

// Organizer setup for a March Madness style bracket. Free to build; the organizer pays when they publish it,
// by how many people can enter. Players always play free.
export default function TourneyBuilder() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [size, setSize] = useState<(typeof SIZES)[number]>(8);
  const [teamText, setTeamText] = useState("");
  const [starts, setStarts] = useState<string[]>(["", "", ""]);
  const [cap, setCap] = useState<number>(TOURNEY_TIERS[1].cap);
  const [isPrivate, setIsPrivate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const teams = useMemo(() => teamText.split("\n").map((t) => t.trim()).filter(Boolean), [teamText]);
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
  const tier = TOURNEY_TIERS.find((t) => t.cap === cap) ?? TOURNEY_TIERS[1];

  function changeSize(n: (typeof SIZES)[number]) {
    setSize(n);
    setStarts((s) => Array.from({ length: rounds(n) }, (_, i) => s[i] ?? ""));
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
    setBusy(true);
    try {
      const { data, error: rpcErr } = await createClient().rpc("create_pred_tourney", {
        p_title: title,
        p_teams: teams.map((name) => ({ name })),
        p_round_starts: starts.map((s) => (s ? wallToIso(s, getZone()) : null)),
        p_cap: cap,
        p_private: isPrivate,
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
        <legend className="px-1 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>The tournament</legend>
        <label className="block text-xs font-bold">
          Bracket name
          <input value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} maxLength={80} className={field} style={border} placeholder="e.g. Office March Madness 2027" />
        </label>
        <label className="mt-3 block text-xs font-bold">
          Number of teams
          <select value={size} onChange={(e) => changeSize(Number(e.target.value) as (typeof SIZES)[number])} className={field} style={{ ...border, background: "var(--surface)" }}>
            {SIZES.map((n) => <option key={n} value={n}>{n} teams{n === 64 ? " (March Madness)" : ""}</option>)}
          </select>
        </label>
        <label className="mt-3 block text-xs font-bold">
          Teams, one per line ({teams.length} of {size})
          <textarea value={teamText} onChange={(e) => setTeamText(e.target.value)} required rows={Math.min(Math.max(size, 6), 16)} className="mt-1 w-full rounded-xl border bg-transparent p-3 text-sm font-normal" style={border} placeholder={"Team A\nTeam B\nTeam C\nTeam D"} />
        </label>
        <p className="mt-2 text-xs" style={{ color: "var(--text-faint)" }}>
          Teams are matched in the order you list them: line 1 plays line 2, line 3 plays line 4, and so on. Winners then meet in the next round in the same order.
          For a seeded region, list it top to bottom as 1, 16, 8, 9, 5, 12, 4, 13, 6, 11, 3, 14, 7, 10, 2, 15, then continue with the next region.
        </p>
      </fieldset>

      <fieldset className="bc-card p-4">
        <legend className="px-1 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>Round start times (your local time)</legend>
        <p className="mb-2 text-xs" style={{ color: "var(--text-faint)" }}>
          Everyone&apos;s picks lock 15 minutes after Round 1 starts. Each round must start after the one before it.
        </p>
        {starts.map((s, i) => (
          <label key={i} className="mb-2 block text-xs font-bold">
            {roundLabel(i + 1, k)} · {roundPoints(i + 1)} {roundPoints(i + 1) === 1 ? "point" : "points"} per correct pick
            <ZonedDateTimeInput value={s} onChange={(v) => setStarts((a) => a.map((x, j) => (j === i ? v : x)))} required className={field} style={border} />
          </label>
        ))}
      </fieldset>

      <fieldset className="bc-card p-4">
        <legend className="px-1 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>Who can enter</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {TOURNEY_TIERS.map((t) => {
            const active = t.cap === cap;
            return (
              <button key={t.cap} type="button" onClick={() => setCap(t.cap)} aria-pressed={active} className="rounded-xl border p-3 text-left" style={{ borderColor: active ? "var(--blue)" : "var(--border)", background: active ? "var(--surface-2)" : "transparent", boxShadow: active ? "0 0 0 1px var(--blue)" : undefined }}>
                <span className="block text-sm font-bold">{t.label} · {money(t.cents)}</span>
                <span className="block text-xs" style={{ color: "var(--text-dim)" }}>Up to {t.cap.toLocaleString()} entrants</span>
              </button>
            );
          })}
        </div>
        <label className="mt-3 flex items-start gap-2 text-sm font-semibold">
          <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} className="mt-1 h-4 w-4" />
          <span>
            Private pool
            <span className="block text-xs font-normal" style={{ color: "var(--text-dim)" }}>Invite-only with a link and 6-letter code. Hidden from public lists and leaderboards.</span>
          </span>
        </label>
        <p className="mt-3 text-xs" style={{ color: "var(--text-faint)" }}>
          Building is free. You pay {money(tier.cents)} once when you publish, and your players always play free. Signed-in players only.
        </p>
      </fieldset>

      <div className="rounded-xl p-3 text-sm" style={{ background: "var(--surface-2)", color: "var(--text-dim)" }}>
        <p className="mb-1 font-bold" style={{ color: "var(--text)" }}>How it&apos;s graded</p>
        <ul className="list-disc pl-5">
          <li>Wins and losses decide the standings: each correct pick earns points, and later rounds are worth more.</li>
          <li>Players also guess the championship score. That only breaks ties (closest total, then closest margin).</li>
          <li>The leaderboard updates every time you enter a final score.</li>
        </ul>
      </div>

      {error && <p role="alert" className="text-sm font-semibold" style={{ color: "var(--red)" }}>{error}</p>}
      <button type="submit" disabled={busy} className="bc-btn-solid rounded-full px-5 py-3 text-sm font-bold disabled:opacity-60">
        {busy ? "Saving…" : "Save my bracket"}
      </button>
    </form>
  );
}
