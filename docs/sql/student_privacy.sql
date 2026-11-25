-- Student privacy options for school elections. Run once; safe to run again.
--  * code_only: students vote with a code alone (no names stored on the roster).
--  * roster purge: delete roster rows (names, student ids, emails, codes) after an election closes,
--    keeping only the turnout totals.

alter table public.school_elections
  add column if not exists code_only boolean not null default false,
  add column if not exists roster_purged_at timestamptz,
  add column if not exists roster_final_total integer,
  add column if not exists roster_final_voted integer;

create or replace function public.purge_election_roster(p_election_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $fn$
declare el school_elections; t int; v int;
begin
  select * into el from school_elections where id = p_election_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if el.status <> 'closed' then return jsonb_build_object('ok', false, 'error', 'not_closed'); end if;
  select count(*), count(*) filter (where voted_at is not null) into t, v from election_voters where election_id = el.id;
  if el.roster_purged_at is null then
    update school_elections set roster_final_total = t, roster_final_voted = v, roster_purged_at = now() where id = el.id;
  end if;
  delete from election_voters where election_id = el.id;
  return jsonb_build_object('ok', true, 'total', t, 'voted', v);
end $fn$;

revoke all on function public.purge_election_roster(uuid) from public, anon, authenticated;
grant execute on function public.purge_election_roster(uuid) to service_role;
