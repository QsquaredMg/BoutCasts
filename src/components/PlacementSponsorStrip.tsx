"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { safeHttpUrl } from "@/lib/safeUrl";
import EmbeddedClipPlayer from "@/components/EmbeddedClipPlayer";
import TriviaSponsorBar from "@/components/trivia/TriviaSponsorBar";
import type { SponsorKind, SponsorLevel } from "@/lib/sponsors";

// Sponsors from the sponsor library on a live vote, bracket or bout page. "Presented by" for the title sponsor,
// a row for the rest, and the sponsor's commercial when the organizer included it. Views (once per visitor
// session), taps and commercial plays are counted for the organizer.
type Row = { sponsor_id: string; name: string; logo_url: string | null; link_url: string | null; level: SponsorLevel; commercial_url: string | null; commercial_kind: "video" | "image" | null };

export default function PlacementSponsorStrip({ kind, targetId, variant = "page" }: { kind: SponsorKind; targetId: string; variant?: "page" | "screen" }) {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    let alive = true;
    createClient()
      .rpc("get_sponsor_placements", { p_kind: kind, p_target: targetId })
      .then(({ data }) => {
        if (alive) setRows((data ?? []) as Row[]);
      });
    return () => { alive = false; };
  }, [kind, targetId]);

  const withAd = rows.find((r) => r.commercial_url);
  useEffect(() => {
    if (!withAd || variant === "screen") return;
    const key = `bc_sp_ad_${kind}_${targetId}_${withAd.sponsor_id}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // storage blocked: still count it
    }
    createClient().rpc("log_sponsor_event", { p_kind: "commercial", p_target_kind: kind, p_target: targetId, p_sponsor: withAd.sponsor_id }).then(() => {});
  }, [withAd, kind, targetId, variant]);

  if (rows.length === 0) return null;

  // Big screens use the pinned bar.
  if (variant === "screen")
    return (
      <TriviaSponsorBar
        variant="screen"
        trackKind={kind}
        targetId={targetId}
        sponsors={rows.map((r) => ({ id: r.sponsor_id, name: r.name, logo: r.logo_url, link: r.link_url, level: r.level }))}
      />
    );

  const tapped = (id: string) => createClient().rpc("log_sponsor_event", { p_kind: "click", p_target_kind: kind, p_target: targetId, p_sponsor: id }).then(() => {});
  const title = rows.find((r) => r.level === "title");
  const rest = rows.filter((r) => r !== title);
  const adUrl = withAd ? safeHttpUrl(withAd.commercial_url) : null;

  const tile = (s: Row, big: boolean) => {
    const inner = s.logo_url ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={s.logo_url} alt={s.name} className={big ? "h-14 max-w-[200px] object-contain" : s.level === "gold" ? "h-11 max-w-[140px] object-contain" : "h-9 max-w-[110px] object-contain"} />
    ) : (
      <span className={big ? "text-lg font-black" : "text-sm font-bold"}>{s.name}</span>
    );
    const cls = `flex items-center justify-center rounded-lg border px-3 ${big ? "h-20 min-w-[180px]" : s.level === "gold" ? "h-16 min-w-[110px]" : "h-14 min-w-[88px]"}`;
    const style = { borderColor: "var(--border)", background: "var(--surface)" };
    const href = safeHttpUrl(s.link_url);
    return href ? (
      <a key={s.sponsor_id} href={href} target="_blank" rel="sponsored noopener noreferrer" className={cls} style={style} title={s.name} onClick={() => tapped(s.sponsor_id)}>{inner}</a>
    ) : (
      <div key={s.sponsor_id} className={cls} style={style} title={s.name}>{inner}</div>
    );
  };

  return (
    <div className="mb-6 flex flex-col items-center gap-3">
      {title && (
        <div className="flex flex-col items-center">
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--text-faint)" }}>Presented by</p>
          {tile(title, true)}
        </div>
      )}
      {rest.length > 0 && (
        <div className="w-full">
          <p className="mb-2 text-center text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--text-faint)" }}>Thanks to our sponsors</p>
          <div className="flex flex-wrap items-center justify-center gap-2.5">{rest.map((s) => tile(s, false))}</div>
        </div>
      )}
      {withAd && adUrl && (
        <div className="w-full max-w-xl">
          <p className="mb-1.5 text-center text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--text-faint)" }}>A word from {withAd.name}</p>
          {withAd.commercial_kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={adUrl} alt={`${withAd.name} commercial`} className="mx-auto max-h-80 rounded-xl object-contain" />
          ) : (
            <EmbeddedClipPlayer sourceUrl={adUrl} label={`${withAd.name} commercial`} />
          )}
        </div>
      )}
    </div>
  );
}
