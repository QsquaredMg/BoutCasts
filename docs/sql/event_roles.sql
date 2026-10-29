-- Hand over or share a live vote / school election.
--
-- Two roles, both granted by email (exact match against the invitee's verified
-- account email):
--   moderator : runs the event (candidates, roster, kiosks, closing, results)
--               but never sees billing, Super Vote settings or earnings.
--   owner     : takes the event over. organizer_id moves to the new person.
-- Owners and platform admins can invite, revoke and transfer. Moderators can
-- only resign. Earnings stay with whoever owned the event when they were earned.
--
-- Run each numbered block separately in the Supabase SQL editor.

-- ===== 1. Tables =====
create table if not exists public.event_roles (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('live_vote', 'school_election')),
  event_id uuid not null,
  role text not null check (role in ('moderator', 'owner')),
  invited_email text not null,
  user_id uuid references auth.users (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'declined', 'revoked', 'completed')),
  token_hash text not null,
  keep_access boolean not null default false,
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  responded_at timestamptz
);
alter table public.event_roles enable row level security; -- no policies: RPCs only

create unique index if not exists event_roles_one_pending
  on public.event_roles (kind, event_id, invited_email, role) where status = 'pending';
create unique index if not exists event_roles_one_active_mod
  on public.event_roles (kind, event_id, user_id) where status = 'active' and role = 'moderator';
create index if not exists event_roles_user on public.event_roles (user_id) where status = 'active';
create index if not exists event_roles_email on public.event_roles (invited_email) where status = 'pending';
create index if not exists event_roles_token on public.event_roles (token_hash);

