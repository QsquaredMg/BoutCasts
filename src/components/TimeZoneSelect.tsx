"use client";

import { useMemo } from "react";
import { useZone, setZone } from "@/lib/time/pref";
import { ZONES, deviceZone, zoneName } from "@/lib/time/zones";

/** One shared "My time zone" control. Choosing here changes every time you type or read on the site. */
export default function TimeZoneSelect({ id, className, style, label = "Time zone" }: { id?: string; className?: string; style?: React.CSSProperties; label?: string }) {
  const zone = useZone();
  const device = useMemo(() => deviceZone(), []);
  const options = useMemo(() => {
    const list = ZONES.map((z) => ({ id: z.id, text: `${z.label} (${z.abbr})` }));
    for (const extra of new Set([device, zone])) {
      if (!list.some((o) => o.id === extra)) list.unshift({ id: extra, text: extra.replace(/_/g, " ") });
    }
    return list;
  }, [device, zone]);
  return (
    <select
      id={id}
      aria-label={label}
      value={zone}
      onChange={(e) => setZone(e.target.value)}
      className={className ?? "h-9 rounded-lg border bg-transparent px-2 text-xs font-semibold"}
      style={style ?? { borderColor: "var(--border)" }}
    >
      {options.map((o) => (<option key={o.id} value={o.id}>{o.text}</option>))}
    </select>
  );
}

export { zoneName };
