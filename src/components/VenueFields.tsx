"use client";

import { useState } from "react";

// Where an event happens. A 5-digit ZIP is turned into a map point (rounded) so local ads near the venue can
// show on the event's pages. Nothing about a visitor is stored.
export type Venue = { name: string; city: string; state: string; zip: string; lat: number | null; lng: number | null };
export const EMPTY_VENUE: Venue = { name: "", city: "", state: "", zip: "", lat: null, lng: null };

export function venueCols(v: Venue) {
  const has = /^\d{5}$/.test(v.zip) && v.lat !== null && v.lng !== null;
  return {
    venue_name: v.name.trim() || null,
    venue_city: v.city.trim() || null,
    venue_state: /^[A-Za-z]{2}$/.test(v.state.trim()) ? v.state.trim().toUpperCase() : null,
    venue_zip: has ? v.zip : null,
    venue_lat: has ? Math.round((v.lat as number) * 100) / 100 : null,
    venue_lng: has ? Math.round((v.lng as number) * 100) / 100 : null,
  };
}

export default function VenueFields({ value, onChange }: { value: Venue; onChange: (v: Venue) => void }) {
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = "w-full rounded-[10px] border px-3 py-2.5 text-sm";
  const style = { borderColor: "var(--border)", background: "var(--surface)" } as const;

  async function lookup(zip: string) {
    if (!/^\d{5}$/.test(zip)) return;
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch(`https://api.zippopotam.us/us/${zip}`);
      if (!res.ok) throw new Error("not found");
      const j = (await res.json()) as { places?: { latitude: string; longitude: string; "place name": string; "state abbreviation": string }[] };
      const p = j.places?.[0];
      if (!p) throw new Error("not found");
      onChange({ ...value, zip, lat: Number(p.latitude), lng: Number(p.longitude), city: value.city || p["place name"], state: value.state || p["state abbreviation"] });
      setNote(`Found ${p["place name"]}, ${p["state abbreviation"]}.`);
    } catch {
      setNote("Couldn't look up that ZIP. Check it and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-2">
      <label className="grid gap-1 text-sm font-semibold">Venue name (optional)
        <input className={input} style={style} value={value.name} maxLength={120} onChange={(e) => onChange({ ...value, name: e.target.value })} placeholder="Veterans Memorial Stadium" />
      </label>
      <div className="grid grid-cols-[1fr_72px_110px] gap-2">
        <label className="grid gap-1 text-sm font-semibold">City
          <input className={input} style={style} value={value.city} maxLength={80} onChange={(e) => onChange({ ...value, city: e.target.value })} />
        </label>
        <label className="grid gap-1 text-sm font-semibold">State
          <input className={input} style={style} value={value.state} maxLength={2} onChange={(e) => onChange({ ...value, state: e.target.value.toUpperCase() })} placeholder="MS" />
        </label>
        <label className="grid gap-1 text-sm font-semibold">ZIP
          <input className={input} style={style} value={value.zip} inputMode="numeric" maxLength={5} disabled={busy}
            onChange={(e) => { const z = e.target.value.replace(/\D/g, ""); onChange({ ...value, zip: z, ...(z !== value.zip ? { lat: null, lng: null } : {}) }); if (z.length === 5) lookup(z); }} placeholder="39213" />
        </label>
      </div>
      <p className="text-xs" style={{ color: "var(--text-faint)" }}>
        {note ?? "Used so ads from businesses near this venue can show on this vote. Visitors' locations are never stored."}
      </p>
    </div>
  );
}
