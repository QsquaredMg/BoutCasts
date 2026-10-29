"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { renderBrandedQr, readableOn, type QrBrand } from "@/lib/brandedQr";

type Ev = {
  id: string; title: string; status: "draft" | "live" | "closed"; closes_at: string | null; tier: string | null;
  scoring_mode: "crowd" | "judges"; voting_method: "single" | "ranked"; is_private: boolean;
  brand_name: string | null; brand_logo_url: string | null; brand_color: string | null; brand_bg_color: string | null;
};
type Opt = { id: string; name: string };

// Projector / jumbotron view for a Live Vote: scan-to-vote QR on one side, live bars on the other.
export default function LiveVoteScreen({ eventId }: { eventId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [ev, setEv] = useState<Ev | null>(null);
  const [opts, setOpts] = useState<Opt[]>([]);
  const [tally, setTally] = useState<Record<string, number>>({});
  const [missing, setMissing] = useState(false);
  const [qr, setQr] = useState("");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let alive = true;
    async function loadEvent() {
      const { data } = await supabase
        .from("live_vote_events")
        .select("id, title, status, closes_at, tier, scoring_mode, voting_method, is_private, brand_name, brand_logo_url, brand_color, brand_bg_color")
        .eq("id", eventId)
        .maybeSingle();
      if (!alive) return;
      if (!data) return setMissing(true);
      setEv(data as Ev);
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
    const t = setInterval(poll, 4000);
    return () => { alive = false; clearInterval(t); };
  }, [showBars, ev, eventId, supabase]);

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

  return (
    <div className={shell} style={{ background: bg, color: fg }}>
      <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
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
