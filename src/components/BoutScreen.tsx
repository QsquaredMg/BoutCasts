"use client";

import { useEffect, useMemo, useState } from "react";
import ChromeOff from "@/components/ChromeOff";
import { createClient } from "@/lib/supabase/client";
import { renderBrandedQr, readableOn } from "@/lib/brandedQr";

export type BoutBrand = { name?: string; logo?: string; color?: string; bg?: string };
type Bout = { id: string; title: string; status: "upcoming" | "live" | "final"; competitor_a_name: string; competitor_b_name: string; closes_at: string | null };

// Big-screen / broadcast view for a head-to-head bout: live percentages, vote count and a scan-to-vote QR.
// overlay = transparent lower-third for broadcast software or a stadium board. view = "count" is just the big counter.
export default function BoutScreen({ boutId, overlay = false, view = "full", brand = {} }: { boutId: string; overlay?: boolean; view?: "full" | "count"; brand?: BoutBrand }) {
  const supabase = useMemo(() => createClient(), []);
  const [bout, setBout] = useState<Bout | null>(null);
  const [missing, setMissing] = useState(false);
  const [a, setA] = useState(0);
  const [b, setB] = useState(0);
  const [qr, setQr] = useState("");

  useEffect(() => {
    let alive = true;
    supabase.from("bouts").select("id, title, status, competitor_a_name, competitor_b_name, closes_at").eq("id", boutId).maybeSingle().then(({ data }) => {
      if (!alive) return;
      if (!data) setMissing(true);
      else setBout(data as Bout);
    });
    return () => { alive = false; };
  }, [supabase, boutId]);

  useEffect(() => {
    let alive = true;
    async function poll() {
      try {
        const [ra, rb, st] = await Promise.all([
          supabase.from("votes").select("id", { count: "exact", head: true }).eq("bout_id", boutId).eq("side", "a"),
          supabase.from("votes").select("id", { count: "exact", head: true }).eq("bout_id", boutId).eq("side", "b"),
          supabase.from("bouts").select("status").eq("id", boutId).maybeSingle(),
        ]);
        if (!alive) return;
        if (ra.count != null) setA(ra.count);
        if (rb.count != null) setB(rb.count);
        if (st.data) setBout((x) => (x ? { ...x, status: st.data!.status as Bout["status"] } : x));
      } catch {
        // keep the last numbers on screen
      }
    }
    poll();
    const t = setInterval(poll, 2000);
    return () => { alive = false; clearInterval(t); };
  }, [supabase, boutId]);

  const voteUrl = typeof window !== "undefined" ? `${window.location.origin}/bout/${boutId}` : "";
  const accent = brand.color || "#ffc531";
  const bg = brand.bg || "#0a0e1a";
  const fg = readableOn(bg);
  useEffect(() => {
    if (!voteUrl) return;
    renderBrandedQr(voteUrl, { color: brand.color ?? null, logoUrl: brand.logo ?? null, name: brand.name ?? null }, 900).then(setQr).catch(() => {});
  }, [voteUrl, brand.color, brand.logo, brand.name]);

  if (missing) return <div className="min-h-screen p-10 text-4xl font-black" style={{ background: "#0a0e1a", color: "#fff" }}>This bout isn&apos;t available.</div>;
  if (!bout) return <div className="min-h-screen" style={{ background: overlay ? "transparent" : "#0a0e1a" }} />;

  const total = a + b;
  const pa = total ? Math.round((a / total) * 100) : 50;
  const pb = total ? 100 - pa : 50;
  const final = bout.status === "final";
  const label = final ? "Final" : bout.status === "live" ? "Live" : "Voting opens soon";
  const logo = brand.logo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={brand.logo} alt="" className="h-16 object-contain" />
  ) : null;

  if (view === "count") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-8 text-center" style={{ background: overlay ? "transparent" : bg, color: fg }}>
