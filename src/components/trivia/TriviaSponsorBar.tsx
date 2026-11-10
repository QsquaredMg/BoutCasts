"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { safeHttpUrl } from "@/lib/safeUrl";
import type { TriviaSponsor } from "@/lib/trivia";

// Sponsors pinned to the bottom of a trivia screen. The title sponsor is "Presented by";
// everyone else sits beside it. On phones a logo links to the sponsor's site.
export default function TriviaSponsorBar({
  sponsors,
  variant,
  trackKind = "trivia",
  targetId,
  trackKey,
}: {
  sponsors: TriviaSponsor[];
  variant: "screen" | "phone";
  /** Where views and taps are counted (default: a trivia pack). */
  trackKind?: "trivia" | "vote" | "bracket" | "bout" | "game";
  targetId?: string;
  /** Distinguishes one counted view per browser session, e.g. the game code + role. */
  trackKey?: string;
}) {
  const big = variant === "screen";
  // One view per browser session for this screen.
  useEffect(() => {
    if (!targetId || sponsors.length === 0) return;
    const key = `bc_sp_view_${trackKind}_${trackKey ?? targetId}_${variant}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // storage blocked: still count it
    }
    createClient().rpc("log_sponsor_event", { p_kind: "view", p_target_kind: trackKind, p_target: targetId }).then(() => {});
  }, [targetId, sponsors.length, trackKind, trackKey, variant]);
  const tapped = (id?: string) => {
    if (targetId && id) createClient().rpc("log_sponsor_event", { p_kind: "click", p_target_kind: trackKind, p_target: targetId, p_sponsor: id }).then(() => {});
  };
  const title = sponsors.find((s) => s.level === "title");
  const rest = sponsors.filter((s) => s !== title);

  const tile = (s: TriviaSponsor, size: "title" | "gold" | "supporter") => {
    const h = big ? (size === "title" ? "h-24" : size === "gold" ? "h-16" : "h-12") : size === "title" ? "h-10" : "h-8";
    const inner = s.logo ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={s.logo} alt={s.name} className={`${h} max-w-[220px] object-contain`} />
    ) : (
      <span className={`${big ? "text-2xl" : "text-xs"} font-black`}>{s.name}</span>
    );
    const href = !big ? safeHttpUrl(s.link) : null;
    const cls = `flex shrink-0 items-center justify-center rounded-lg bg-white px-3 py-1.5 text-black ${big ? "" : ""}`;
    return href ? (
      <a key={s.name + s.level} href={href} target="_blank" rel="sponsored noopener noreferrer" className={cls} title={s.name} onClick={() => tapped(s.id)}>{inner}</a>
    ) : (
      <div key={s.name + s.level} className={cls} title={s.name}>{inner}</div>
    );
  };

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-20 flex items-center gap-4 overflow-hidden border-t border-white/15 bg-black/70 backdrop-blur ${big ? "px-10 py-4" : "px-3 py-2"}`}
      aria-label="Sponsors"
    >
      {title && (
        <div className="flex shrink-0 items-center gap-3">
          <span className={`${big ? "text-lg" : "text-[10px]"} font-bold uppercase leading-tight tracking-widest text-white/70`}>Presented<br />by</span>
          {tile(title, "title")}
        </div>
      )}
      {rest.length > 0 && (
        <div className="flex min-w-0 flex-1 items-center gap-3 overflow-x-auto">
          {!title && <span className={`${big ? "text-lg" : "text-[10px]"} shrink-0 font-bold uppercase tracking-widest text-white/70`}>Sponsors</span>}
          {rest.map((s) => tile(s, s.level === "gold" ? "gold" : "supporter"))}
        </div>
      )}
    </div>
  );
}
