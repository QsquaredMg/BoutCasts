"use client";

import { useEffect, useState } from "react";
import { createEventClient } from "@/lib/supabase/client";
import { safeHttpUrl } from "@/lib/safeUrl";

// Sponsors on an organizer's voting page: the title sponsor as "Presented by"
// up top, everyone else in a "Thanks to our sponsors" row. Each page view and
// logo click is counted for the organizer's sponsor report.
type Sponsor = { id: string; name: string; logo_url: string | null; link_url: string | null; level: "title" | "gold" | "supporter" };

const RANK = { title: 0, gold: 1, supporter: 2 } as const;

export default function EventSponsorStrip({ eventId }: { eventId: string }) {
  const [supabase] = useState(() => createEventClient(eventId));
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);

  useEffect(() => {
    supabase
      .from("live_vote_sponsors")
      .select("id, name, logo_url, link_url, level")
      .eq("event_id", eventId)
      .order("sort_order")
      .then(({ data }) => {
        const rows = ((data ?? []) as Sponsor[]).sort((a, b) => RANK[a.level] - RANK[b.level]);
        setSponsors(rows);
        if (rows.length === 0) return;
        // One view per browser session per event.
        const key = `bc_sponsor_view_${eventId}`;
        try {
          if (sessionStorage.getItem(key)) return;
          sessionStorage.setItem(key, "1");
        } catch {
          // storage blocked — still count it
        }
        supabase.rpc("log_event_sponsor", { p_event_id: eventId, p_kind: "view" }).then(() => {});
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  if (sponsors.length === 0) return null;

  function clicked(id: string) {
    supabase.rpc("log_event_sponsor", { p_event_id: eventId, p_kind: "click", p_sponsor_id: id }).then(() => {});
  }

  const title = sponsors.find((s) => s.level === "title");
  const rest = sponsors.filter((s) => s !== title);

  const tile = (s: Sponsor, big: boolean) => {
    const inner = s.logo_url ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={s.logo_url} alt={s.name} className={big ? "h-14 max-w-[200px] object-contain" : s.level === "gold" ? "h-11 max-w-[140px] object-contain" : "h-9 max-w-[110px] object-contain"} />
    ) : (
      <span className={big ? "text-lg font-black" : "text-sm font-bold"}>{s.name}</span>
    );
    const cls = `flex items-center justify-center rounded-lg border px-3 ${big ? "h-20 min-w-[180px]" : s.level === "gold" ? "h-16 min-w-[110px]" : "h-14 min-w-[88px]"}`;
    const style = { borderColor: "var(--border)", background: "var(--surface)" };
    return s.link_url ? (
      <a key={s.id} href={safeHttpUrl(s.link_url) ?? undefined} target="_blank" rel="sponsored noopener noreferrer" className={cls} style={style} title={s.name} onClick={() => clicked(s.id)}>
        {inner}
      </a>
    ) : (
      <div key={s.id} className={cls} style={style} title={s.name}>
        {inner}
      </div>
    );
  };

  return (
    <div className="mb-4 flex flex-col items-center gap-3">
      {title && (
        <div className="flex flex-col items-center">
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--text-faint)" }}>
            Presented by
          </p>
          {tile(title, true)}
        </div>
      )}
      {rest.length > 0 && (
        <div className="w-full">
          <p className="mb-2 text-center text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--text-faint)" }}>
            Thanks to our sponsors
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2.5">{rest.map((s) => tile(s, false))}</div>
        </div>
      )}
    </div>
  );
}
