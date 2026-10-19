-- BoutCasts pricing update: voting windows, Platinum Supporter, time add-on.
-- Safe to run more than once. Run this BEFORE deploying the matching app code:
-- the app selects live_vote_events.super_votes_platinum_cents and calls the two
-- functions below, which do not exist yet.
--
-- Changes:
--   * Free events run 12 hours (was 24). Small runs 24 hours (was 4). Medium runs 3 days (was 24 hours).
--     Large stays 7 days. Keep in sync with src/lib/liveVoteEvents/tiers.ts.
--   * Adds live_vote_events.super_votes_platinum_cents: the organizer's fixed Platinum
--     Supporter price. NULL means the fan chooses any amount of $20 or more.
--   * Adds set_super_votes_platinum() for the organizer to set that price.
--   * Adds live_vote_time_addons + apply_live_vote_time_addon(): $25 per extra day, applied by
--     the Stripe webhook (service role only), once per checkout session.
--   * The organizer share of new Super Vote sales is 75% (set in the app webhook, tiers.ts).
--     Rows already recorded keep the share they were stored with.

alter table public.live_vote_events
  add column if not exists super_votes_platinum_cents integer;
alter table public.live_vote_events
  drop constraint if exists live_vote_events_platinum_min;
alter table public.live_vote_events
  add constraint live_vote_events_platinum_min
  check (super_votes_platinum_cents is null or (super_votes_platinum_cents >= 2000 and super_votes_platinum_cents <= 1000000));

create or replace function public.set_super_votes_platinum(p_event_id uuid, p_cents integer)
returns void language plpgsql security definer set search_path to 'public' as $fn$
begin
  if p_cents is not null and (p_cents < 2000 or p_cents > 1000000) then
    raise exception 'Platinum Supporter must be between $20 and $10,000';
  end if;
  update live_vote_events
     set super_votes_platinum_cents = p_cents
   where id = p_event_id
     and status <> 'closed'
     and (organizer_id = auth.uid() or coalesce(pred_is_admin(), false));
  if not found then raise exception 'Event not found or already closed'; end if;
end $fn$;
revoke all on function public.set_super_votes_platinum(uuid, integer) from public, anon;
grant execute on function public.set_super_votes_platinum(uuid, integer) to authenticated;

create table if not exists public.live_vote_time_addons (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.live_vote_events(id) on delete cascade,
  days integer not null check (days between 1 and 14),
  amount_cents integer not null,
  stripe_checkout_session_id text not null unique,
  created_at timestamptz not null default now()
);
alter table public.live_vote_time_addons enable row level security;

create or replace function public.apply_live_vote_time_addon(p_event_id uuid, p_days integer, p_session_id text)
returns void language plpgsql security definer set search_path to 'public' as $fn$
declare inserted int;
begin
  if p_days < 1 or p_days > 14 then raise exception 'Invalid number of days'; end if;
  insert into live_vote_time_addons (event_id, days, amount_cents, stripe_checkout_session_id)
  values (p_event_id, p_days, p_days * 2500, p_session_id)
  on conflict (stripe_checkout_session_id) do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then return; end if; -- repeated webhook delivery: days already added
  update live_vote_events
     set closes_at = greatest(coalesce(closes_at, now()), now()) + make_interval(days => p_days)
   where id = p_event_id and status = 'live' and closes_at is not null;
