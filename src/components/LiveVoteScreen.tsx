"use client";

import { useEffect, useMemo, useState } from "react";
import ChromeOff from "@/components/ChromeOff";
import { createClient } from "@/lib/supabase/client";
import { renderBrandedQr, readableOn, type QrBrand } from "@/lib/brandedQr";

type Ev = {
  id: string; title: string; status: "draft" | "live" | "closed"; closes_at: string | null; tier: string | null;
  scoring_mode: "crowd" | "judges"; voting_method: "single" | "ranked"; is_private: boolean;
  brand_name: string | null; brand_logo_url: string | null; brand_color: string | null; brand_bg_color: string | null;
  brand_bg_image_url: string | null; screen_bg_opacity?: number;
};
type Opt = { id: string; name: string };

// Projector / jumbotron view for a Live Vote: scan-to-vote QR on one side, live bars on the other.
type Judged = { released: boolean; judges_total?: number; judges_submitted?: number; results?: { option_id: string; name: string; average: number | null; judges_scored: number }[] };

// ?overlay=1 gives a transparent lower-third for broadcast software (OBS, vMix) or a stadium video board.
// ?view=count gives just the big live vote counter.
export default function LiveVoteScreen({ eventId, overlay = false, view = "full" }: { eventId: string; overlay?: boolean; view?: "full" | "count" }) {
  const supabase = useMemo(() => createClient(), []);
  const [ev, setEv] = useState<Ev | null>(null);
  const [opts, setOpts] = useState<Opt[]>([]);
  const [tally, setTally] = useState<Record<string, number>>({});
  const [missing, setMissing] = useState(false);
  const [qr, setQr] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [judged, setJudged] = useState<Judged | null>(null);

  useEffect(() => {
    let alive = true;
    async function loadEvent() {
      const { data } = await supabase
        .from("live_vote_events")
        .select("id, title, status, closes_at, tier, scoring_mode, voting_method, is_private, brand_name, brand_logo_url, brand_color, brand_bg_color, brand_bg_image_url")
        .eq("id", eventId)
        .maybeSingle();
      if (!alive) return;
      if (!data) return setMissing(true);
      setEv(data as Ev);
      // Separate read so the screen still works before the screen-look SQL has been run.
      const { data: look, error: lookErr } = await supabase.from("live_vote_events").select("screen_bg_opacity").eq("id", eventId).maybeSingle();
      if (alive && !lookErr && typeof look?.screen_bg_opacity === "number") setEv((e) => (e ? { ...e, screen_bg_opacity: look.screen_bg_opacity } : e));
      const { data: o } = await supabase.from("live_vote_options").select("id, name, sort_order").eq("event_id", eventId).order("sort_order");
      if (alive) setOpts((o ?? []) as Opt[]);
    }
    loadEvent();
    return () => { alive = false; };
  }, [supabase, eventId]);

  const showBars = !!ev && ev.scoring_mode === "crowd" && ev.voting_method === "single" && ev.status !== "draft";

  useEffect(() => {
    if (!showBars || !ev) return;
    let alive = true;
    const bigPublic = !ev.is_private && ev.tier !== "free" && ev.tier !== "small";
    async function poll() {
      try {
        if (bigPublic) {
          const r = await fetch(`/api/live-vote/${eventId}/tally`);
          if (r.ok) {
            const j = (await r.json()) as { status: Ev["status"]; tally: { option_id: string; votes: number }[] };
            if (alive) {
              setTally(Object.fromEntries(j.tally.map((t) => [t.option_id, t.votes])));
              setEv((e) => (e ? { ...e, status: j.status } : e));
            }
            return;
          }
        }
        const { data } = await supabase.rpc("get_live_vote_tally", { p_event_id: eventId });
        if (alive) setTally(Object.fromEntries(((data ?? []) as { option_id: string; votes: number | string }[]).map((r) => [r.option_id, Number(r.votes)])));
      } catch {
        // keep the last numbers on screen
      }
    }
    poll();
    const t = setInterval(poll, 2000);
    return () => { alive = false; clearInterval(t); };
  }, [showBars, ev, eventId, supabase]);

  // Judges scoreboard: the server only returns scores once the organizer has released them.
  useEffect(() => {
    if (!ev || ev.scoring_mode !== "judges" || ev.status === "draft") return;
    let alive = true;
    async function poll() {
      const { data } = await supabase.rpc("get_judged_results", { p_event_id: eventId });
      if (alive && data) setJudged(data as Judged);
    }
    poll();
    const t = setInterval(poll, 5000);
    return () => { alive = false; clearInterval(t); };
  }, [ev, eventId, supabase]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const voteUrl = typeof window !== "undefined" ? `${window.location.origin}/vote/${eventId}` : "";
  const brand = useMemo<QrBrand | undefined>(() => (ev && ev.tier && ev.tier !== "free" ? { color: ev.brand_color, logoUrl: ev.brand_logo_url, name: ev.brand_name } : undefined), [ev]);
  useEffect(() => {
    if (!voteUrl) return;
    renderBrandedQr(voteUrl, brand, 900).then(setQr).catch(() => {});
  }, [voteUrl, brand]);

  const paid = ev && ev.tier && ev.tier !== "free";
  const accent = (paid && ev?.brand_color) || "#ffc531";
  const bg = (paid && ev?.brand_bg_color) || "#0a0e1a";
  const fg = readableOn(bg);
  const shell = "min-h-screen w-full p-8 md:p-12";

  if (missing) return <div className={shell} style={{ background: "#0a0e1a", color: "#fff" }}><p className="text-4xl font-black">This vote isn&apos;t available.</p></div>;
  if (!ev) return <div className={shell} style={{ background: "#0a0e1a" }} />;

  const total = opts.reduce((n, o) => n + (tally[o.id] ?? 0), 0);
  const closed = ev.status === "closed" || (ev.closes_at != null && new Date(ev.closes_at).getTime() <= now);
  const left = ev.closes_at && !closed ? Math.max(0, Math.floor((new Date(ev.closes_at).getTime() - now) / 1000)) : null;
  const clock = left == null ? null : left >= 3600 ? `${Math.floor(left / 3600)}h ${Math.floor((left % 3600) / 60)}m left` : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")} left`;
  const host = typeof window !== "undefined" ? window.location.host : "boutcasts.com";
  const sorted = [...opts].sort((a, b) => (tally[b.id] ?? 0) - (tally[a.id] ?? 0));

  const judgeRows = judged?.released ? [...(judged.results ?? [])].sort((a, b) => (b.average ?? 0) - (a.average ?? 0)) : [];
  const countLabel = ev.scoring_mode === "judges" ? null : total.toLocaleString();
  const label = closed ? "Final" : "Live";

  if (overlay || view === "count") {
    const transparent = overlay;
    return (
      <div className="flex min-h-screen w-full flex-col justify-end" style={{ background: transparent ? "transparent" : bg, color: fg }}>
<ChromeOff />
        {transparent && <style>{"html,body{background:transparent !important}"}</style>}
        {view === "count" ? (
          <div className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
            {paid && ev.brand_logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={ev.brand_logo_url} alt="" className="mb-6 h-24 object-contain" />
            )}
            <p className="text-3xl font-bold uppercase tracking-widest" style={{ color: accent }}>{ev.title}</p>
            <p className="mt-4 text-[10rem] font-black leading-none tabular-nums md:text-[16rem]" style={{ color: accent, textShadow: transparent ? "0 4px 24px rgba(0,0,0,.6)" : undefined }}>{countLabel ?? "—"}</p>
            <p className="text-4xl font-bold">{countLabel ? "votes" : "Judges are scoring"}</p>
          </div>
        ) : (
          <div className="m-6 flex items-center gap-6 rounded-3xl px-8 py-5" style={{ background: "rgba(10,14,26,.88)", color: "#fff", borderLeft: `10px solid ${accent}` }}>
            {paid && ev.brand_logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={ev.brand_logo_url} alt="" className="h-16 object-contain" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold uppercase tracking-widest" style={{ color: accent }}>{label} · {ev.title}</p>
              {showBars ? (
                <div className="mt-1 flex flex-wrap items-baseline gap-x-8 gap-y-1">
                  {sorted.slice(0, 4).map((o) => {
                    const n = tally[o.id] ?? 0;
                    return <span key={o.id} className="text-3xl font-black"><span className="truncate">{o.name}</span> <span className="tabular-nums" style={{ color: accent }}>{total ? Math.round((n / total) * 100) : 0}%</span></span>;
                  })}
                </div>
              ) : judgeRows.length > 0 ? (
                <div className="mt-1 flex flex-wrap items-baseline gap-x-8 gap-y-1">
                  {judgeRows.slice(0, 4).map((r) => <span key={r.option_id} className="text-3xl font-black">{r.name} <span className="tabular-nums" style={{ color: accent }}>{r.average ?? "—"}</span></span>)}
                </div>
              ) : (
                <p className="mt-1 text-2xl font-bold">{ev.scoring_mode === "judges" ? "Judges are scoring" : "Voting is open"}</p>
              )}
            </div>
            {countLabel && (
              <div className="text-right">
                <p className="text-5xl font-black leading-none tabular-nums" style={{ color: accent }}>{countLabel}</p>
                <p className="text-sm font-bold uppercase tracking-widest opacity-80">votes</p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`${shell} relative`} style={{ background: bg, color: fg }}>
<ChromeOff />
      {paid && ev.brand_bg_image_url && (
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ backgroundImage: `url(${ev.brand_bg_image_url})`, backgroundSize: "cover", backgroundPosition: "center", opacity: (ev.screen_bg_opacity ?? 100) / 100 }} />
      )}
      <div className="relative mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="text-center lg:text-left">
          {ev.brand_logo_url && paid && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ev.brand_logo_url} alt="" className="mx-auto mb-4 h-20 object-contain lg:mx-0" />
          )}
          <p className="text-lg font-bold uppercase tracking-widest" style={{ color: accent }}>{closed ? "Voting closed" : ev.status === "draft" ? "Voting opens soon" : "Vote now"}</p>
          <h1 className="mt-2 text-5xl font-black leading-tight md:text-6xl">{ev.title}</h1>
          {!closed && (
            <>
              <div className="mx-auto mt-6 w-full max-w-[460px] rounded-3xl bg-white p-4 lg:mx-0">
                {qr ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qr} alt="Scan to vote" className="w-full" />
                ) : (
                  <div className="aspect-square w-full" />
                )}
              </div>
              <p className="mt-4 text-2xl font-bold">Scan with your phone camera</p>
              <p className="text-xl opacity-80">or go to {host}/vote/{eventId.slice(0, 8)}…</p>
            </>
          )}
          {clock && <p className="mt-4 text-3xl font-black tabular-nums" style={{ color: accent }}>{clock}</p>}
        </div>

        <div>
          {showBars ? (
            <>
              <div className="mb-4 flex items-end justify-between">
                <p className="text-2xl font-bold opacity-80">Live results</p>
                <p className="text-4xl font-black tabular-nums" style={{ color: accent }}>{total.toLocaleString()} votes</p>
              </div>
              {opts.length === 2 ? (
                <div>
                  <div className="flex items-end justify-between gap-6 text-4xl font-black md:text-5xl">
                    {opts.map((o) => {
                      const n = tally[o.id] ?? 0;
                      const pct = total ? Math.round((n / total) * 100) : 0;
                      return (
                        <div key={o.id} className="min-w-0 flex-1 text-center">
<ChromeOff />
                          <p className="truncate">{o.name}</p>
                          <p className="mt-2 text-7xl tabular-nums md:text-8xl" style={{ color: accent }}>{pct}%</p>
                          <p className="text-2xl font-bold opacity-70">{n.toLocaleString()} votes</p>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-6 flex h-10 overflow-hidden rounded-full" style={{ background: "rgba(128,128,128,0.25)" }}>
                    {(() => {
                      const a = opts[0];
                      const na = tally[a.id] ?? 0;
                      const share = total ? (na / total) * 100 : 50;
                      return <div className="h-full transition-all duration-700" style={{ width: `${share}%`, background: accent }} />;
                    })()}
                  </div>
                </div>
              ) : (
              <ol className="space-y-4">
                {sorted.slice(0, 8).map((o, i) => {
                  const n = tally[o.id] ?? 0;
                  const pct = total ? Math.round((n / total) * 100) : 0;
                  return (
                    <li key={o.id}>
                      <div className="flex items-baseline justify-between gap-4 text-3xl font-bold">
                        <span className="truncate">{i + 1}. {o.name}</span>
                        <span className="tabular-nums">{pct}%</span>
                      </div>
                      <div className="mt-1 h-6 overflow-hidden rounded-full" style={{ background: "rgba(128,128,128,0.25)" }}>
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: accent }} />
                      </div>
                    </li>
                  );
                })}
              </ol>
              )}
            </>
          ) : judgeRows.length > 0 ? (
            <>
              <div className="mb-4 flex items-end justify-between">
                <p className="text-2xl font-bold opacity-80">Judges&apos; scores</p>
                {judged?.judges_total ? <p className="text-2xl font-bold tabular-nums opacity-80">{judged.judges_submitted ?? 0}/{judged.judges_total} judges</p> : null}
              </div>
              <ol className="space-y-4">
                {judgeRows.slice(0, 8).map((r, i) => (
                  <li key={r.option_id} className="flex items-baseline justify-between gap-4 text-4xl font-black">
                    <span className="truncate">{i + 1}. {r.name}</span>
                    <span className="tabular-nums" style={{ color: accent }}>{r.average ?? "—"}</span>
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <p className="text-3xl font-bold opacity-80">
              {closed ? "Thanks for voting! Results will be shared soon." : ev.scoring_mode === "judges" ? "Judges are scoring. Results appear when voting ends." : "Cast your vote on your phone. Results appear when voting ends."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
