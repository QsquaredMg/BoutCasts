"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  MAX_ENTRY_FEE_CENTS,
  MIN_ENTRY_FEE_CENTS,
  MAX_PRIZES,
  PLATFORM_FEE_PCT,
  minEntriesForPrizes,
  money,
  validateCreate,
} from "@/lib/paidBouts";
import PaidBoutTerms from "@/components/PaidBoutTerms";
import ZonedDateTimeInput from "@/components/ZonedDateTimeInput";
import { getZone } from "@/lib/time/pref";
import { wallToIso } from "@/lib/time/zones";

const toCents = (v: string) => Math.round(Number(v) * 100);

export default function PaidBoutForm({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [rules, setRules] = useState("");
  const [judging, setJudging] = useState("");
  const [fee, setFee] = useState("10");
  const [minEntries, setMinEntries] = useState("8");
  const [maxEntries, setMaxEntries] = useState("");
  const [deadline, setDeadline] = useState("");
  const [inviteOnly, setInviteOnly] = useState(false);
  const [prizes, setPrizes] = useState<string[]>(["40"]);
  const [accept, setAccept] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const feeCents = toCents(fee);
  const prizeCents = prizes.map((p) => toCents(p));
  const prizeTotal = prizeCents.reduce((s, c) => s + (Number.isFinite(c) ? c : 0), 0);
  const suggestedMin = useMemo(
    () => (feeCents >= MIN_ENTRY_FEE_CENTS && prizeTotal > 0 ? minEntriesForPrizes(prizeTotal, feeCents) : null),
    [feeCents, prizeTotal]
  );

  const input = {
    title,
    description,
    rules,
    judging,
    entryFeeCents: feeCents,
    minEntries: Number(minEntries),
    maxEntries: maxEntries ? Number(maxEntries) : null,
    entryDeadline: deadline ? wallToIso(deadline, getZone()) : "",
    inviteOnly,
    prizes: prizeCents.map((amountCents, i) => ({ place: i + 1, amountCents })),
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const problem = validateCreate(input);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    const res = await fetch("/api/paid-bouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, acceptTerms: accept }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Couldn't create the bout.");
      return;
    }
    router.push(`/paid-bouts/${data.id}`);
  }

  const field = "rounded border px-3 py-2 text-sm";
  const border = { borderColor: "var(--border)" };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {error && <p className="rounded bg-red-100 p-3 text-sm text-red-700">{error}</p>}

      <input className={field} style={border} maxLength={120} placeholder="Bout title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <textarea className={`${field} min-h-[70px]`} style={border} maxLength={2000} placeholder="Short description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />

      <label className="flex flex-col gap-1 text-sm font-semibold">
        Rules
        <span className="text-xs font-normal" style={{ color: "var(--text-faint)" }}>
          What can people submit, time limits, eligibility, and anything that disqualifies an entry. Entrants read this before they pay.
        </span>
        <textarea className={`${field} min-h-[140px] font-normal`} style={border} value={rules} onChange={(e) => setRules(e.target.value)} />
      </label>

      <label className="flex flex-col gap-1 text-sm font-semibold">
        How winners are chosen
        <span className="text-xs font-normal" style={{ color: "var(--text-faint)" }}>
          Who decides (you, a judging panel, a crowd vote) and the criteria. Be specific.
        </span>
        <textarea className={`${field} min-h-[90px] font-normal`} style={border} value={judging} onChange={(e) => setJudging(e.target.value)} />
      </label>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs font-semibold">
          Entry fee ($)
          <input type="number" min={MIN_ENTRY_FEE_CENTS / 100} max={MAX_ENTRY_FEE_CENTS / 100} step="0.5" className={field} style={border} value={fee} onChange={(e) => setFee(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold">
          Minimum entries
          <input type="number" min={2} className={field} style={border} value={minEntries} onChange={(e) => setMinEntries(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold">
          Maximum (optional)
          <input type="number" min={2} className={field} style={border} value={maxEntries} onChange={(e) => setMaxEntries(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold">
          Entries close
          <ZonedDateTimeInput className={field} style={border} value={deadline} onChange={setDeadline} />
        </label>
      </div>

      <div className="rounded-lg border p-3" style={border}>
        <div className="mb-2 text-sm font-semibold">Prizes</div>
        <div className="flex flex-col gap-2">
          {prizes.map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-12 text-sm">Place {i + 1}</span>
              <span className="text-sm">$</span>
              <input type="number" min={1} step="1" className={`${field} w-28`} style={border} value={p} onChange={(e) => setPrizes((cur) => cur.map((v, j) => (j === i ? e.target.value : v)))} />
              {prizes.length > 1 && i === prizes.length - 1 && (
                <button type="button" onClick={() => setPrizes((cur) => cur.slice(0, -1))} className="text-xs underline">Remove</button>
              )}
            </div>
          ))}
        </div>
        {prizes.length < MAX_PRIZES && (
          <button type="button" onClick={() => setPrizes((cur) => [...cur, ""])} className="mt-2 text-xs font-semibold underline">
            Add another prize
          </button>
        )}
        <p className="mt-2 text-xs" style={{ color: "var(--text-faint)" }}>
          Prizes are guaranteed amounts. BoutCasts keeps {PLATFORM_FEE_PCT}% of entry fees, so they need to be covered at your minimum.
          {suggestedMin ? ` At ${money(feeCents)} per entry, ${money(prizeTotal)} in prizes needs at least ${suggestedMin} entries.` : ""}
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={inviteOnly} onChange={(e) => setInviteOnly(e.target.checked)} />
        Invite-only (entrants need the link from your invitation)
      </label>

      {feeCents >= MIN_ENTRY_FEE_CENTS && prizeTotal > 0 && Number(minEntries) >= 2 && (
        <PaidBoutTerms feeCents={feeCents} minEntries={Number(minEntries)} prizes={prizeCents.map((a, i) => ({ place: i + 1, amount_cents: Number.isFinite(a) ? a : 0 }))} />
      )}

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1" checked={accept} onChange={(e) => setAccept(e.target.checked)} />
        <span>
          I agree to the terms above. I will run this bout by the rules I published, choose winners the way I described, and I understand
          I am paid only after the platform fee and all prizes are paid.
        </span>
      </label>

      <button type="submit" disabled={busy || !accept} className="self-start rounded px-5 py-2 text-sm font-semibold text-white disabled:opacity-60" style={{ background: "var(--red)" }}>
        {busy ? "Saving…" : isAdmin ? "Create and open bout" : "Submit for review"}
      </button>
      {!isAdmin && (
        <p className="text-xs" style={{ color: "var(--text-faint)" }}>
          A BoutCasts admin reviews every paid bout before it opens for entries.
        </p>
      )}
    </form>
  );
}