create table if not exists public.event_role_log (
  id bigint generated always as identity primary key,
  kind text not null,
  event_id uuid not null,
  actor uuid,
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.event_role_log enable row level security; -- admins read through the dashboard/SQL

-- ===== 2. Earnings stay with the owner who earned them =====
alter table public.live_vote_super_votes add column if not exists earned_by uuid;
alter table public.event_sponsorships add column if not exists earned_by uuid;

update public.live_vote_super_votes s set earned_by = e.organizer_id
  from public.live_vote_events e where e.id = s.event_id and s.earned_by is null;
update public.event_sponsorships s set earned_by = e.organizer_id
  from public.live_vote_events e where e.id = s.event_id and s.earned_by is null;

create or replace function public.set_earned_by() returns trigger
language plpgsql set search_path = public as $fn$
begin
  if new.earned_by is null then
    select organizer_id into new.earned_by from public.live_vote_events where id = new.event_id;
  end if;
  return new;
end $fn$;

drop trigger if exists live_vote_super_votes_earned_by on public.live_vote_super_votes;
create trigger live_vote_super_votes_earned_by before insert on public.live_vote_super_votes
  for each row execute function public.set_earned_by();
drop trigger if exists event_sponsorships_earned_by on public.event_sponsorships;
create trigger event_sponsorships_earned_by before insert on public.event_sponsorships
  for each row execute function public.set_earned_by();

-- ===== 3. Permission helpers =====
-- Is the signed-in user an active moderator of this live vote? Also true when they
-- moderate the school election that the vote (a "race") belongs to.
create or replace function public.live_vote_is_mod(p_event_id uuid) returns boolean
language sql stable security definer set search_path = public as $fn$
  select exists (
    select 1 from public.event_roles r
    where r.status = 'active' and r.role = 'moderator' and r.user_id = auth.uid()
      and ((r.kind = 'live_vote' and r.event_id = p_event_id)
        or (r.kind = 'school_election' and r.event_id = (select election_id from public.live_vote_events where id = p_event_id)))
  )
$fn$;

-- Owner, platform admin or moderator.
create or replace function public.live_vote_can_moderate(p_event_id uuid) returns boolean
language sql stable security definer set search_path = public as $fn$
  select exists (select 1 from public.live_vote_events where id = p_event_id and organizer_id = auth.uid())
      or public.is_admin_user()
      or public.live_vote_is_mod(p_event_id)
$fn$;

create or replace function public.school_election_can_moderate(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $fn$
  select exists (select 1 from public.school_elections where id = p_id and organizer_id = auth.uid())
      or public.is_admin_user()
      or exists (select 1 from public.event_roles r where r.kind = 'school_election' and r.event_id = p_id
                 and r.role = 'moderator' and r.status = 'active' and r.user_id = auth.uid())
$fn$;

-- Owner or platform admin only (billing, assigning roles, transfers).
create or replace function public._event_is_owner(p_kind text, p_event_id uuid) returns boolean
language plpgsql stable security definer set search_path = public as $fn$
declare v_owner uuid;
begin
  if p_kind = 'live_vote' then
    select organizer_id into v_owner from public.live_vote_events where id = p_event_id;
  elsif p_kind = 'school_election' then
    select organizer_id into v_owner from public.school_elections where id = p_event_id;
  else
    return false;
  end if;
  return v_owner is not null and (v_owner = auth.uid() or public.is_admin_user());
end $fn$;

-- What is my relationship to this event? 'owner' | 'admin' | 'moderator' | null
create or replace function public.event_role_for_me(p_kind text, p_event_id uuid) returns text
language plpgsql stable security definer set search_path = public as $fn$
declare v_owner uuid;
begin
  if auth.uid() is null then return null; end if;
  if p_kind = 'live_vote' then
    select organizer_id into v_owner from public.live_vote_events where id = p_event_id;
  elsif p_kind = 'school_election' then
    select organizer_id into v_owner from public.school_elections where id = p_event_id;
  end if;
  if v_owner = auth.uid() then return 'owner'; end if;
  if public.is_admin_user() then return 'admin'; end if;
  if p_kind = 'live_vote' and public.live_vote_is_mod(p_event_id) then return 'moderator'; end if;
  if p_kind = 'school_election' and public.school_election_can_moderate(p_event_id) then return 'moderator'; end if;
  return null;
end $fn$;

-- ===== 4. Invite, list, revoke, accept, decline =====
create or replace function public._my_verified_email() returns text
language sql stable security definer set search_path = public as $fn$
  select lower(email) from auth.users where id = auth.uid() and email_confirmed_at is not null
$fn$;

-- Owner/admin invites someone by email. Inviting the same email again replaces the
-- pending invite with a fresh link (that is how "resend" works).
create or replace function public.invite_event_role(
  p_kind text, p_event_id uuid, p_email text, p_role text, p_keep_access boolean default false
) returns jsonb
language plpgsql security definer set search_path = public as $fn$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_token text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  v_id uuid;
  v_owner uuid;
  v_title text;
  v_exists boolean;
  v_pending int;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if p_role not in ('moderator', 'owner') then raise exception 'Role must be moderator or owner'; end if;
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' or length(v_email) > 254 then raise exception 'Enter a valid email address'; end if;
  if not public._event_is_owner(p_kind, p_event_id) then
    raise exception 'Only the owner or an admin can do this';
  end if;

  if p_kind = 'live_vote' then
    select organizer_id, title into v_owner, v_title from public.live_vote_events where id = p_event_id;
    if exists (select 1 from public.live_vote_events where id = p_event_id and election_id is not null) then
      raise exception 'This vote belongs to a school election. Share the election instead.';
    end if;
  else
    select organizer_id, title into v_owner, v_title from public.school_elections where id = p_event_id;
  end if;
  if v_owner is null then raise exception 'Event not found'; end if;

  if exists (select 1 from auth.users u where u.id = v_owner and lower(u.email) = v_email) then
    raise exception 'That email already owns this event';
  end if;
  if exists (
    select 1 from public.profiles pr join auth.users u on u.id = pr.id
    where lower(u.email) = v_email and coalesce(pr.is_suspended, false)
  ) then
    raise exception 'That account cannot be given access right now';
  end if;

  select count(*) into v_pending from public.event_roles
   where kind = p_kind and event_id = p_event_id and status = 'pending';
  if v_pending >= 20 then raise exception 'Too many pending invites. Revoke some first.'; end if;

  -- A new owner invite replaces any other pending owner invite for this event.
  if p_role = 'owner' then
    update public.event_roles set status = 'revoked', responded_at = now()
     where kind = p_kind and event_id = p_event_id and role = 'owner' and status = 'pending'
       and invited_email <> v_email;
  end if;

  -- Same email and role already pending: rotate its link and expiry.
  update public.event_roles
     set token_hash = encode(sha256(convert_to(v_token, 'utf8')), 'hex'),
         expires_at = now() + interval '14 days',
         keep_access = coalesce(p_keep_access, false),
         invited_by = auth.uid()
   where kind = p_kind and event_id = p_event_id and invited_email = v_email
     and role = p_role and status = 'pending'
   returning id into v_id;

  if v_id is null then
    insert into public.event_roles (kind, event_id, role, invited_email, token_hash, keep_access, invited_by)
    values (p_kind, p_event_id, p_role, v_email, encode(sha256(convert_to(v_token, 'utf8')), 'hex'),
            coalesce(p_keep_access, false), auth.uid())
    returning id into v_id;
  end if;

  select exists (select 1 from auth.users u where lower(u.email) = v_email) into v_exists;

  insert into public.event_role_log (kind, event_id, actor, action, detail)
  values (p_kind, p_event_id, auth.uid(), 'invite', jsonb_build_object('role', p_role, 'email', v_email, 'role_id', v_id));

  return jsonb_build_object('id', v_id, 'token', v_token, 'email', v_email, 'role', p_role,
                            'title', v_title, 'user_exists', v_exists);
end $fn$;

-- Owner/admin: everyone with, or invited to, a role on this event.
create or replace function public.list_event_roles(p_kind text, p_event_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $fn$
begin
  if not public._event_is_owner(p_kind, p_event_id) then
    raise exception 'Only the owner or an admin can see this';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', r.id, 'role', r.role, 'email', r.invited_email, 'status',
      case when r.status = 'pending' and r.expires_at < now() then 'expired' else r.status end,
      'username', (select username from public.profiles where id = r.user_id),
      'created_at', r.created_at, 'expires_at', r.expires_at, 'keep_access', r.keep_access
    ) order by r.created_at desc)
    from public.event_roles r
    where r.kind = p_kind and r.event_id = p_event_id and r.status in ('pending', 'active', 'declined')
  ), '[]'::jsonb);
