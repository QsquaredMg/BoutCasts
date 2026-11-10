"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import SponsorForm from "@/components/SponsorForm";
import { KIND_NAME, LEVEL_LABEL, dollars, toCents, type LibrarySponsor, type SponsorKind, type SponsorLevel } from "@/lib/sponsors";

// Your sponsors, in one place: add and edit them, place them on trivia packs, live votes, brackets and bouts,
// and see views, taps and commercial plays for every placement.
type Report = {
  sponsor_id: string; placement_id: string; target_kind: SponsorKind; target_id: string; target_title: string | null;
  level: SponsorLevel; amount_cents: number | null; with_commercial: boolean; views: number; clicks: number; commercials: number;
};
type Item = { id: string; title: string };

const HREF: Record<SponsorKind, (id: string) => string> = {
  trivia: (id) => `/trivia/packs/${id}`,
  vote: (id) => `/live-vote/${id}`,
  bracket: (id) => `/predictions/slate/${id}`,
  game: (id) => `/predictions/${id}`,
  bout: (id) => `/bout/${id}`,
};

export default function SponsorLibrary() {
  const [sponsors, setSponsors] = useState<LibrarySponsor[]>([]);
  const [report, setReport] = useState<Report[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [missing, setMissing] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [placing, setPlacing] = useState<string | null>(null);

  const load = useCallback(async () => {
    const sb = createClient();
    const [{ data: lib, error }, { data: rep }, { data: u }] = await Promise.all([
      sb.from("sponsor_library").select("id,name,logo_url,link_url,commercial_url,commercial_kind").order("name"),
      sb.rpc("my_sponsor_report"),
      sb.auth.getUser(),
    ]);
    if (error) setMissing(true);
    setSponsors((lib ?? []) as LibrarySponsor[]);
    setReport(((rep ?? []) as Report[]).map((r) => ({ ...r, views: Number(r.views), clicks: Number(r.clicks), commercials: Number(r.commercials) })));
    if (u.user) {
      const { data: me } = await sb.from("profiles").select("is_admin").eq("id", u.user.id).maybeSingle();
      setIsAdmin(!!me?.is_admin);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function remove(s: LibrarySponsor) {
    if (!confirm(`Delete ${s.name}? It will be taken off everything it is placed on, and its counts go with it.`)) return;
    await createClient().from("sponsor_library").delete().eq("id", s.id);
    load();
  }

  if (!loaded) return <p className="text-sm opacity-70">Loading…</p>;
  if (missing) return <p className="text-sm">The sponsor library isn&apos;t switched on yet. Run the sponsor library SQL first.</p>;

  const box = { borderColor: "var(--border)" };
  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm opacity-80">{sponsors.length} {sponsors.length === 1 ? "sponsor" : "sponsors"}</p>
        {!adding && <button type="button" onClick={() => setAdding(true)} className="rounded-full px-4 py-2 text-sm font-bold text-white" style={{ background: "#1b4fe4" }}>+ New sponsor</button>}
      </div>
      {adding && (
        <div className="mb-5 rounded-2xl border p-4" style={box}>
          <h2 className="mb-2 font-bold">New sponsor</h2>
          <SponsorForm onSaved={() => { setAdding(false); load(); }} onCancel={() => setAdding(false)} />
        </div>
      )}
      {sponsors.length === 0 && !adding && (
        <p className="rounded-2xl border p-5 text-sm" style={box}>No sponsors yet. Add one, then place it on a trivia pack, live vote, bracket or bout.</p>
      )}
      <ul className="flex flex-col gap-4">
        {sponsors.map((s) => {
          const mine = report.filter((r) => r.sponsor_id === s.id);
          const t = mine.reduce((a, r) => ({ v: a.v + r.views, c: a.c + r.clicks, m: a.m + r.commercials, $: a.$ + (r.amount_cents ?? 0) }), { v: 0, c: 0, m: 0, $: 0 });
          return (
            <li key={s.id} className="rounded-2xl border p-4" style={box}>
              <div className="flex flex-wrap items-center gap-3">
                {s.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.logo_url} alt="" className="h-12 w-12 rounded object-contain" />
                ) : (
                  <span className="flex h-12 w-12 items-center justify-center rounded bg-black/10 font-bold">{s.name.slice(0, 1)}</span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{s.name}{s.commercial_url ? <span className="ml-2 rounded-full bg-black/10 px-2 py-0.5 text-[11px] font-semibold">Commercial</span> : null}</p>
                  <p className="text-xs opacity-70">
                    {mine.length} {mine.length === 1 ? "placement" : "placements"} · {t.v} views · {t.c} taps{s.commercial_url ? ` · ${t.m} commercial plays` : ""}{t.$ > 0 ? ` · ${dollars(t.$)}` : ""}
                  </p>
                </div>
                <button type="button" onClick={() => setPlacing(placing === s.id ? null : s.id)} className="text-sm font-semibold underline">Place</button>
                <button type="button" onClick={() => setEditing(editing === s.id ? null : s.id)} className="text-sm font-semibold underline">Edit</button>
                <button type="button" onClick={() => remove(s)} className="text-sm opacity-60" aria-label={`Delete ${s.name}`}>✕</button>
              </div>
              {editing === s.id && (
                <div className="mt-3 border-t pt-3" style={box}>
                  <SponsorForm sponsor={s} onSaved={() => { setEditing(null); load(); }} onCancel={() => setEditing(null)} />
                </div>
              )}
              {placing === s.id && (
                <PlaceForm sponsor={s} isAdmin={isAdmin} onDone={() => { setPlacing(null); load(); }} onCancel={() => setPlacing(null)} />
              )}
              {mine.length > 0 && (
                <ul className="mt-3 flex flex-col gap-1.5 border-t pt-3 text-sm" style={box}>
                  {mine.map((r) => (
                    <li key={r.placement_id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                      <span className="rounded-full bg-black/10 px-2 py-0.5 text-[11px] font-semibold">{KIND_NAME[r.target_kind]}</span>
                      <Link href={HREF[r.target_kind](r.target_id)} className="font-semibold underline">{r.target_title ?? "Untitled"}</Link>
                      <span className="text-xs opacity-70">{LEVEL_LABEL[r.level].split(" (")[0]}{r.amount_cents != null ? ` · ${dollars(r.amount_cents)}` : ""} · {r.views} views · {r.clicks} taps{r.with_commercial ? ` · ${r.commercials} plays` : ""}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// Place one sponsor on a trivia pack, live vote, bracket or bout.
function PlaceForm({ sponsor, isAdmin, onDone, onCancel }: { sponsor: LibrarySponsor; isAdmin: boolean; onDone: () => void; onCancel: () => void }) {
  const kinds: SponsorKind[] = isAdmin ? ["trivia", "vote", "bracket", "game", "bout"] : ["trivia", "vote", "bracket", "game"];
  const [kind, setKind] = useState<SponsorKind>("trivia");
  const [items, setItems] = useState<Item[]>([]);
  const [target, setTarget] = useState("");
  const [level, setLevel] = useState<SponsorLevel>("supporter");
  const [amount, setAmount] = useState("");
  const [commercial, setCommercial] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const sb = createClient();
      const { data: u } = await sb.auth.getUser();
      const me = u.user?.id ?? "";
      let rows: Item[] = [];
      if (kind === "trivia") {
        const { data } = await sb.from("trivia_packs").select("id,title").eq("owner_id", me).order("created_at", { ascending: false }).limit(100);
        rows = (data ?? []) as Item[];
      } else if (kind === "vote") {
        const { data } = await sb.from("live_vote_events").select("id,title").eq("organizer_id", me).neq("tier", "free").is("archived_at", null).order("created_at", { ascending: false }).limit(100);
        rows = (data ?? []) as Item[];
      } else if (kind === "bracket") {
        const { data } = await sb.from("pred_slates").select("id,title").eq("created_by", me).is("archived_at", null).order("created_at", { ascending: false }).limit(100);
        rows = (data ?? []) as Item[];
      } else if (kind === "game") {
        const { data } = await sb.from("pred_games").select("id,home_name,away_name").eq("created_by", me).order("created_at", { ascending: false }).limit(100);
        rows = ((data ?? []) as { id: string; home_name: string; away_name: string }[]).map((g) => ({ id: g.id, title: `${g.home_name} vs ${g.away_name}` }));
      } else {
        const { data } = await sb.from("bouts").select("id,title,competitor_a_name,competitor_b_name").is("deleted_at", null).order("created_at", { ascending: false }).limit(100);
        rows = ((data ?? []) as { id: string; title: string | null; competitor_a_name: string; competitor_b_name: string }[]).map((b) => ({ id: b.id, title: b.title || `${b.competitor_a_name} vs ${b.competitor_b_name}` }));
      }
      if (alive) { setItems(rows); setTarget(""); }
    })();
    return () => { alive = false; };
  }, [kind]);

  async function go() {
    setError(null);
    setBusy(true);
    const { error: err } = await createClient().rpc("assign_sponsor", {
      p_sponsor: sponsor.id, p_kind: kind, p_target: target, p_level: level, p_amount_cents: toCents(amount), p_commercial: commercial,
    });
    setBusy(false);
    if (err) return setError(err.message);
    onDone();
  }

  const box = { borderColor: "var(--border)" };
  const input = "w-full rounded-lg border px-3 py-2 text-sm";
  return (
    <div className="mt-3 flex flex-col gap-2 border-t pt-3" style={box}>
      <p className="text-sm font-semibold">Place {sponsor.name}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <select className={input} style={box} value={kind} onChange={(e) => setKind(e.target.value as SponsorKind)} aria-label="Where">
          {kinds.map((k) => <option key={k} value={k}>{KIND_NAME[k]}</option>)}
        </select>
        <select className={input} style={box} value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Which one">
          <option value="">{items.length ? "Pick one…" : kind === "vote" ? "Nothing paid yet" : "Nothing here yet"}</option>
          {items.map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}
        </select>
        <select className={input} style={box} value={level} onChange={(e) => setLevel(e.target.value as SponsorLevel)} aria-label="Level">
          {(Object.keys(LEVEL_LABEL) as SponsorLevel[]).map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
        </select>
        <input className={input} style={box} placeholder="Amount ($, optional)" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      {sponsor.commercial_url && (
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={commercial} onChange={(e) => setCommercial(e.target.checked)} /> Include the commercial</label>
      )}
      {error && <p role="alert" className="text-xs font-semibold" style={{ color: "var(--danger)" }}>{error}</p>}
      <div className="flex gap-2">
        <button type="button" disabled={busy || !target} onClick={go} className="rounded-full px-4 py-2 text-sm font-bold text-white disabled:opacity-60" style={{ background: "#1b4fe4" }}>{busy ? "Placing…" : "Place sponsor"}</button>
        <button type="button" onClick={onCancel} className="rounded-full border px-4 py-2 text-sm font-semibold" style={box}>Cancel</button>
      </div>
    </div>
  );
}
