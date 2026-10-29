// Ad geo targeting. A creative is national (everyone), limited to US states, or limited to a radius around a point.
// Visitor location comes from Vercel's request headers (city-level, free, no permission prompt). A page that knows
// where it is (a venue or school) can pass lat/lng or a state to override the visitor's IP location.

export type Geo = { country: string | null; region: string | null; lat: number | null; lng: number | null };

export type GeoTargeting = {
  geo_scope: string | null;
  geo_states: string[] | null;
  geo_lat: number | null;
  geo_lng: number | null;
  geo_radius_miles: number | null;
};

/** Local ads get this many times the delivery weight of a national ad with the same weight. */
export const LOCAL_BOOST = 4;

function num(v: string | null): number | null {
  if (v == null || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function visitorGeo(headers: Headers, params: URLSearchParams): Geo {
  let country = headers.get("x-vercel-ip-country");
  let region = headers.get("x-vercel-ip-country-region");
  let lat = num(headers.get("x-vercel-ip-latitude"));
  let lng = num(headers.get("x-vercel-ip-longitude"));

  // Page-supplied location (a venue or school). Rounded so nothing precise is ever handled.
  const pLat = num(params.get("lat"));
  const pLng = num(params.get("lng"));
  if (pLat !== null && pLng !== null && Math.abs(pLat) <= 90 && Math.abs(pLng) <= 180) {
    lat = Math.round(pLat * 100) / 100;
    lng = Math.round(pLng * 100) / 100;
  }
  const pRegion = params.get("region");
  if (pRegion && /^[A-Za-z]{2}$/.test(pRegion)) {
    region = pRegion.toUpperCase();
    country = "US";
  }
  return { country, region: region ? region.toUpperCase() : null, lat, lng };
}

export function milesBetween(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 3958.8;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function isLocal(c: Pick<GeoTargeting, "geo_scope">): boolean {
  return !!c.geo_scope && c.geo_scope !== "national";
}

/** True when this creative may be shown to a visitor at `g`. National ads always match; local ads need a known location. */
export function matchesGeo(c: GeoTargeting, g: Geo): boolean {
  if (!isLocal(c)) return true;
  if (c.geo_scope === "state") {
    return g.country === "US" && !!g.region && !!c.geo_states?.includes(g.region);
  }
  if (c.geo_scope === "radius") {
    if (g.lat == null || g.lng == null || c.geo_lat == null || c.geo_lng == null || c.geo_radius_miles == null) return false;
    return milesBetween(g.lat, g.lng, c.geo_lat, c.geo_lng) <= c.geo_radius_miles;
  }
  return false;
}

export const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO",
  "MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
] as const;
