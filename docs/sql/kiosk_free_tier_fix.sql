-- School elections created before the Free tier existed only allow small/medium/large.
alter table public.school_elections drop constraint if exists school_elections_tier_check;
alter table public.school_elections add constraint school_elections_tier_check
  check (tier in ('free','small','medium','large'));
