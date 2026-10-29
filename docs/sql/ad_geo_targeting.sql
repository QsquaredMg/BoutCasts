-- Geo targeting for ads: national (default), specific US states, or a radius around a point (ZIP/city).
-- Visitor location comes from Vercel's free request headers (city-level, nothing stored per person) or from a
-- page that knows its venue. Impressions log only the US state, never coordinates.
-- Additive and safe to re-run. Existing ads stay national.

alter table public.ad_creatives add column if not exists geo_scope text not null default 'national';
alter table public.ad_creatives add column if not exists geo_states text[];
alter table public.ad_creatives add column if not exists geo_lat double precision;
alter table public.ad_creatives add column if not exists geo_lng double precision;
alter table public.ad_creatives add column if not exists geo_radius_miles integer;
alter table public.ad_creatives add column if not exists geo_label text;

alter table public.ad_creatives drop constraint if exists ad_creatives_geo_check;
alter table public.ad_creatives add constraint ad_creatives_geo_check check (
  (geo_scope = 'national')
  or (geo_scope = 'state' and geo_states is not null and cardinality(geo_states) > 0)
  or (geo_scope = 'radius' and geo_lat is not null and geo_lng is not null and geo_radius_miles between 1 and 3000)
);

-- Which state an impression or click came from, for reporting.
alter table public.ad_events add column if not exists region text;
