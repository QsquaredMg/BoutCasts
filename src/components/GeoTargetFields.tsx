"use client";

import { useState } from "react";
import { US_STATES } from "@/lib/ads/geo";

// Where an ad shows: everywhere, certain US states, or within a radius of a ZIP code.
export type GeoTarget = {
  scope: "national" | "state" | "radius";
  states: string; // "MS, AL, LA"
  zip: string;
  lat: string;
  lng: string;
  radius: string;
  label: string;
};

export const EMPTY_GEO: GeoTarget = { scope: "national", states: "", zip: "", lat: "", lng: "", radius: "25", label: "" };

export type GeoColumns = {
  geo_scope: "national" | "state" | "radius";
  geo_states: string[] | null;
  geo_lat: number | null;
  geo_lng: number | null;
  geo_radius_miles: number | null;
  geo_label: string | null;
};

export function geoFromColumns(c: Partial<GeoColumns>): GeoTarget {
  return {
    scope: c.geo_scope ?? "national",
    states: (c.geo_states ?? []).join(", "),
    zip: "",
    lat: c.geo_lat != null ? String(c.geo_lat) : "",
    lng: c.geo_lng != null ? String(c.geo_lng) : "",
    radius: c.geo_radius_miles != null ? String(c.geo_radius_miles) : "25",
    label: c.geo_label ?? "",
  };
}

/** Validates the form and turns it into database columns. Returns an error message when something is missing. */
export function geoToColumns(t: GeoTarget): { ok: true; cols: GeoColumns } | { ok: false; error: string } {
  if (t.scope === "national") {
    return { ok: true, cols: { geo_scope: "national", geo_states: null, geo_lat: null, geo_lng: null, geo_radius_miles: null, geo_label: null } };
  }
  if (t.scope === "state") {
    const list = [...new Set(t.states.split(/[\s,]+/).map((s) => s.trim().toUpperCase()).filter(Boolean))];
    if (!list.length) return { ok: false, error: "Enter at least one state, like MS or AL." };
    const bad = list.filter((s) => !(US_STATES as readonly string[]).includes(s));
    if (bad.length) return { ok: false, error: `Not a US state code: ${bad.join(", ")}.` };
    return { ok: true, cols: { geo_scope: "state", geo_states: list, geo_lat: null, geo_lng: null, geo_radius_miles: null, geo_label: list.join(", ") } };
  }
  const lat = Number(t.lat), lng = Number(t.lng), miles = Math.floor(Number(t.radius));
  if (t.lat.trim() === "" || t.lng.trim() === "" || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return { ok: false, error: "Look up a ZIP code first (or type the latitude and longitude)." };
  }
  if (!Number.isFinite(miles) || miles < 1 || miles > 3000) return { ok: false, error: "The radius must be between 1 and 3,000 miles." };
  return {
    ok: true,
    cols: { geo_scope: "radius", geo_states: null, geo_lat: lat, geo_lng: lng, geo_radius_miles: miles, geo_label: t.label.trim() || `${miles} mi around ${t.zip || `${lat}, ${lng}`}` },
  };
}

export function describeGeo(c: Partial<GeoColumns>): string {
  if (c.geo_scope === "state") return `States: ${(c.geo_states ?? []).join(", ")}`;
  if (c.geo_scope === "radius") return `${c.geo_radius_miles} mi around ${c.geo_label ?? "a point"}`;
  return "National";
}

export default function GeoTargetFields({ value, onChange }: { value: GeoTarget; onChange: (v: GeoTarget) => void }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const set = (patch: Partial<GeoTarget>) => onChange({ ...value, ...patch });

  async function lookup() {
    const zip = value.zip.trim();
    if (!/^\d{5}$/.test(zip)) {
      setNote("Enter a 5-digit ZIP code.");
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch(`https://api.zippopotam.us/us/${zip}`);
      if (!res.ok) throw new Error("not found");
      const j = (await res.json()) as { places?: { latitude: string; longitude: string; "place name": string; "state abbreviation": string }[] };
      const p = j.places?.[0];
      if (!p) throw new Error("not found");
      const label = `${p["place name"]}, ${p["state abbreviation"]}`;
      onChange({ ...value, lat: p.latitude, lng: p.longitude, label });
      setNote(`Found ${label}.`);
    } catch {
      setNote("Couldn't look up that ZIP. Check it, or type the latitude and longitude yourself.");
    } finally {
      setBusy(false);
    }
  }

  const input = "rounded border border-neutral-300 px-3 py-2 text-sm";
  return (
    <div className="flex flex-col gap-2 rounded border border-neutral-200 p-3">
      <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
        <span className="mr-1 text-neutral-500">Where it shows</span>
        {([
          ["national", "Everywhere (national)"],
          ["state", "Certain states"],
          ["radius", "Near a ZIP code"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => set({ scope: key })}
            className={`rounded-full border px-3 py-1 ${value.scope === key ? "border-red-600 text-red-600" : "border-neutral-300 text-neutral-600"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {value.scope === "state" && (
        <label className="flex flex-col gap-1 text-xs text-neutral-500">
          State codes, separated by commas
          <input value={value.states} onChange={(e) => set({ states: e.target.value })} placeholder="MS, AL, LA" className={input} />
        </label>
      )}

      {value.scope === "radius" && (
        <>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-xs text-neutral-500">
              Center ZIP code
              <input value={value.zip} onChange={(e) => set({ zip: e.target.value })} inputMode="numeric" maxLength={5} placeholder="39217" className={`${input} w-28`} />
            </label>
            <button type="button" onClick={lookup} disabled={busy} className="rounded border border-neutral-300 px-3 py-2 text-xs font-semibold disabled:opacity-60">
              {busy ? "Looking up…" : "Look up"}
            </button>
            <label className="flex flex-col gap-1 text-xs text-neutral-500">
              Radius (miles)
              <input type="number" min={1} max={3000} value={value.radius} onChange={(e) => set({ radius: e.target.value })} className={`${input} w-28`} />
            </label>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-neutral-500">
            <label className="flex flex-col gap-1">
              Latitude
              <input value={value.lat} onChange={(e) => set({ lat: e.target.value })} className={`${input} w-32`} />
            </label>
            <label className="flex flex-col gap-1">
              Longitude
              <input value={value.lng} onChange={(e) => set({ lng: e.target.value })} className={`${input} w-32`} />
            </label>
            <label className="flex min-w-[10rem] flex-1 flex-col gap-1">
              Label (shown to you only)
              <input value={value.label} onChange={(e) => set({ label: e.target.value })} className={input} />
            </label>
          </div>
        </>
      )}

      {note && <p className="text-xs text-neutral-500">{note}</p>}
      <p className="text-[11px] text-neutral-500">
        {value.scope === "national"
          ? "Shows to everyone. Local ads get priority over national ones where they match."
          : "Only shows to visitors we can place in this area (city-level, from their connection). Visitors we can't place see national ads."}
      </p>
    </div>
  );
}
