-- Venue for a Live Vote: shown to local-ad targeting (ads within a radius of the venue appear on that vote's
-- page) and to nothing else. Only a ZIP-level point is kept, rounded to 2 decimals, never a visitor's location.
-- Safe to run more than once.
alter table public.live_vote_events
  add column if not exists venue_name text check (venue_name is null or char_length(venue_name) <= 120),
  add column if not exists venue_city text check (venue_city is null or char_length(venue_city) <= 80),
  add column if not exists venue_state text check (venue_state is null or venue_state ~ '^[A-Z]{2}$'),
  add column if not exists venue_zip text check (venue_zip is null or venue_zip ~ '^[0-9]{5}$'),
  add column if not exists venue_lat double precision check (venue_lat is null or venue_lat between -90 and 90),
  add column if not exists venue_lng double precision check (venue_lng is null or venue_lng between -180 and 180);