<ChromeOff />
        {overlay && <style>{"html,body{background:transparent !important}"}</style>}
        <p className="text-3xl font-bold uppercase tracking-widest" style={{ color: accent }}>{bout.competitor_a_name} vs {bout.competitor_b_name}</p>
        <p className="mt-4 text-[10rem] font-black leading-none tabular-nums md:text-[16rem]" style={{ color: accent, textShadow: overlay ? "0 4px 24px rgba(0,0,0,.6)" : undefined }}>{total.toLocaleString()}</p>
        <p className="text-4xl font-bold">votes</p>
      </div>
    );
  }

  if (overlay) {
    return (
      <div className="flex min-h-screen w-full flex-col justify-end">
<ChromeOff />
        <style>{"html,body{background:transparent !important}"}</style>
        <div className="m-6 rounded-3xl px-8 py-5" style={{ background: "rgba(10,14,26,.88)", color: "#fff", borderLeft: `10px solid ${accent}` }}>
          <div className="flex items-center gap-6">
            {logo}
            <p className="flex-1 text-sm font-bold uppercase tracking-widest" style={{ color: accent }}>{label}{brand.name ? ` · ${brand.name}` : ""}</p>
            <p className="text-right"><span className="text-4xl font-black tabular-nums" style={{ color: accent }}>{total.toLocaleString()}</span> <span className="text-sm font-bold uppercase tracking-widest opacity-80">votes</span></p>
          </div>
          <div className="mt-2 flex items-center justify-between gap-6 text-4xl font-black">
            <span className="min-w-0 truncate">{bout.competitor_a_name} <span className="tabular-nums" style={{ color: accent }}>{pa}%</span></span>
            <span className="min-w-0 truncate text-right"><span className="tabular-nums" style={{ color: accent }}>{pb}%</span> {bout.competitor_b_name}</span>
          </div>
          <div className="mt-3 flex h-4 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,.2)" }}>
            <div className="h-full transition-all duration-700" style={{ width: `${pa}%`, background: accent }} />
          </div>
        </div>
      </div>
    );
  }

  const host = typeof window !== "undefined" ? window.location.host : "boutcasts.com";
  return (
    <div className="min-h-screen w-full p-8 md:p-12" style={{ background: bg, color: fg }}>
<ChromeOff />
      <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="text-center lg:text-left">
          {logo && <div className="mb-4 flex justify-center lg:justify-start">{logo}</div>}
          <p className="text-lg font-bold uppercase tracking-widest" style={{ color: accent }}>{label}</p>
          <h1 className="mt-2 text-5xl font-black leading-tight md:text-6xl">{bout.title || `${bout.competitor_a_name} vs ${bout.competitor_b_name}`}</h1>
          {!final && (
            <>
              <div className="mx-auto mt-6 w-full max-w-[420px] rounded-3xl bg-white p-4 lg:mx-0">
                {qr ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qr} alt="Scan to vote" className="w-full" />
                ) : (
                  <div className="aspect-square w-full" />
                )}
              </div>
              <p className="mt-4 text-2xl font-bold">Scan with your phone camera</p>
              <p className="text-xl opacity-80">or go to {host}/bout/{boutId.slice(0, 8)}…</p>
            </>
          )}
        </div>
        <div>
          <p className="mb-4 text-right text-4xl font-black tabular-nums" style={{ color: accent }}>{total.toLocaleString()} votes</p>
          <div className="flex items-end justify-between gap-6 text-4xl font-black md:text-5xl">
            {[{ n: bout.competitor_a_name, p: pa, c: a }, { n: bout.competitor_b_name, p: pb, c: b }].map((s) => (
              <div key={s.n} className="min-w-0 flex-1 text-center">
                <p className="truncate">{s.n}</p>
                <p className="mt-2 text-7xl tabular-nums md:text-9xl" style={{ color: accent }}>{s.p}%</p>
                <p className="text-2xl font-bold opacity-70">{s.c.toLocaleString()} votes</p>
              </div>
            ))}
          </div>
          <div className="mt-6 flex h-10 overflow-hidden rounded-full" style={{ background: "rgba(128,128,128,0.25)" }}>
            <div className="h-full transition-all duration-700" style={{ width: `${pa}%`, background: accent }} />
          </div>
        </div>
      </div>
    </div>
  );
}