end $fn$;
revoke all on function public.apply_live_vote_time_addon(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.apply_live_vote_time_addon(uuid, integer, text) to service_role;

-- ---------------------------------------------------------------- windows
-- Free events: 12 hours.
create or replace function public.activate_free_live_vote_event(p_event_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $fn$
declare
  e live_vote_events;
  n_live int;
  n_recent int;
  adm boolean := coalesce(pred_is_admin(), false);
begin
  e := (select z from live_vote_events z where z.id = p_event_id);
  if e.id is null or e.organizer_id <> auth.uid() then raise exception 'Event not found'; end if;
  if e.status <> 'draft' then raise exception 'This event is already live or closed'; end if;
  if e.tier <> 'free' then raise exception 'Only Free events can go live without checkout'; end if;
  if exists (select 1 from profiles where id = auth.uid() and is_suspended) then raise exception 'Your account is suspended'; end if;
  if not adm then
    if e.scoring_mode <> 'crowd' or e.voting_method <> 'single' then
      raise exception 'Ranked choice and judges panels need a paid tier';
    end if;
    if e.brand_name is not null or e.brand_logo_url is not null or e.post_vote_graphic_url is not null
       or e.brand_color is not null or e.brand_bg_color is not null or e.white_label
       or exists (select 1 from live_vote_sponsors s where s.event_id = e.id) then
      raise exception 'Custom branding needs a paid tier - remove it or pick Small or larger';
    end if;
  end if;
  if (select count(*) from live_vote_options where event_id = e.id) < 2 then
    raise exception 'Add at least two options before going live';
  end if;
  if not adm then
    n_live := (select count(*) from live_vote_events
      where organizer_id = e.organizer_id and tier = 'free' and status = 'live');
    if n_live >= 1 then raise exception 'You already have a Free event live - close it or upgrade this one to a paid tier'; end if;
    n_recent := (select count(*) from live_vote_events
      where organizer_id = e.organizer_id and tier = 'free' and starts_at > now() - interval '30 days');
    if n_recent >= 5 then raise exception 'Free events are limited to 5 every 30 days - pick a paid tier for this one'; end if;
  end if;

  update live_vote_events
     set status = 'live', starts_at = now(), closes_at = now() + interval '12 hours',
         stripe_checkout_session_id = 'free', ads_enabled = true
   where id = e.id and status = 'draft';
end $fn$;

-- Organizer Pro / school license: Small 24 hours, Medium 3 days.
create or replace function public.activate_live_vote_event_with_plan(p_event_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $fn$
declare e record; st jsonb; v_window interval;
begin
  select * into e from live_vote_events where id = p_event_id;
  if e.id is null or e.organizer_id <> auth.uid() then raise exception 'Event not found'; end if;
  if e.status <> 'draft' then raise exception 'This event is already live or closed'; end if;
  if e.tier not in ('small','medium') then raise exception 'Large events are not included in Organizer Pro'; end if;
  if not is_organizer_pro(auth.uid()) then raise exception 'An active Organizer Pro plan is required'; end if;
  st := organizer_pro_status(auth.uid());
  if not org_license_active(auth.uid()) and (st->>'included_used')::int >= (st->>'included_per_period')::int then
    raise exception 'You have used all included events for this billing period';
  end if;
  if (select count(*) from live_vote_options where event_id = e.id) < 2 then
    raise exception 'Add at least two options before going live';
  end if;
  v_window := case e.tier when 'small' then interval '24 hours' else interval '3 days' end;
  update live_vote_events
     set status = 'live', starts_at = now(), closes_at = now() + v_window,
         stripe_checkout_session_id = 'subscription', pro_enabled = true
   where id = e.id and status = 'draft';
end $fn$;

-- Admin comp activation: Free 12 hours, Small 24 hours, Medium 3 days, Large 7 days.
create or replace function public.admin_activate_live_vote_event(p_event_id uuid, p_open_ended boolean default false)
returns table(status text, starts_at timestamptz, closes_at timestamptz)
language plpgsql security definer set search_path to 'public' as $fn$
declare
  v_tier text;
  v_window interval;
begin
  if not exists (select 1 from public.profiles where id = (select auth.uid()) and is_admin) then
    raise exception 'Only admins can activate an event without payment' using errcode = '42501';
  end if;

  select e.tier into v_tier from public.live_vote_events e where e.id = p_event_id and e.status = 'draft';
  if v_tier is null then
    raise exception 'Event not found or not a draft';
  end if;

  -- Keep in sync with src/lib/liveVoteEvents/tiers.ts
  v_window := case v_tier
    when 'free' then interval '12 hours'
    when 'small' then interval '24 hours'
    when 'medium' then interval '3 days'
    when 'large' then interval '7 days'
  end;

  return query
  update public.live_vote_events e
    set status = 'live',
        starts_at = now(),
        closes_at = case when p_open_ended then null else now() + v_window end,
        stripe_checkout_session_id = 'admin_comp'
    where e.id = p_event_id and e.status = 'draft'
    returning e.status, e.starts_at, e.closes_at;
end;
$fn$;