end $fn$;

-- Owner/admin revokes an invite or a moderator; a moderator can resign.
create or replace function public.revoke_event_role(p_role_id uuid) returns void
language plpgsql security definer set search_path = public as $fn$
declare r public.event_roles;
begin
  select * into r from public.event_roles where id = p_role_id;
  if r.id is null or r.status not in ('pending', 'active') then raise exception 'Not found'; end if;
  if not (public._event_is_owner(r.kind, r.event_id) or (r.role = 'moderator' and r.user_id = auth.uid())) then
    raise exception 'Not allowed';
  end if;
  update public.event_roles set status = 'revoked', responded_at = now() where id = r.id;
  insert into public.event_role_log (kind, event_id, actor, action, detail)
  values (r.kind, r.event_id, auth.uid(), 'revoke', jsonb_build_object('role', r.role, 'email', r.invited_email));
end $fn$;

-- What the invite page shows (works signed out so a new person sees what they were sent).
create or replace function public.get_event_invite(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $fn$
declare r public.event_roles; v_title text; v_inviter text;
begin
  select * into r from public.event_roles
   where token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'utf8')), 'hex');
  if r.id is null then return null; end if;
  if r.kind = 'live_vote' then select title into v_title from public.live_vote_events where id = r.event_id;
  else select title into v_title from public.school_elections where id = r.event_id; end if;
  select username into v_inviter from public.profiles where id = r.invited_by;
  return jsonb_build_object(
    'id', r.id, 'kind', r.kind, 'role', r.role, 'title', v_title, 'invited_by', v_inviter,
    'email', r.invited_email,
    'status', case when r.status = 'pending' and r.expires_at < now() then 'expired' else r.status end
  );
end $fn$;

-- Invites waiting for the signed-in user (matched on their verified email).
create or replace function public.my_event_invites() returns jsonb
language sql stable security definer set search_path = public as $fn$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id, 'kind', r.kind, 'event_id', r.event_id, 'role', r.role,
    'title', case when r.kind = 'live_vote'
                  then (select title from public.live_vote_events where id = r.event_id)
                  else (select title from public.school_elections where id = r.event_id) end,
    'invited_by', (select username from public.profiles where id = r.invited_by),
    'expires_at', r.expires_at
  ) order by r.created_at desc), '[]'::jsonb)
  from public.event_roles r
  where r.status = 'pending' and r.expires_at > now()
    and r.invited_email = public._my_verified_email()
$fn$;

