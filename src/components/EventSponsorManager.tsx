"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import FileUploadPicker from "@/components/FileUploadPicker";

// Organizer-sold sponsorships for an event (paid sizes, up to 12). Schools and
// groups use this to fundraise: sell spots to local businesses, record what
// each pledged (only the organizer sees amounts), and hand sponsors a report.
type Level = "title" | "gold" | "supporter";
type Sponsor = {
  id: string;
  name: string;
  logo_url: string | null;
  link_url: string | null;
  level: Level;
  amount_cents: number | null;
};

const MAX = 12;
export const LEVEL_LABEL: Record<Level, string> = { title: "Title sponsor", gold: "Gold", supporter: "Supporter" };

function dollars(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}
function toCents(v: string): number | null {
  const n = Number(v.replace(/[$,\s]/g, ""));
  return v.trim() === "" || !Number.isFinite(n) || n < 0 ? null : Math.round(n * 100);
}

export default function EventSponsorManager({ eventId, editable }: { eventId: string; editable: boolean }) {
  const supabase = createClient();
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [name, setName] = useState("");
  const [link, setLink] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [level, setLevel] = useState<Level>("supporter");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("get_event_sponsors_admin", { p_event_id: eventId });
    setSponsors((data ?? []) as Sponsor[]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    let url = link.trim();
    if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`;
    setBusy(true);
    const { error: insError } = await supabase.from("live_vote_sponsors").insert({
      event_id: eventId,
      name: name.trim(),
      link_url: url || null,
      logo_url: logo,
      level,
      amount_cents: toCents(amount),
      sort_order: sponsors.length,
    });
    setBusy(false);
    if (insError) {
      setError(insError.message.includes("row-level security") ? `You can add up to ${MAX} sponsors on paid events.` : insError.message);
      return;
    }
    setName("");
    setLink("");
    setLogo(null);
    setAmount("");
    setLevel("supporter");
    load();
  }

  async function update(id: string, patch: Partial<Pick<Sponsor, "level" | "amount_cents">>) {
    await supabase.from("live_vote_sponsors").update(patch).eq("id", id);
    load();
  }

  async function remove(id: string) {
    if (!confirm("Remove this sponsor?")) return;
    await supabase.from("live_vote_sponsors").delete().eq("id", id);
    load();
  }

  const raised = sponsors.reduce((sum, s) => sum + (s.amount_cents ?? 0), 0);
  const box = { borderColor: "var(--border)", background: "var(--surface)" };
  const input = "w-full rounded-[10px] border px-3 py-2 text-sm";

  return (
    <div className="mb-4 rounded-xl border p-3.5" style={box}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
          Sponsors &amp; fundraising ({sponsors.length}/{MAX})
        </p>
        {raised > 0 && (
          <span className="rounded-full px-2.5 py-0.5 text-xs font-bold" style={{ background: "var(--gold-soft, #fff4d6)", color: "var(--gold, #9a6b00)" }}>
            {dollars(raised)} raised
          </span>
        )}
      </div>
      <p className="mb-3 text-xs" style={{ color: "var(--text-faint)" }}>
        Sell sponsor spots to local businesses to raise money for your school, team or group. Their logos show on your
        voting page (the title sponsor gets &quot;Presented by&quot; at the top). Amounts are only visible to you.
      </p>

      {sponsors.length > 0 && (
        <ul className="mb-3 flex flex-col gap-2">
          {sponsors.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-2.5 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border)" }}>
              {s.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.logo_url} alt="" className="h-8 w-8 rounded object-contain" />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded text-xs font-bold" style={{ background: "var(--surface-2)" }}>
                  {s.name.slice(0, 1)}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{s.name}</span>
                {s.link_url && (
                  <span className="block truncate text-xs" style={{ color: "var(--text-faint)" }}>
                    {s.link_url.replace(/^https?:\/\//, "")}
                  </span>
                )}
              </span>
              {editable ? (
                <>
                  <select
                    value={s.level}
                    onChange={(e) => update(s.id, { level: e.target.value as Level })}
                    className="rounded-lg border px-1.5 py-1 text-xs"
                    style={box}
                    aria-label={`Level for ${s.name}`}
                  >
                    {(Object.keys(LEVEL_LABEL) as Level[]).map((l) => (
                      <option key={l} value={l}>
                        {LEVEL_LABEL[l]}
                      </option>
                    ))}
                  </select>
                  <input
                    defaultValue={s.amount_cents != null ? String(s.amount_cents / 100) : ""}
                    onBlur={(e) => {
                      const c = toCents(e.target.value);
                      if (c !== s.amount_cents) update(s.id, { amount_cents: c });
                    }}
                    inputMode="decimal"
                    placeholder="$ amount"
                    className="w-20 rounded-lg border px-2 py-1 text-xs"
                    style={box}
                    aria-label={`Amount from ${s.name}`}
                  />
                  <button type="button" onClick={() => remove(s.id)} className="px-1 text-xs" style={{ color: "var(--text-faint)" }} aria-label={`Remove ${s.name}`}>
                    ✕
                  </button>
                </>
              ) : (
                <span className="text-xs" style={{ color: "var(--text-dim)" }}>
                  {LEVEL_LABEL[s.level]}
                  {s.amount_cents ? ` · ${dollars(s.amount_cents)}` : ""}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {editable && sponsors.length < MAX && (
        <form onSubmit={add} className="flex flex-col gap-2">
          <input className={input} style={box} placeholder="Sponsor name (e.g. Main Street Pizza)" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <select className={input} style={box} value={level} onChange={(e) => setLevel(e.target.value as Level)} aria-label="Sponsor level">
              {(Object.keys(LEVEL_LABEL) as Level[]).map((l) => (
                <option key={l} value={l}>
                  {LEVEL_LABEL[l]}
                </option>
              ))}
            </select>
            <input className={input} style={box} placeholder="Amount ($, optional)" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <input className={input} style={box} placeholder="Website (optional)" value={link} onChange={(e) => setLink(e.target.value)} />
          {logo ? (
            <div className="flex items-center gap-2 text-xs">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logo} alt="" className="h-10 w-10 rounded border object-contain" style={{ borderColor: "var(--border)" }} />
              <button type="button" onClick={() => setLogo(null)} style={{ color: "var(--text-faint)" }}>
                Remove logo
              </button>
            </div>
          ) : (
            <FileUploadPicker onUploaded={setLogo} />
          )}
          <button type="submit" disabled={busy || !name.trim()} className="bc-btn-solid rounded-full px-4 py-2 text-sm font-bold disabled:opacity-60">
            {busy ? "Adding…" : "Add sponsor"}
          </button>
          {error && (
            <p className="text-xs" style={{ color: "var(--danger)" }}>
              {error}
            </p>
          )}
        </form>
      )}

      {sponsors.length > 0 && (
        <Link
          href={`/live-vote/${eventId}/sponsors`}
          className="mt-3 block rounded-full border px-4 py-2 text-center text-sm font-bold"
          style={{ borderColor: "var(--border)", color: "var(--text)" }}
        >
          📊 Sponsor report to share with sponsors
        </Link>
      )}
    </div>
  );
}
