-- Civics unit, part A: practice elections (with reset), certification, and the school fundraiser switch.
-- Run after kiosk_mode.sql and kiosk_open_ended.sql. Safe to run more than once.

alter table public.school_elections
  add column if not exists is_practice boolean not null default false,
  add column if not exists certified_at timestamptz,
  add column if not exists certified_by uuid references auth.users(id) on delete set null,
  add column if not exists certified_note text,
  add column if not exists fundraiser_enabled boolean not null default false,
  add column if not exists fundraiser_goal_cents integer;

alter table public.school_elections drop constraint if exists school_elections_fundraiser_goal_chk;
alter table public.school_elections add constraint school_elections_fundraiser_goal_chk
  check (fundraiser_goal_cents is null or fundraiser_goal_cents between 100 and 100000000);

-- A practice election never raises money and is never certified: it exists to be run again.
alter table public.school_elections drop constraint if exists school_elections_practice_chk;
alter table public.school_elections add constraint school_elections_practice_chk
  check (not is_practice or (not fundraiser_enabled and certified_at is null));

-- Wipe a practice election back to its starting line: no votes, nobody marked as voted, fresh voting window.
-- Refuses real elections, so a mistaken call can never erase a real result.
create or replace function public.reset_school_election(p_election_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $fn$
declare el school_elections; v_start timestamptz := now(); v_close timestamptz; n int;
begin
  select * into el from school_elections where id = p_election_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if not el.is_practice then return jsonb_build_object('ok', false, 'error', 'not_practice'); end if;
  if el.status = 'draft' then return jsonb_build_object('ok', false, 'error', 'not_started'); end if;

  delete from live_votes where event_id in (select id from live_vote_events where election_id = el.id);
  get diagnostics n = row_count;
  update election_voters set voted_at = null, voted_kiosk = null, voted_request_id = null where election_id = el.id;
  update election_kiosks set failed_attempts = 0, locked_until = null where election_id = el.id;
  delete from election_audit where election_id = el.id;

  v_close := case when el.open_ended then null
                  else v_start + case when el.tier = 'free' and el.days = 1 then interval '12 hours' else make_interval(days => el.days) end end;
  update school_elections set status = 'live', starts_at = v_start, closes_at = v_close where id = el.id;
  update live_vote_events set status = 'live', starts_at = v_start, closes_at = v_close where election_id = el.id;
  return jsonb_build_object('ok', true, 'votes_removed', n);
end $fn$;

revoke all on function public.reset_school_election(uuid) from public, anon, authenticated;
grant execute on function public.reset_school_election(uuid) to service_role;