-- Events I moderate.
create or replace function public.my_shared_events() returns jsonb
language sql stable security definer set search_path = public as $fn$
  select coalesce(jsonb_agg(jsonb_build_object(
    'kind', r.kind, 'event_id', r.event_id,
    'title', case when r.kind = 'live_vote'
                  then (select title from public.live_vote_events where id = r.event_id)
                  else (select title from public.school_elections where id = r.event_id) end,
    'status', case when r.kind = 'live_vote'
                   then (select status from public.live_vote_events where id = r.event_id)
                   else (select status from public.school_elections where id = r.event_id) end
  ) order by r.responded_at desc nulls last), '[]'::jsonb)
  from public.event_roles r
  where r.status = 'active' and r.role = 'moderator' and r.user_id = auth.uid()
$fn$;

-- Accept an invite, by id (from "Shared with me") or by emailed link token.
-- The signed-in account's verified email must equal the invited email exactly.
create or replace function public.accept_event_role(p_role_id uuid default null, p_token text default null)
returns jsonb
language plpgsql security definer set search_path = public as $fn$
declare
  r public.event_roles;
  v_email text := public._my_verified_email();
  v_prev uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if v_email is null then raise exception 'Verify your email address first'; end if;
  if p_token is not null then
    select * into r from public.event_roles
     where token_hash = encode(sha256(convert_to(p_token, 'utf8')), 'hex') for update;
  elsif p_role_id is not null then
    select * into r from public.event_roles where id = p_role_id for update;
  end if;
  if r.id is null then raise exception 'Invite not found'; end if;
  if r.status <> 'pending' then raise exception 'This invite is no longer active'; end if;
  if r.expires_at < now() then raise exception 'This invite has expired. Ask for a new one.'; end if;
  if r.invited_email <> v_email then
    raise exception 'This invite was sent to a different email address. Sign in with the invited email.';
  end if;
  if exists (select 1 from public.profiles where id = auth.uid() and coalesce(is_suspended, false)) then
    raise exception 'This account cannot accept right now';
  end if;

  if r.role = 'moderator' then
    update public.event_roles set status = 'active', user_id = auth.uid(), responded_at = now() where id = r.id;
    insert into public.event_role_log (kind, event_id, actor, action, detail)
    values (r.kind, r.event_id, auth.uid(), 'accept_moderator', jsonb_build_object('role_id', r.id));
    return jsonb_build_object('kind', r.kind, 'event_id', r.event_id, 'role', 'moderator');
  end if;

  -- Ownership transfer.
  if r.kind = 'live_vote' then
    select organizer_id into v_prev from public.live_vote_events where id = r.event_id for update;
    update public.live_vote_events set organizer_id = auth.uid() where id = r.event_id;
  else
    select organizer_id into v_prev from public.school_elections where id = r.event_id for update;
    update public.school_elections set organizer_id = auth.uid() where id = r.event_id;
    -- The races (votes) inside the election move with it.
    update public.live_vote_events set organizer_id = auth.uid() where election_id = r.event_id;
  end if;
  if v_prev is null then raise exception 'Event not found'; end if;

  -- The new owner no longer needs a moderator seat; other pending invites for this event are stale.
  update public.event_roles set status = 'revoked', responded_at = now()
   where kind = r.kind and event_id = r.event_id and id <> r.id
     and (status = 'pending' or (status = 'active' and user_id = auth.uid()));
  update public.event_roles set status = 'completed', user_id = auth.uid(), responded_at = now() where id = r.id;

  -- Previous owner keeps moderator access only if the sender asked for that.
  if r.keep_access and v_prev <> auth.uid() then
    insert into public.event_roles (kind, event_id, role, invited_email, user_id, status, token_hash, invited_by, responded_at)
    values (r.kind, r.event_id, 'moderator',
            coalesce((select lower(email) from auth.users where id = v_prev), 'unknown'),
            v_prev, 'active', encode(sha256(convert_to(gen_random_uuid()::text, 'utf8')), 'hex'), auth.uid(), now())
    on conflict do nothing;
  end if;

  insert into public.event_role_log (kind, event_id, actor, action, detail)
  values (r.kind, r.event_id, auth.uid(), 'transfer_owner',
          jsonb_build_object('from', v_prev, 'to', auth.uid(), 'kept_access', r.keep_access));
  return jsonb_build_object('kind', r.kind, 'event_id', r.event_id, 'role', 'owner');
end $fn$;

