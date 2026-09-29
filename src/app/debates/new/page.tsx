"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Category = { id: string; name: string };

export default function NewDebatePage() {
  const supabase = createClient();
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [statement, setStatement] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [format, setFormat] = useState<"open" | "bracket">("open");
  const [bracketSize, setBracketSize] = useState(8);
  const [rounds, setRounds] = useState(3);
  const [turnHours, setTurnHours] = useState(48);
  const [votingHours, setVotingHours] = useState(48);
  const [scoring, setScoring] = useState<"crowd" | "judges" | "both">("crowd");
  const [crowdWeight, setCrowdWeight] = useState(50);
  const [hideTally, setHideTally] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function check() {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return setAllowed(false);
      const [{ data: p }, { data: cats }] = await Promise.all([
        supabase.from("profiles").select("is_admin").eq("id", u.user.id).maybeSingle(),
        supabase.from("categories").select("id, name").order("name"),
      ]);
      setAllowed(Boolean(p?.is_admin));
      setCategories(cats ?? []);
    }
    check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("create_debate_topic", {
      p_statement: statement,
      p_description: description,
      p_category_id: categoryId || null,
      p_format: format,
      p_bracket_size: format === "bracket" ? bracketSize : null,
      p_rounds: rounds,
      p_turn_hours: turnHours,
      p_voting_hours: votingHours,
      p_scoring_mode: scoring,
      p_crowd_weight: crowdWeight,
      p_hide_tally: hideTally,
    });
    setSaving(false);
    if (rpcError) return setError(rpcError.message);
    router.push(`/debates/${data}`);
  }

  if (allowed === null) return <p className="mx-auto max-w-2xl px-5 py-10" style={{ color: "var(--text-faint)" }}>Loading…</p>;
  if (!allowed)
    return (
      <p className="mx-auto max-w-2xl px-5 py-10" style={{ color: "var(--text-faint)" }}>
        Only admins can create debate topics right now. <Link href="/debates" className="underline">Back to debates</Link>
      </p>
    );

  const input = "w-full rounded-[10px] border px-3 py-2.5 text-sm";
  const inputStyle = { borderColor: "var(--border)", background: "var(--surface)" };
  const label = "mb-1 block text-xs font-bold uppercase tracking-wide";
  const chip = (active: boolean) => `bc-chip${active ? " active" : ""}`;

  return (
    <form onSubmit={create} className="mx-auto flex max-w-xl flex-col gap-5 px-5 py-8">
      <div>
        <Link href="/debates" className="mb-3 inline-block text-sm font-semibold" style={{ color: "var(--blue)" }}>
          ← Debates
        </Link>
        <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
          New debate topic
        </h1>
      </div>

      <div>
        <label className={label} style={{ color: "var(--text-dim)" }}>
          The statement debaters argue For or Against
        </label>
        <input required minLength={5} maxLength={200} value={statement} onChange={(e) => setStatement(e.target.value)} placeholder="College should be free" className={input} style={inputStyle} />
      </div>
      <div>
        <label className={label} style={{ color: "var(--text-dim)" }}>
          Details (optional)
        </label>
        <textarea maxLength={1000} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Rules, context, prizes…" className={input} style={inputStyle} />
      </div>
      <div>
        <label className={label} style={{ color: "var(--text-dim)" }}>
          Category
        </label>
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={input} style={inputStyle}>
          <option value="">None</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <p className={label} style={{ color: "var(--text-dim)" }}>
          Format
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={chip(format === "open")} onClick={() => setFormat("open")}>
            Open queue
          </button>
          <button type="button" className={chip(format === "bracket")} onClick={() => setFormat("bracket")}>
            Bracket tournament
          </button>
        </div>
        <p className="mt-1.5 text-xs" style={{ color: "var(--text-faint)" }}>
          {format === "open"
            ? "Debaters pick For or Against and get paired as soon as someone takes the other side. Unlimited matches."
            : "Debaters enter the bracket; it starts when full. Sides are assigned per match and winners advance to a champion."}
        </p>
        {format === "bracket" && (
          <div className="mt-2 flex gap-2">
            {[4, 8, 16].map((n) => (
              <button key={n} type="button" className={chip(bracketSize === n)} onClick={() => setBracketSize(n)}>
                {n} debaters
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className={label} style={{ color: "var(--text-dim)" }}>
          Rounds per match
        </p>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" className={chip(rounds === n)} onClick={() => setRounds(n)}>
              {n}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs" style={{ color: "var(--text-faint)" }}>
          Each round = one video (up to 3:00) from each side. For opens every round; Against gets the final word.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label} style={{ color: "var(--text-dim)" }}>
            Hours to respond
          </label>
          <select value={turnHours} onChange={(e) => setTurnHours(Number(e.target.value))} className={input} style={inputStyle}>
            {[6, 12, 24, 48, 72].map((h) => (
              <option key={h} value={h}>
                {h} hours
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label} style={{ color: "var(--text-dim)" }}>
            Voting window
          </label>
          <select value={votingHours} onChange={(e) => setVotingHours(Number(e.target.value))} className={input} style={inputStyle}>
            {[12, 24, 48, 72, 168].map((h) => (
              <option key={h} value={h}>
                {h === 168 ? "1 week" : `${h} hours`}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <p className={label} style={{ color: "var(--text-dim)" }}>
          Who decides the winner
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={chip(scoring === "crowd")} onClick={() => setScoring("crowd")}>
            Crowd vote
          </button>
          <button type="button" className={chip(scoring === "judges")} onClick={() => setScoring("judges")}>
            Judges
          </button>
          <button type="button" className={chip(scoring === "both")} onClick={() => setScoring("both")}>
            Both
          </button>
        </div>
        {scoring === "both" && (
          <label className="mt-2 block text-sm">
            Crowd {crowdWeight}% · Judges {100 - crowdWeight}%
            <input type="range" min={10} max={90} step={10} value={crowdWeight} onChange={(e) => setCrowdWeight(Number(e.target.value))} className="mt-1 w-full accent-[var(--red)]" />
          </label>
        )}
        {scoring !== "crowd" && (
          <p className="mt-1.5 text-xs" style={{ color: "var(--text-faint)" }}>
            Add judges on the topic page after you create it. They score argument, evidence, rebuttal and delivery (1–10 each).
          </p>
        )}
      </div>

      <label className="flex cursor-pointer items-center gap-2.5 text-sm">
        <input type="checkbox" className="h-4 w-4 accent-[var(--red)]" checked={hideTally} onChange={(e) => setHideTally(e.target.checked)} />
        Hide the vote count until voting closes (recommended)
      </label>

      {error && (
        <p className="text-sm" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}
      <button type="submit" disabled={saving || statement.trim().length < 5} className="bc-btn-solid rounded-full px-5 py-3 text-sm font-bold disabled:opacity-50">
        {saving ? "Creating…" : "Create debate topic"}
      </button>
    </form>
  );
}
