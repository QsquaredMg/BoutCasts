"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { renderBrandedQr, readableOn } from "@/lib/brandedQr";
import ChromeOff from "@/components/ChromeOff";

export type ContestBrand = { name?: string; logo?: string; color?: string; bg?: string };
type Row = { key: string; name: string; sub?: string | null; crowd: number | null; judge: number | null };
type Info = { title: string; label: string; mode: "crowd" | "judges" | "both"; weight: number; hidden: boolean; closed: boolean; total: number; rows: Row[]; voteUrl: string };

// Big-screen / broadcast view for Showcases (video + judges + crowd) and Debate matches.
// Crowd numbers follow the same hide-tally rule as the voting page, and judge scores appear only once results are final.
export default function ContestScreen({ kind, id, overlay = false, view = "full", brand = {} }: { kind: "showcase" | "debate"; id: string; overlay?: boolean; view?: "full" | "count"; brand?: ContestBrand }) {
  const supabase = useMemo(() => createClient(), []);
  const [info, setInfo] = useState<Info | null>(null);
  const [missing, setMissing] = useState(false);
  const [qr, setQr] = useState("");

  useEffect(() => {
    let alive = true;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    async function load() {
      try {
        if (kind === "showcase") {
          const [{ data: s }, { data: cs }, { data: st }] = await Promise.all([
            supabase.from("showcases").select("title, scoring_mode, crowd_weight, hide_tally, status").eq("id", id).maybeSingle(),
            supabase.from("showcase_choices").select("id, name, team_name, judge_score, sort_order").eq("showcase_id", id).order("sort_order"),
            supabase.rpc("get_showcase_state", { p_showcase_id: id, p_guest_token: null }),
          ]);
          if (!alive) return;
          if (!s) return setMissing(true);
          const closed = s.status === "closed";
          const counts = (st as { counts: Record<string, number> | null; total: number } | null)?.counts ?? null;
          setInfo({
            title: s.title, label: closed ? "Final results" : s.status === "live" ? "Live" : "Voting opens soon",
            mode: s.scoring_mode, weight: s.crowd_weight, hidden: counts == null, closed,
            total: (st as { total?: number } | null)?.total ?? 0, voteUrl: `${origin}/showcase/${id}`,
            rows: (cs ?? []).map((c) => ({ key: c.id, name: c.name, sub: c.team_name, crowd: counts ? counts[c.id] ?? 0 : null, judge: closed ? c.judge_score : null })),
          });
        } else {
          const { data: m } = await supabase.from("debate_matches").select("*").eq("id", id).maybeSingle();
          if (!m) return alive ? setMissing(true) : undefined;
          const ids = [m.for_user_id, m.against_user_id].filter(Boolean) as string[];
          const [{ data: t }, { data: ps }, { data: vs }] = await Promise.all([
            supabase.from("debate_topics").select("statement, scoring_mode, crowd_weight, hide_tally").eq("id", m.topic_id).maybeSingle(),
            ids.length ? supabase.from("profiles").select("id, username").in("id", ids) : Promise.resolve({ data: [] as { id: string; username: string | null }[] }),
            supabase.rpc("get_debate_vote_state", { p_match_id: id, p_guest_token: null }),
          ]);
          if (!alive || !t) return;
          const nm = Object.fromEntries((ps ?? []).map((p) => [p.id, p.username ?? "Debater"]));
          const v = vs as { total: number; for: number | null; against: number | null } | null;
          const final = m.status === "final";
          setInfo({
            title: t.statement, label: final ? "Final results" : m.status === "voting" ? "Vote now" : m.status === "active" ? "Debate in progress" : "Coming up",
            mode: t.scoring_mode, weight: t.crowd_weight, hidden: v?.for == null, closed: final, total: v?.total ?? 0,
            voteUrl: `${origin}/debates/match/${id}`,
            rows: [
              { key: "for", name: m.for_user_id ? nm[m.for_user_id] ?? "Debater" : "TBD", sub: "For", crowd: v?.for ?? null, judge: final ? m.judge_for : null },
              { key: "against", name: m.against_user_id ? nm[m.against_user_id] ?? "Debater" : "TBD", sub: "Against", crowd: v?.against ?? null, judge: final ? m.judge_against : null },
            ],
          });
        }
      } catch {
        // keep the last numbers on screen
      }
    }
    load();
    const t = setInterval(load, 4000);
    return () => { alive = false; clearInterval(t); };
  }, [supabase, kind, id]);

  const accent = brand.color || "#ffc531";
  const bg = brand.bg || "#0a0e1a";
  const fg = readableOn(bg);
  const voteUrl = info?.voteUrl ?? "";
  useEffect(() => {
    if (!voteUrl) return;
    renderBrandedQr(voteUrl, { color: brand.color ?? null, logoUrl: brand.logo ?? null, name: brand.name ?? null }, 900).then(setQr).catch(() => {});
  }, [voteUrl, brand.color, brand.logo, brand.name]);

  if (missing) return <div className="min-h-screen p-10 text-4xl font-black" style={{ background: "#0a0e1a", color: "#fff" }}><ChromeOff />This isn&apos;t available.</div>;
  if (!info) return <div className="min-h-screen" style={{ background: overlay ? "transparent" : "#0a0e1a" }}><ChromeOff /></div>;

  const showCrowd = info.mode !== "judges";
  const showJudge = info.mode !== "crowd" && info.closed;
  const crowdTotal = info.rows.reduce((n, r) => n + (r.crowd ?? 0), 0);
  const pct = (r: Row) => (r.crowd != null && crowdTotal ? Math.round((r.crowd / crowdTotal) * 100) : null);
  const logo = brand.logo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={brand.logo} alt="" className="h-16 object-contain" />
  ) : null;
  const rows = [...info.rows];
  const countLabel = info.mode === "judges" ? "judges decide" : "votes";

  if (view === "count") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-8 text-center" style={{ background: overlay ? "transparent" : bg, color: fg }}>
        <ChromeOff />
        {overlay && <style>{"html,body{background:transparent !important}"}</style>}
        <p className="max-w-5xl text-3xl font-bold uppercase tracking-widest" style={{ color: accent }}>{info.title}</p>
        <p className="mt-4 text-[10rem] font-black leading-none tabular-nums md:text-[16rem]" style={{ color: accent, textShadow: overlay ? "0 4px 24px rgba(0,0,0,.6)" : undefined }}>{info.mode === "judges" ? "—" : info.total.toLocaleString()}</p>
        <p className="text-4xl font-bold">{countLabel}</p>
      </div>
    );
  }

  const Rowline = ({ r, big }: { r: Row; big?: boolean }) => (
    <div className={`flex items-center justify-between gap-6 ${big ? "text-4xl md:text-5xl" : "text-3xl"} font-black`}>
      <span className="min-w-0 truncate">{r.name}{r.sub ? <span className="ml-3 text-xl font-bold opacity-70">{r.sub}</span> : null}</span>
      <span className="flex shrink-0 items-baseline gap-6 tabular-nums" style={{ color: accent }}>
        {showCrowd && (info.hidden ? <span className="text-xl font-bold opacity-80">Tally hidden</span> : <span>{pct(r) ?? 0}% <span className="text-xl font-bold opacity-70">{(r.crowd ?? 0).toLocaleString()}</span></span>)}
        {showJudge && r.judge != null && <span>Judges {r.judge}<span className="text-xl font-bold opacity-70">/40</span></span>}
      </span>
    </div>
  );

  if (overlay) {
    return (
      <div className="flex min-h-screen w-full flex-col justify-end">
        <ChromeOff />
        <style>{"html,body{background:transparent !important}"}</style>
        <div className="m-6 rounded-3xl px-8 py-5" style={{ background: "rgba(10,14,26,.88)", color: "#fff", borderLeft: `10px solid ${accent}` }}>
          <div className="flex items-center gap-6">
            {logo}
            <p className="min-w-0 flex-1 truncate text-sm font-bold uppercase tracking-widest" style={{ color: accent }}>{info.label}{brand.name ? ` · ${brand.name}` : ""} · {info.title}</p>
            {info.mode !== "judges" && <p className="text-right"><span className="text-4xl font-black tabular-nums" style={{ color: accent }}>{info.total.toLocaleString()}</span> <span className="text-sm font-bold uppercase tracking-widest opacity-80">votes</span></p>}
          </div>
          <div className="mt-2 space-y-1">{rows.map((r) => <Rowline key={r.key} r={r} />)}</div>
        </div>
      </div>
    );
  }

  const host = typeof window !== "undefined" ? window.location.host : "boutcasts.com";
  return (
    <div className="min-h-screen w-full p-8 md:p-12" style={{ background: bg, color: fg }}>
      <ChromeOff />
      <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="text-center lg:text-left">
          {logo && <div className="mb-4 flex justify-center lg:justify-start">{logo}</div>}
          <p className="text-lg font-bold uppercase tracking-widest" style={{ color: accent }}>{info.label}{brand.name ? ` · ${brand.name}` : ""}</p>
          <h1 className="mt-2 text-4xl font-black leading-tight md:text-5xl">{info.title}</h1>
          {!info.closed && (
            <>
              <div className="mx-auto mt-6 w-full max-w-[360px] rounded-3xl bg-white p-4 lg:mx-0">
                {qr ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qr} alt="Scan to vote" className="w-full" />
                ) : <div className="aspect-square w-full" />}
              </div>
              <p className="mt-4 text-2xl font-bold">Scan to vote</p>
              <p className="text-lg opacity-80">{host}</p>
            </>
          )}
        </div>
        <div className="space-y-6">
          {info.mode !== "judges" && <p className="text-right text-4xl font-black tabular-nums" style={{ color: accent }}>{info.total.toLocaleString()} votes</p>}
          {info.mode === "both" && <p className="text-right text-lg font-bold opacity-70">Crowd {info.weight}% · Judges {100 - info.weight}%</p>}
          {info.mode !== "crowd" && !info.closed && <p className="text-right text-lg font-bold opacity-70">Judges&apos; scores are revealed when voting closes</p>}
          {rows.map((r) => (
            <div key={r.key}>
              <Rowline r={r} big />
              {showCrowd && !info.hidden && (
                <div className="mt-2 h-5 overflow-hidden rounded-full" style={{ background: "rgba(128,128,128,0.25)" }}>
                  <div className="h-full transition-all duration-700" style={{ width: `${pct(r) ?? 0}%`, background: accent }} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
