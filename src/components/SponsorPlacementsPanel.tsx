"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import SponsorForm from "@/components/SponsorForm";
import { KIND_NAME, LEVEL_LABEL, dollars, toCents, type LibrarySponsor, type SponsorKind, type SponsorLevel, type TargetSponsor } from "@/lib/sponsors";

// Manage the sponsors on one trivia pack, live vote, bracket or bout: add from your library (or create a new
// sponsor), change level, amount and the commercial add-on, edit a sponsor's details, and see views and taps.
export default function SponsorPlacementsPanel({ kind, targetId, editable = true }: { kind: SponsorKind; targetId: string; editable?: boolean }) {
  const [rows, setRows] = useState<TargetSponsor[]>([]);
  const [library, setLibrary] = useState<LibrarySponsor[]>([]);
  const [missing, setMissing] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [pick, setPick] = useState("");
  const [level, setLevel] = useState<SponsorLevel>("supporter");
  const [amount, setAmount] = useState("");
  const [commercial, setCommercial] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const sb = createClient();
    const [{ data, error: e }, { data: lib }] = await Promise.all([
      sb.rpc("get_target_sponsors_admin", { p_kind: kind, p_target: targetId }),
      sb.from("sponsor_library").select("id,name,logo_url,link_url,commercial_url,commercial_kind").order("name"),
    ]);
    if (e) {
      // Before the sponsor-library SQL has been run, or when you can't manage sponsors here, hide the panel.
      setMissing(true);
      return;
    }
    setRows(((data ?? []) as TargetSponsor[]).map((r) => ({ ...r, views: Number(r.views), clicks: Number(r.clicks), commercials: Number(r.commercials) })));
    setLibrary((lib ?? []) as LibrarySponsor[]);
  }, [kind, targetId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  if (missing) return null;
  const placedIds = new Set(rows.map((r) => r.sponsor_id));
  const available = library.filter((l) => !placedIds.has(l.id));
  const chosen = library.find((l) => l.id === pick);
  const raised = rows.reduce((s, r) => s + (r.amount_cents ?? 0), 0);
  const box = { borderColor: "var(--border)" };
  const input = "w-full rounded-lg border px-3 py-2 text-sm";

  async function assign(sponsorId: string) {
    setError(null);
    setBusy(true);
    const { error: err } = await createClient().rpc("assign_sponsor", {
      p_sponsor: sponsorId, p_kind: kind, p_target: targetId, p_level: level, p_amount_cents: toCents(amount), p_commercial: commercial,
    });
    setBusy(false);
    if (err) return setError(err.message);
    setPick(""); setAmount(""); setLevel("supporter"); setCommercial(false); setCreating(false);
    load();
  }
  async function change(r: TargetSponsor, patch: Partial<Pick<TargetSponsor, "level" | "amount_cents" | "with_commercial">>) {
    setError(null);
    const next = { level: r.level, amount_cents: r.amount_cents, with_commercial: r.with_commercial, ...patch };
    const { error: err } = await createClient().rpc("update_sponsor_placement", {
      p_id: r.placement_id, p_level: next.level, p_amount_cents: next.amount_cents, p_commercial: next.with_commercial,
    });
    if (err) setError(err.message);
    load();
  }
  async function remove(r: TargetSponsor) {
    if (!confirm(`Take ${r.name} off this ${KIND_NAME[kind].toLowerCase()}? It stays in your sponsor library.`)) return;
    await createClient().rpc("remove_sponsor_placement", { p_id: r.placement_id });
    load();
  }

  return (
    <section className="mt-5 rounded-2xl border p-4" style={box}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-2 text-left" aria-expanded={open}>
        <span>
          <span className="block font-bold">🤝 Sponsors ({rows.length}/12){raised > 0 ? ` · ${dollars(raised)} raised` : ""}</span>
          <span className="block text-xs opacity-70">Logos on the screen and pages, optional commercials, and counts of views and taps</span>
        </span>
        <span className="text-sm font-bold">{open ? "Close" : "Edit"}</span>
      </button>
      {open && (
        <div className="mt-4">
          <p className="mb-3 text-xs opacity-70">
            The title sponsor gets &quot;Presented by&quot;. Amounts are only visible to you. Reuse any sponsor from your <Link href="/sponsors" className="font-semibold underline">sponsor library</Link>.
          </p>
          {rows.length > 0 && (
            <ul className="mb-3 flex flex-col gap-2">
              {rows.map((r) => (
                <li key={r.placement_id} className="rounded-lg border px-3 py-2 text-sm" style={box}>
                  <div className="flex flex-wrap items-center gap-2.5">
                    {r.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.logo_url} alt="" className="h-8 w-8 rounded object-contain" />
                    ) : (
                      <span className="flex h-8 w-8 items-center justify-center rounded bg-black/10 text-xs font-bold">{r.name.slice(0, 1)}</span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{r.name}</span>
                      <span className="block text-xs opacity-60">{r.views} views · {r.clicks} taps{r.with_commercial ? ` · ${r.commercials} commercial plays` : ""}</span>
                    </span>
                    {editable && (
                      <>
                        <select value={r.level} onChange={(e) => change(r, { level: e.target.value as SponsorLevel })} className="rounded-lg border px-1.5 py-1 text-xs" style={box} aria-label={`Level for ${r.name}`}>
                          {(Object.keys(LEVEL_LABEL) as SponsorLevel[]).map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
                        </select>
                        <input
                          defaultValue={r.amount_cents != null ? String(r.amount_cents / 100) : ""}
                          onBlur={(e) => { const c = toCents(e.target.value); if (c !== r.amount_cents) change(r, { amount_cents: c }); }}
                          inputMode="decimal" placeholder="$ amount" className="w-20 rounded-lg border px-2 py-1 text-xs" style={box} aria-label={`Amount from ${r.name}`}
                        />
                        <button type="button" onClick={() => setEditing(editing === r.placement_id ? null : r.placement_id)} className="text-xs font-semibold underline">{editing === r.placement_id ? "Close" : "Edit"}</button>
                        <button type="button" onClick={() => remove(r)} className="px-1 text-xs opacity-60" aria-label={`Remove ${r.name}`}>✕</button>
                      </>
                    )}
                  </div>
                  {editable && (
                    <label className="mt-2 flex items-center gap-2 text-xs">
                      <input type="checkbox" checked={r.with_commercial} disabled={!r.commercial_url} onChange={(e) => change(r, { with_commercial: e.target.checked })} />
                      <span>Include this sponsor&apos;s commercial{!r.commercial_url ? " (add one under Edit sponsor details)" : ""}</span>
                    </label>
                  )}
                  {editing === r.placement_id && (
                    <div className="mt-3 border-t pt-3" style={box}>
                      {r.can_edit ? (
                        <>
                          <p className="mb-2 text-xs opacity-70">Changes here update this sponsor everywhere it appears.</p>
                          <SponsorForm
                            sponsor={{ id: r.sponsor_id, name: r.name, logo_url: r.logo_url, link_url: r.link_url, commercial_url: r.commercial_url, commercial_kind: r.commercial_kind }}
                            onSaved={() => { setEditing(null); load(); }}
                            onCancel={() => setEditing(null)}
                          />
                        </>
                      ) : (
                        <p className="text-xs opacity-70">Only the person who added this sponsor can change its details.</p>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          {editable && rows.length < 12 && (
            <div className="flex flex-col gap-2 rounded-lg border p-3" style={box}>
              <p className="text-sm font-semibold">Add a sponsor</p>
              {!creating && (
                <>
                  <select className={input} style={box} value={pick} onChange={(e) => { setPick(e.target.value); setCommercial(false); }} aria-label="Sponsor from your library">
                    <option value="">{available.length ? "Pick from your sponsor library…" : "No other sponsors in your library yet"}</option>
                    {available.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                  {pick && (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <select className={input} style={box} value={level} onChange={(e) => setLevel(e.target.value as SponsorLevel)} aria-label="Sponsor level">
                          {(Object.keys(LEVEL_LABEL) as SponsorLevel[]).map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
                        </select>
                        <input className={input} style={box} placeholder="Amount ($, optional)" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
                      </div>
                      {chosen?.commercial_url && (
                        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={commercial} onChange={(e) => setCommercial(e.target.checked)} /> Include this sponsor&apos;s commercial</label>
                      )}
                      <button type="button" disabled={busy} onClick={() => assign(pick)} className="self-start rounded-full px-4 py-2 text-sm font-bold text-white disabled:opacity-60" style={{ background: "#1b4fe4" }}>{busy ? "Adding…" : "Add to this " + KIND_NAME[kind].toLowerCase()}</button>
                    </>
                  )}
                  <button type="button" onClick={() => setCreating(true)} className="self-start text-xs font-semibold underline">+ New sponsor</button>
                </>
              )}
              {creating && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <select className={input} style={box} value={level} onChange={(e) => setLevel(e.target.value as SponsorLevel)} aria-label="Sponsor level">
                      {(Object.keys(LEVEL_LABEL) as SponsorLevel[]).map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
                    </select>
                    <input className={input} style={box} placeholder="Amount ($, optional)" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
                  </div>
                  <SponsorForm
                    submitLabel={"Save and add to this " + KIND_NAME[kind].toLowerCase()}
                    onSaved={(s) => { setCommercial(!!s.commercial_url); assign(s.id); }}
                    onCancel={() => setCreating(false)}
                  />
                </>
              )}
            </div>
          )}
          {error && <p role="alert" className="mt-2 text-xs font-semibold" style={{ color: "var(--danger)" }}>{error}</p>}
        </div>
      )}
    </section>
  );
}