create or replace function public.decline_event_role(p_role_id uuid) returns void
language plpgsql security definer set search_path = public as $fn$
declare r public.event_roles;
begin
  select * into r from public.event_roles where id = p_role_id;
  if r.id is null or r.status <> 'pending' or r.invited_email is distinct from public._my_verified_email() then
    raise exception 'Invite not found';
  end if;
  update public.event_roles set status = 'declined', responded_at = now() where id = r.id;
  insert into public.event_role_log (kind, event_id, actor, action, detail)
  values (r.kind, r.event_id, auth.uid(), 'decline', jsonb_build_object('role', r.role));
end $fn$;

-- Lock down who can call what.
do $do$
declare f text;
begin
  foreach f in array array[
    'invite_event_role(text,uuid,text,text,boolean)', 'list_event_roles(text,uuid)', 'revoke_event_role(uuid)',
    'my_event_invites()', 'my_shared_events()', 'accept_event_role(uuid,text)', 'decline_event_role(uuid)',
    'event_role_for_me(text,uuid)', 'live_vote_can_moderate(uuid)', 'live_vote_is_mod(uuid)',
    'school_election_can_moderate(uuid)', '_event_is_owner(text,uuid)', '_my_verified_email()'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  -- The invite page can look up its own link before sign-in.
  revoke all on function public.get_event_invite(text) from public;
  grant execute on function public.get_event_invite(text) to anon, authenticated;
end $do$;

-- ===== 5. Let moderators run live votes (row rules + functions) =====
-- Row rules: wherever the organizer could manage a vote, a moderator can too.
-- Billing, sponsorship money and the events table itself stay owner-only.
do $do$
declare
  p record;
  v_q text;
  v_c text;
  v_sql text;
begin
  for p in
    select tablename, policyname, cmd, qual, with_check from pg_policies
    where schemaname = 'public'
      and (tablename, policyname) in (
        ('live_vote_criteria', 'live_vote_criteria_write_own_draft'),
        ('live_vote_judges', 'live_vote_judges_delete_own'),
        ('live_vote_judges', 'live_vote_judges_insert_own'),
        ('live_vote_judges', 'live_vote_judges_select_own'),
        ('live_vote_option_submissions', 'live_vote_option_submissions_select_organizer'),
        ('live_vote_options', 'live_vote_options_delete_own_draft'),
        ('live_vote_options', 'live_vote_options_insert_own_draft'),
        ('live_vote_options', 'live_vote_options_update_own_draft'),
        ('live_vote_sponsors', 'live_vote_sponsors_delete_own'),
        ('live_vote_sponsors', 'live_vote_sponsors_insert_own'),
        ('live_vote_sponsors', 'live_vote_sponsors_update_own'),
        ('live_vote_tally_feed', 'live_vote_tally_feed_select')
      )
  loop
    if coalesce(p.qual, '') like '%live_vote_can_moderate%' or coalesce(p.with_check, '') like '%live_vote_can_moderate%' then
      continue;
    end if;
    v_q := regexp_replace(p.qual, '\me\.organizer_id = \( SELECT auth\.uid\(\) AS uid\)', 'live_vote_can_moderate(e.id)', 'g');
    v_q := regexp_replace(v_q, '\me\.organizer_id = auth\.uid\(\)', 'live_vote_can_moderate(e.id)', 'g');
    v_c := regexp_replace(p.with_check, '\me\.organizer_id = \( SELECT auth\.uid\(\) AS uid\)', 'live_vote_can_moderate(e.id)', 'g');
    v_sql := format('alter policy %I on public.%I', p.policyname, p.tablename);
    if p.qual is not null then v_sql := v_sql || format(' using (%s)', v_q); end if;
    if p.with_check is not null then v_sql := v_sql || format(' with check (%s)', v_c); end if;
    execute v_sql;
  end loop;
end $do$;

-- Moderators can read (not edit) the events they moderate, including drafts and private ones.
do $do$
declare p record; v_q text;
begin
  select * into p from pg_policies
   where schemaname = 'public' and tablename = 'live_vote_events' and policyname = 'live_vote_events_select';
  if p.qual is not null and p.qual not like '%live_vote_is_mod%' then
    v_q := regexp_replace(p.qual, '\(organizer_id = \( SELECT auth\.uid\(\) AS uid\)\)',
                          '(organizer_id = ( SELECT auth.uid() AS uid) OR live_vote_is_mod(id))', 'g');
    if v_q = p.qual then raise exception 'live_vote_events_select did not change'; end if;
    execute format('alter policy live_vote_events_select on public.live_vote_events using (%s)', v_q);
  end if;
end $do$;

-- Functions: swap the "organizer only" test for the moderator-aware one.
do $do$
declare r record; v_def text; v_new text;
begin
  for r in
    select * from (values
      ('set_live_vote_listed',               'organizer_id\s*=\s*auth\.uid\(\)',                 'live_vote_can_moderate(live_vote_events.id)'),
      ('set_live_vote_collect_demographics', 'organizer_id\s*=\s*auth\.uid\(\)',                 'live_vote_can_moderate(live_vote_events.id)'),
      ('set_live_vote_collect_email',        'organizer_id\s*=\s*auth\.uid\(\)',                 'live_vote_can_moderate(live_vote_events.id)'),
      ('set_judged_results_released',        'organizer_id\s*=\s*auth\.uid\(\)',                 'live_vote_can_moderate(live_vote_events.id)'),
      ('get_judge_notes',                    'organizer_id\s*=\s*auth\.uid\(\)',                 'live_vote_can_moderate(live_vote_events.id)'),
      ('set_live_vote_branding',             'e\.organizer_id\s+is\s+distinct\s+from\s+auth\.uid\(\)', 'not live_vote_can_moderate(e.id)'),
      ('get_judged_results',                 'e\.organizer_id\s+is\s+distinct\s+from\s+auth\.uid\(\)', 'not live_vote_can_moderate(e.id)'),
      ('get_live_vote_analytics',            'e\.organizer_id\s+is\s+distinct\s+from\s+auth\.uid\(\)', 'not live_vote_can_moderate(e.id)'),
      ('get_live_vote_irv',                  'v_event\.organizer_id\s+is\s+distinct\s+from\s+auth\.uid\(\)', 'not live_vote_can_moderate(p_event_id)'),
      ('get_live_vote_room',                 'e\.organizer_id\s*=\s*auth\.uid\(\)',              'live_vote_can_moderate(e.id)'),
      ('get_live_vote_super_tally',          'e\.organizer_id\s*=\s*auth\.uid\(\)',              'live_vote_can_moderate(e.id)'),
      ('close_live_vote_event',              'v_organizer_id\s*<>\s*\(select auth\.uid\(\)\)',   'not live_vote_can_moderate(p_event_id)')
    ) as t(fn, pat, rep)
  loop
    select pg_get_functiondef(p.oid) into v_def
      from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = r.fn;
    if v_def is null then raise exception 'function % not found', r.fn; end if;
    if v_def like '%live_vote_can_moderate%' then continue; end if;
    v_new := regexp_replace(v_def, r.pat, r.rep, 'g');
    if v_new = v_def then raise exception 'no change made to %', r.fn; end if;
    execute v_new;
  end loop;
end $do$;

-- ===== 6. Earnings follow the owner who earned them =====
create or replace function public.get_super_vote_earnings(p_event_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $fn$
declare v_admin boolean := public.is_admin_user();
begin
  if not v_admin
     and not exists (select 1 from public.live_vote_events where id = p_event_id and organizer_id = auth.uid())
     and not exists (select 1 from public.live_vote_super_votes where event_id = p_event_id and earned_by = auth.uid()) then
    raise exception 'Only the organizer can view earnings';
  end if;
  return (select jsonb_build_object(
      'purchases', count(*), 'super_votes', coalesce(sum(quantity), 0),
      'gross_cents', coalesce(sum(amount_cents), 0),
      'organizer_share_cents', coalesce(sum(organizer_share_cents), 0))
    from public.live_vote_super_votes
    where event_id = p_event_id and (v_admin or earned_by = auth.uid()));
end $fn$;

-- The owner who earned a sponsorship can still see it (and its payout) after a hand-over.
drop policy if exists event_sponsorships_read on public.event_sponsorships;
create policy event_sponsorships_read on public.event_sponsorships for select using (
  is_admin_user()
  or earned_by = auth.uid()
  or exists (select 1 from public.live_vote_events e
             where e.id = event_sponsorships.event_id and e.organizer_id = auth.uid()
               and (event_sponsorships.earned_by is null or event_sponsorships.earned_by = e.organizer_id))
);
