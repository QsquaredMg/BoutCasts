"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SignInCard from "@/components/SignInCard";
import { createClient } from "@/lib/supabase/client";
import { EMPTY_VENUE, venueCols } from "@/components/VenueFields";
import { LIVE_VOTE_TIERS, tierPriceLabel, type LiveVoteTier } from "@/lib/liveVoteEvents/tiers";

const EXAMPLES = ["Which band performed the best?", "Best halftime show?", "Who is the fan of the game?", "Pick the winner of the dance-off"];
const MAX_OPTIONS = 8;

// Quick Vote: the fast way to put a head-to-head (or any short pick-one list) on the jumbotron.
// It builds a normal Live Vote event (open link, one vote per phone, live results), so everything
// downstream (payment, QR, big screen, results) is the existing Live Vote flow.
export default function QuickVotePage() {
  const supabase = createClient();
  const router = useRouter();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [tier, setTier] = useState<LiveVoteTier>("small");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [example] = useState(() => EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setSignedIn(!!data.user));
  }, [supabase]);

  const setOpt = (i: number, v: string) => setOptions((p) => p.map((x, j) => (j === i ? v : x)));
  const labels = options.map((o) => o.trim()).filter(Boolean);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!question.trim()) return setError("Type the question people are voting on.");
    if (labels.length < 2) return setError("Add at least two options.");
    if (new Set(labels.map((l) => l.toLowerCase())).size !== labels.length) return setError("Each option needs a different name.");
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      setBusy(false);
      return router.push("/login?next=%2Flive-vote%2Fquick");
    }
    const cfg = LIVE_VOTE_TIERS[tier];
    const { data: ev, error: evErr } = await supabase
      .from("live_vote_events")
      .insert({
        organizer_id: u.user.id,
        title: question.trim(),
        voter_mode: "open_link",
        voting_method: "single",
        scoring_mode: "crowd",
        listed_publicly: false,
        is_private: true,
        tier,
        price_cents: cfg.priceCents,
        status: "draft",
        ...venueCols(EMPTY_VENUE),
      })
      .select("id")
      .single();
    if (evErr || !ev) {
      setBusy(false);
      return setError(evErr?.message || "Couldn't create the vote.");
    }
    const { error: optErr } = await supabase.from("live_vote_options").insert(labels.map((name, idx) => ({ event_id: ev.id, name, sort_order: idx })));
    if (optErr) {
      await supabase.from("live_vote_events").delete().eq("id", ev.id);
      setBusy(false);
      return setError(optErr.message || "Couldn't save the options.");
    }
    router.push(`/live-vote/${ev.id}`);
  }

  if (signedIn === false) {
    return <SignInCard eyebrow="Quick Vote" title="Run a Quick Vote on the big screen" body="Sign in, then you'll come right back here to build your vote." next="/live-vote/quick" />;
  }

  const input = "w-full rounded-[10px] border px-3.5 py-2.5 text-base";
  const style = { borderColor: "var(--border)", background: "var(--surface)" };

  return (
    <div className="mx-auto max-w-xl px-5 py-8">
      <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>Quick Vote</p>
      <h1 className="text-3xl font-extrabold">Head-to-head on the big screen</h1>
      <p className="mt-2 text-sm" style={{ color: "var(--text-dim)" }}>
        Ask one question, list the choices, and put it on the jumbotron. The crowd scans a QR code, votes once on their phone, and the bars move instantly. Use it for bands, dance teams, mascots, plays of the game, halftime acts, or anything else.
      </p>

      <form onSubmit={create} className="mt-6 grid gap-5">
        <label className="grid gap-1.5 text-sm font-bold">
          The question
          <input className={input} style={style} value={question} maxLength={120} placeholder={example} onChange={(e) => setQuestion(e.target.value)} />
        </label>

        <div className="grid gap-2">
          <p className="text-sm font-bold">The choices</p>
          {options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <input className={input} style={style} value={o} maxLength={60} placeholder={i === 0 ? "School band A" : i === 1 ? "School band B" : `Choice ${i + 1}`} onChange={(e) => setOpt(i, e.target.value)} />
              {options.length > 2 && (
                <button type="button" aria-label={`Remove choice ${i + 1}`} onClick={() => setOptions((p) => p.filter((_, j) => j !== i))} className="shrink-0 rounded-full border px-3 py-2 text-sm font-bold" style={{ borderColor: "var(--border)" }}>✕</button>
              )}
            </div>
          ))}
          {options.length < MAX_OPTIONS && (
            <button type="button" onClick={() => setOptions((p) => [...p, ""])} className="justify-self-start rounded-full border px-4 py-2 text-sm font-bold" style={{ borderColor: "var(--border)" }}>+ Add a choice</button>
          )}
          <p className="text-xs" style={{ color: "var(--text-faint)" }}>Two choices make a head-to-head. Add up to {MAX_OPTIONS}.</p>
        </div>

        <div className="grid gap-2">
          <p className="text-sm font-bold">How big is the crowd?</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {(["free", "small", "medium", "large"] as LiveVoteTier[]).map((t) => {
              const cfg = LIVE_VOTE_TIERS[t];
              const on = tier === t;
              return (
                <button key={t} type="button" onClick={() => setTier(t)} className="rounded-[10px] border px-3 py-2.5 text-left" style={{ borderColor: on ? "var(--red)" : "var(--border)", background: on ? "var(--red-soft, var(--surface-2))" : "var(--surface)" }}>
                  <p className="text-sm font-bold">{cfg.label} · {tierPriceLabel(t)}</p>
                  <p className="text-xs" style={{ color: "var(--text-faint)" }}>Up to {cfg.voteCap.toLocaleString()} votes</p>
                </button>
              );
            })}
          </div>
          <p className="text-xs" style={{ color: "var(--text-faint)" }}>Free is good for a test run. Pick Small or larger for a real crowd. You pay on the next screen, then open voting and the big screen from there.</p>
        </div>

        {error && <p className="text-sm font-semibold" style={{ color: "var(--danger)" }}>{error}</p>}
        <button disabled={busy} className="bc-btn-solid rounded-full px-6 py-3 text-base font-bold disabled:opacity-50">{busy ? "Creating…" : "Create Quick Vote"}</button>
      </form>
    </div>
  );
}
