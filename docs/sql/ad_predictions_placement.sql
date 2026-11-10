-- Adds a dedicated "predictions" ad placement (banner on prediction brackets and games). Safe to re-run.
alter table public.ad_creatives drop constraint if exists ad_creatives_placement_check;
alter table public.ad_creatives add constraint ad_creatives_placement_check
  check (placement = any (array['preroll','interstitial','banner','live_vote','predictions']));
