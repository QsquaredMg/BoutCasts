-- Account deletion + block-user (App Store / Google Play requirements)
-- Safe to run more than once. Paste the whole file into the Supabase SQL editor.

-- 1) Keep financial records when a user is deleted: the person is removed
--    (the column becomes NULL) but the payment / payout rows stay for the books.
alter table public.paid_bouts alter column organizer_id drop not null;
alter table public.paid_bout_entries alter column user_id drop not null;

do $fn$
declare
  r record;
begin
  for r in
    select * from (values
      ('ad_events', 'user_id', 'ad_events_user_id_fkey'),
      ('event_sponsorships', 'organizer_paid_by', 'event_sponsorships_organizer_paid_by_fkey'),
      ('paid_bout_entries', 'user_id', 'paid_bout_entries_user_id_fkey'),
      ('paid_bout_invites', 'accepted_by', 'paid_bout_invites_accepted_by_fkey'),
      ('paid_bout_invites', 'invited_by', 'paid_bout_invites_invited_by_fkey'),
      ('paid_bout_payouts', 'paid_by', 'paid_bout_payouts_paid_by_fkey'),
      ('paid_bout_payouts', 'recipient_id', 'paid_bout_payouts_recipient_id_fkey'),
      ('paid_bouts', 'organizer_id', 'paid_bouts_organizer_id_fkey'),
      ('paid_bouts', 'reviewed_by', 'paid_bouts_reviewed_by_fkey')
    ) as t(tbl, col, con)
  loop
    execute format('alter table public.%I drop constraint if exists %I', r.tbl, r.con);
    execute format(
      'alter table public.%I add constraint %I foreign key (%I) references public.profiles(id) on delete set null',
      r.tbl, r.con, r.col
    );
  end loop;
end
$fn$;

-- 2) Reports can now target a user (profile)
do $fn$
declare
  cn text;
begin
  cn := (
    select conname from pg_constraint
    where conrelid = 'public.reports'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%target_type%'
    limit 1
  );
  if cn is not null then
    execute format('alter table public.reports drop constraint %I', cn);
  end if;
  alter table public.reports
    add constraint reports_target_type_check
    check (target_type in ('bout', 'comment', 'user'));
end
$fn$;

-- 3) Blocks
create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index if not exists user_blocks_blocked_idx on public.user_blocks (blocked_id);

alter table public.user_blocks enable row level security;

drop policy if exists user_blocks_select_own on public.user_blocks;
create policy user_blocks_select_own on public.user_blocks
  for select using (blocker_id = (select auth.uid()));

drop policy if exists user_blocks_insert_own on public.user_blocks;
create policy user_blocks_insert_own on public.user_blocks
  for insert with check (blocker_id = (select auth.uid()));

drop policy if exists user_blocks_delete_own on public.user_blocks;
create policy user_blocks_delete_own on public.user_blocks
  for delete using (blocker_id = (select auth.uid()));

-- Block someone: records the block and drops any follow in either direction.
create or replace function public.block_user(p_target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Sign in required';
  end if;
  if p_target is null or p_target = me then
    raise exception 'You can''t block yourself';
  end if;
  insert into public.user_blocks (blocker_id, blocked_id)
  values (me, p_target)
  on conflict do nothing;
  delete from public.follows
  where (follower_id = me and followed_id = p_target)
     or (follower_id = p_target and followed_id = me);
end
$fn$;

revoke all on function public.block_user(uuid) from public, anon;
grant execute on function public.block_user(uuid) to authenticated;

-- 4) Comments from people you blocked disappear for you
drop policy if exists bout_comments_select_all on public.bout_comments;
create policy bout_comments_select_all on public.bout_comments
  for select using (
    not exists (
      select 1 from public.user_blocks b
      where b.blocker_id = (select auth.uid())
        and b.blocked_id = bout_comments.user_id
    )
  );

-- 5) Blocked pairs can't follow or challenge each other (either direction)
create or replace function public.reject_if_blocked()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  a uuid;
  b uuid;
begin
  if tg_table_name = 'follows' then
    a := new.follower_id;
    b := new.followed_id;
  else
    a := new.challenger_id;
    b := new.opponent_id;
  end if;
  if exists (
    select 1 from public.user_blocks
    where (blocker_id = a and blocked_id = b)
       or (blocker_id = b and blocked_id = a)
  ) then
    raise exception 'You can''t interact with this user';
  end if;
  return new;
end
$fn$;

drop trigger if exists follows_reject_if_blocked on public.follows;
create trigger follows_reject_if_blocked
  before insert on public.follows
  for each row execute function public.reject_if_blocked();

drop trigger if exists challenges_reject_if_blocked on public.challenges;
create trigger challenges_reject_if_blocked
  before insert on public.challenges
  for each row execute function public.reject_if_blocked();

-- 6) What must be settled before an account can be deleted.
--    Server-only: called by /api/account/delete with the service role key.
create or replace function public.account_deletion_blockers(p_uid uuid)
returns text[]
language plpgsql
security definer
set search_path = public
as $fn$
declare
  res text[] := '{}';
  n int;
begin
  if coalesce((select is_admin from public.profiles where id = p_uid), false) then
    res := array_append(res, 'Admin accounts can''t be deleted here. Remove admin access first.'::text);
  end if;

  n := (select count(*) from public.paid_bouts
        where organizer_id = p_uid
          and status in ('pending_review', 'open', 'closed', 'settling'));
  if n > 0 then
    res := array_append(res, format('You have %s paid bout(s) still running. Finish or cancel them first.', n));
  end if;

  n := (select count(*) from public.paid_bout_entries e
        join public.paid_bouts b on b.id = e.bout_id
        where e.user_id = p_uid
          and e.status = 'paid'
          and b.status in ('open', 'closed', 'settling'));
  if n > 0 then
    res := array_append(res, format('You have %s paid entr(y/ies) in a bout that has not settled yet.', n));
  end if;

  n := (select count(*) from public.paid_bout_payouts
        where recipient_id = p_uid and status = 'pending');
  if n > 0 then
    res := array_append(res, format('You have %s payout(s) still pending.', n));
  end if;

  n := (select count(*) from public.organizations
        where owner_id = p_uid
          and stripe_subscription_id is not null
          and coalesce(status, '') in ('active', 'trialing', 'past_due'));
  if n > 0 then
    res := array_append(res, 'You own an organization with an active license. Contact support to transfer or close it.'::text);
  end if;

  return res;
end
$fn$;

revoke all on function public.account_deletion_blockers(uuid) from public, anon, authenticated;
grant execute on function public.account_deletion_blockers(uuid) to service_role;
