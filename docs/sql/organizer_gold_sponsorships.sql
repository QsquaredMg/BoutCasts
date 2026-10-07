-- Organizer Gold plan + organizer-sold event sponsorships.
--
-- Organizers on the Gold plan can sell sponsor packages for their own Live Vote
-- events. Sponsors pay BoutCasts by card. BoutCasts keeps platform_fee_pct (30)
-- percent of each sponsorship and owes the organizer the rest, paid after the
-- event closes. The organizer approves each sponsor before its logo appears;
-- a declined sponsor is refunded in full.
--
-- Additive and idempotent.

-- 1. Gold plan ---------------------------------------------------------------
alter table public.organizer_subscriptions
  add column if not exists plan text not null default 'pro' check (plan in ('pro', 'gold'));

create or replace function public.organizer_is_gold(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organizer_subscriptions s
    where s.user_id = p_user
      and s.plan = 'gold'
      and s.status in ('active', 'trialing')
      and coalesce(s.current_period_end, now()) > now()
  ) or exists (select 1 from public.profiles p where p.id = p_user and p.is_admin)
$$;
revoke all on function public.organizer_is_gold(uuid) from public;
grant execute on function public.organizer_is_gold(uuid) to authenticated;

-- 2. Packages an organizer offers --------------------------------------------
create table if not exists public.event_sponsor_packages (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.live_vote_events(id) on delete cascade,
  name text not null check (char_length(name) between 3 and 60),
  level text not null default 'supporter' check (level in ('title', 'gold', 'supporter')),
  price_cents integer not null check (price_cents between 2500 and 1000000),
  slots integer not null default 1 check (slots between 1 and 20),
  perks text check (perks is null or char_length(perks) <= 500),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists event_sponsor_packages_event_idx on public.event_sponsor_packages (event_id);

-- 3. Sponsorships bought --------------------------------------------------------
create table if not exists public.event_sponsorships (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.live_vote_events(id) on delete cascade,
  package_id uuid not null references public.event_sponsor_packages(id),
  level text not null check (level in ('title', 'gold', 'supporter')),
  company_name text not null check (char_length(company_name) between 1 and 120),
  contact_email text not null,
  logo_url text,
  link_url text,
  gross_cents integer not null check (gross_cents > 0),
  platform_fee_pct integer not null default 30 check (platform_fee_pct between 0 and 100),
  platform_fee_cents integer not null check (platform_fee_cents >= 0),
  organizer_share_cents integer not null check (organizer_share_cents >= 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  stripe_checkout_session_id text not null unique,
  stripe_payment_intent text,
  sponsor_row_id uuid references public.live_vote_sponsors(id) on delete set null,
  organizer_payout_status text not null default 'pending' check (organizer_payout_status in ('pending', 'paid')),
  organizer_paid_at timestamptz,
  organizer_paid_by uuid references public.profiles(id),
  payout_method text,
  created_at timestamptz not null default now(),
  check (platform_fee_cents + organizer_share_cents = gross_cents)
);
create index if not exists event_sponsorships_event_idx on public.event_sponsorships (event_id, status);

-- 4. Record a paid sponsorship (called by the Stripe webhook) -----------------
-- Locks the package so two last-slot payments can't both succeed.
-- Returns 'paid', 'full' or 'closed'; the last two mean the caller must refund.
create or replace function public.record_event_sponsorship(
  p_package uuid, p_company text, p_email text, p_logo text, p_link text,
  p_session text, p_payment_intent text
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  pk public.event_sponsor_packages;
  ev public.live_vote_events;
  taken integer;
  fee integer;
begin
  if exists (select 1 from public.event_sponsorships where stripe_checkout_session_id = p_session) then
    return 'paid';
  end if;
  select * into pk from public.event_sponsor_packages where id = p_package for update;
  if not found or not pk.active then return 'closed'; end if;
  select * into ev from public.live_vote_events where id = pk.event_id;
  if not found or ev.status = 'closed' then return 'closed'; end if;
  if not public.organizer_is_gold(ev.organizer_id) then return 'closed'; end if;
  select count(*) into taken from public.event_sponsorships where package_id = pk.id and status <> 'declined';
  if taken >= pk.slots then return 'full'; end if;

  fee := (((pk.price_cents::bigint * 30) + 50) / 100)::integer;
  insert into public.event_sponsorships (
    event_id, package_id, level, company_name, contact_email, logo_url, link_url,
    gross_cents, platform_fee_pct, platform_fee_cents, organizer_share_cents,
    stripe_checkout_session_id, stripe_payment_intent
  ) values (
    pk.event_id, pk.id, pk.level, left(p_company, 120), p_email, nullif(p_logo, ''), nullif(p_link, ''),
    pk.price_cents, 30, fee, pk.price_cents - fee, p_session, p_payment_intent
  );
  return 'paid';
end;
$$;
revoke all on function public.record_event_sponsorship(uuid, text, text, text, text, text, text) from public, anon, authenticated;

-- 5. Organizer approves a sponsor: it joins the event's sponsor strip ----------
create or replace function public.approve_event_sponsorship(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.event_sponsorships;
  ev public.live_vote_events;
  new_id uuid;
begin
  select * into s from public.event_sponsorships where id = p_id for update;
  if not found then raise exception 'Sponsorship not found'; end if;
  select * into ev from public.live_vote_events where id = s.event_id;
  if not (ev.organizer_id = auth.uid() or public.is_admin_user()) then
    raise exception 'Only the organizer can approve sponsors';
  end if;
  if s.status <> 'pending' then raise exception 'This sponsorship has already been handled'; end if;

  insert into public.live_vote_sponsors (event_id, name, logo_url, link_url, level, amount_cents, sort_order)
  values (
    s.event_id, s.company_name, s.logo_url, s.link_url, s.level, s.gross_cents,
    coalesce((select max(sort_order) + 1 from public.live_vote_sponsors where event_id = s.event_id), 0)
  ) returning id into new_id;

  update public.event_sponsorships set status = 'approved', sponsor_row_id = new_id where id = s.id;
end;
$$;
revoke all on function public.approve_event_sponsorship(uuid) from public, anon;
grant execute on function public.approve_event_sponsorship(uuid) to authenticated;

-- 6. Admin records that the organizer's share was sent -------------------------
-- Only after the event has closed, and only for approved sponsors.
create or replace function public.mark_event_sponsorship_paid_out(p_id uuid, p_method text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.event_sponsorships;
begin
  if not public.is_admin_user() then raise exception 'Admins only'; end if;
  if coalesce(trim(p_method), '') = '' then raise exception 'Say how it was paid (for example Zelle, ACH, check)'; end if;
  select * into s from public.event_sponsorships where id = p_id for update;
  if not found then raise exception 'Sponsorship not found'; end if;
  if s.status <> 'approved' then raise exception 'Only approved sponsorships are paid out'; end if;
  if not exists (select 1 from public.live_vote_events where id = s.event_id and status = 'closed') then
    raise exception 'The organizer is paid after the event closes';
  end if;
  update public.event_sponsorships
    set organizer_payout_status = 'paid', organizer_paid_at = now(), organizer_paid_by = auth.uid(), payout_method = trim(p_method)
    where id = s.id;
end;
$$;
revoke all on function public.mark_event_sponsorship_paid_out(uuid, text) from public, anon;
grant execute on function public.mark_event_sponsorship_paid_out(uuid, text) to authenticated;

-- 7. Row-level security: reads only ---------------------------------------------
alter table public.event_sponsor_packages enable row level security;
alter table public.event_sponsorships enable row level security;

drop policy if exists event_sponsor_packages_read on public.event_sponsor_packages;
create policy event_sponsor_packages_read on public.event_sponsor_packages for select using (
  active
  or public.is_admin_user()
  or exists (select 1 from public.live_vote_events e where e.id = event_id and e.organizer_id = auth.uid())
);

drop policy if exists event_sponsorships_read on public.event_sponsorships;
create policy event_sponsorships_read on public.event_sponsorships for select using (
  public.is_admin_user()
  or exists (select 1 from public.live_vote_events e where e.id = event_id and e.organizer_id = auth.uid())
);
