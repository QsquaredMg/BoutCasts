"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ImageField from "@/components/ImageField";

// Organizer-sold sponsor spots for a paid bracket (up to 12). Amounts are private.
type Level = "title" | "gold" | "supporter";
type Sponsor = { id: string; name: string; logo_url: string | null; link_url: string | null; level: Level; amount_cents: number | null; clicks: number; views: number };

const MAX = 12;
const LEVEL_LABEL: Record<Level, string> = { title: "Title sponsor", gold: "Gold", supporter: "Supporter" };
const dollars = (c: number) => `$${(c / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const toCents = (v: string): number | null => {
  const n = Number(v.replace(/[$,\s]/g, ""));
  return v.trim() === "" || !Number.isFinite(n) || n < 0 ? null : Math.round(n * 100);
};

export default function PredSponsorManager({ bracketId }: { bracketId: string }) {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [name, setName] = useState("");
  const [link, setLink] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [level, setLevel] = useState<Level>("supporter");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await createClient().rpc("get_pred_sponsors_admin", { p_bracket: bracketId });
    setSponsors((data ?? []) as Sponsor[]);
  }, [bracketId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error: err } = await createClient().rpc("add_pred_sponsor", { p_bracket: bracketId, p_name: name, p_logo: logo, p_link: link, p_level: level, p_amount_cents: toCents(amount) });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setName(""); setLink(""); setLogo(null); setAmount(""); setLevel("supporter");
    load();
  }
  async function update(id: string, lvl: Level, cents: number | null) {
    await createClient().rpc("update_pred_sponsor", { p_id: id, p_level: lvl, p_amount_cents: cents });
    load();
  }
  async function remove(id: string) {
    if (!confirm("Remove this sponsor?")) return;
    await createClient().from("pred_sponsors").delete().eq("id", id);
    load();
  }

  const raised = sponsors.reduce((sum, s) => sum + (s.amount_cents ?? 0), 0);
  const views = sponsors[0]?.views ?? 0;
  const box = { borderColor: "var(--border)", background: "var(--surface)" };
  const input = "w-full rounded-[10px] border px-3 py-2 text-sm";

  return (
    <div className="bc-card mb-6 p-5">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>Sponsors ({sponsors.length}/{MAX})</h2>
        {raised > 0 && <span className="rounded-full px-2.5 py-0.5 text-xs font-bold" style={{ background: "var(--gold-soft, #fff4d6)", color: "var(--gold, #9a6b00)" }}>{dollars(raised)} raised</span>}
      </div>
      <p className="mb-3 text-xs" style={{ color: "var(--text-faint)" }}>
        Sell sponsor spots to local businesses. Their logos show on your bracket and the title sponsor gets &quot;Presented by&quot; on the winners graphic. Amounts are only visible to you.
        {views > 0 ? ` Your sponsors have been seen ${views} ${views === 1 ? "time" : "times"}.` : ""}
      </p>

      {sponsors.length > 0 && (
        <ul className="mb-3 flex flex-col gap-2">
          {sponsors.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-2.5 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border)" }}>
              {s.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.logo_url} alt="" className="h-8 w-8 rounded object-contain" />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded text-xs font-bold" style={{ background: "var(--surface-2)" }}>{s.name.slice(0, 1)}</span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{s.name}</span>
                <span className="block truncate text-xs" style={{ color: "var(--text-faint)" }}>{s.clicks} {s.clicks === 1 ? "click" : "clicks"}{s.link_url ? ` · ${s.link_url.replace(/^https?:\/\//, "")}` : ""}</span>
              </span>
              <select value={s.level} onChange={(e) => update(s.id, e.target.value as Level, s.amount_cents)} className="rounded-lg border px-1.5 py-1 text-xs" style={box} aria-label={`Level for ${s.name}`}>
                {(Object.keys(LEVEL_LABEL) as Level[]).map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
              </select>
              <input
                defaultValue={s.amount_cents != null ? String(s.amount_cents / 100) : ""}
                onBlur={(e) => { const c = toCents(e.target.value); if (c !== s.amount_cents) update(s.id, s.level, c); }}
                inputMode="decimal" placeholder="$ amount" className="w-20 rounded-lg border px-2 py-1 text-xs" style={box} aria-label={`Amount from ${s.name}`}
              />
              <button type="button" onClick={() => remove(s.id)} className="px-1 text-xs" style={{ color: "var(--text-faint)" }} aria-label={`Remove ${s.name}`}>✕</button>
            </li>
          ))}
        </ul>
      )}

      {sponsors.length < MAX && (
        <form onSubmit={add} className="flex flex-col gap-2">
          <input className={input} style={box} placeholder="Sponsor name (e.g. Main Street Pizza)" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} required />
          <div className="grid grid-cols-2 gap-2">
            <select className={input} style={box} value={level} onChange={(e) => setLevel(e.target.value as Level)} aria-label="Sponsor level">
              {(Object.keys(LEVEL_LABEL) as Level[]).map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
            </select>
            <input className={input} style={box} placeholder="Amount ($, optional)" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <input className={input} style={box} placeholder="Website (optional)" value={link} onChange={(e) => setLink(e.target.value)} />
          <ImageField value={logo} onChange={setLogo} label="sponsor logo" />
          {error && <p role="alert" className="text-xs font-semibold" style={{ color: "var(--red)" }}>{error}</p>}
          <button type="submit" disabled={busy || !name.trim()} className="bc-btn-solid rounded-full px-4 py-2.5 text-sm font-bold disabled:opacity-60">{busy ? "Adding…" : "Add sponsor"}</button>
        </form>
      )}
    </div>
  );
}
