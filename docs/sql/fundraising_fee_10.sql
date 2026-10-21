-- Fundraising platform fee: 10%.
-- BoutCasts now keeps 10% of organizer-sold sponsorships (was 30%); the organizer gets 90%.
-- Applies to NEW sponsorships only. Rows already recorded keep the fee they were stored with.
-- Super Votes (organizer share 90%, was 75%) are set in the app (tiers.ts), not here.
-- Safe to run more than once.

alter table public.event_sponsorships alter column platform_fee_pct set default 10;

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

  fee := (((pk.price_cents::bigint * 10) + 50) / 100)::integer;
  insert into public.event_sponsorships (
    event_id, package_id, level, company_name, contact_email, logo_url, link_url,
    gross_cents, platform_fee_pct, platform_fee_cents, organizer_share_cents,
    stripe_checkout_session_id, stripe_payment_intent
  ) values (
    pk.event_id, pk.id, pk.level, left(p_company, 120), p_email, nullif(p_logo, ''), nullif(p_link, ''),
    pk.price_cents, 10, fee, pk.price_cents - fee, p_session, p_payment_intent
  );
  return 'paid';
end;
$$;
revoke all on function public.record_event_sponsorship(uuid, text, text, text, text, text, text) from public, anon, authenticated;
