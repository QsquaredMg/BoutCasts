"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Sponsors on a bracket page: the title sponsor as "Presented by", the rest in a row.
// Page views (once per browser session) and logo clicks are counted for the organizer.
type Sponsor = { id: string; name: string; logo_url: string | null; link_url: string | null; level: "title" | "gold" | "supporter" };

export default function PredSponsorStrip({ bracketId }: { bracketId: string }) {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);

  useEffect(() => {
    const sb = createClient();
    sb.rpc("get_pred_sponsors", { p_bracket: bracketId }).then(({ data }) => {
      const rows = (data ?? []) as Sponsor[];
      setSponsors(rows);
      if (rows.length === 0) return;
      const key = `bc_pred_sponsor_view_${bracketId}`;
      try {
        if (sessionStorage.getItem(key)) return;
        sessionStorage.setItem(key, "1");
      } catch {
        // storage blocked: still count it
      }
      sb.rpc("log_pred_sponsor", { p_bracket: bracketId, p_kind: "view" }).then(() => {});
    });
  }, [bracketId]);

  if (sponsors.length === 0) return null;
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
      <a key={s.id} href={s.link_url} target="_blank" rel="sponsored noopener noreferrer" className={cls} style={style} title={s.name} onClick={() => createClient().rpc("log_pred_sponsor", { p_bracket: bracketId, p_kind: "click", p_sponsor: s.id }).then(() => {})}>
        {inner}
      </a>
    ) : (
      <div key={s.id} className={cls} style={style} title={s.name}>{inner}</div>
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
    </div>
  );
}
