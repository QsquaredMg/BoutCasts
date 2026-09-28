"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// "Thanks to our sponsors" strip in an organizer's event room.
type Sponsor = { id: string; name: string; logo_url: string | null; link_url: string | null };

export default function EventSponsorStrip({ eventId }: { eventId: string }) {
  const supabase = createClient();
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);

  useEffect(() => {
    supabase
      .from("live_vote_sponsors")
      .select("id, name, logo_url, link_url")
      .eq("event_id", eventId)
      .order("sort_order")
      .then(({ data }) => setSponsors(data ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  if (sponsors.length === 0) return null;

  return (
    <div className="mb-4">
      <p className="mb-2 text-center text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--text-faint)" }}>
        Thanks to our sponsors
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2.5">
        {sponsors.map((s) => {
          const inner = s.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.logo_url} alt={s.name} className="h-10 max-w-[120px] object-contain" />
          ) : (
            <span className="text-sm font-bold">{s.name}</span>
          );
          const cls = "flex h-14 min-w-[88px] items-center justify-center rounded-lg border px-3";
          const style = { borderColor: "var(--border)", background: "var(--surface)" };
          return s.link_url ? (
            <a key={s.id} href={s.link_url} target="_blank" rel="sponsored noopener noreferrer" className={cls} style={style} title={s.name}>
              {inner}
            </a>
          ) : (
            <div key={s.id} className={cls} style={style} title={s.name}>
              {inner}
            </div>
          );
        })}
      </div>
    </div>
  );
}
