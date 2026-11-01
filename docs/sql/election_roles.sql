-- Student Roles for School Elections (annual plan, $750/year).
-- Run once in the Supabase SQL editor. Safe to re-run.

-- 1. The plan: one row per organizer, mirrored from Stripe by the webhook (kind = school_roles).
create table if not exists public.school_role_plans (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'incomplete',
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.school_role_plans enable row level security;
drop policy if exists "owner reads own role plan" on public.school_role_plans;
create policy "owner reads own role plan" on public.school_role_plans for select using (auth.uid() = user_id);

-- 'comp' status = a plan granted by a BoutCasts admin (pilots, grants, partner schools).
create or replace function public.school_roles_active(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.school_role_plans p
    where p.user_id = p_user
      and (
        p.status = 'comp'
        or (p.status in ('active', 'trialing', 'past_due') and (p.current_period_end is null or p.current_period_end > now()))
      )
  );
$$;
revoke all on function public.school_roles_active(uuid) from public, anon, authenticated;
grant execute on function public.school_roles_active(uuid) to service_role;

-- 2. Seats: widen the role list. Existing seats (check_in, judge, observer) are unchanged.
alter table public.election_staff drop constraint if exists election_staff_role_chk;
alter table public.election_staff add constraint election_staff_role_chk check (role in (
  'check_in', 'judge', 'observer',
  'commission_chair', 'commission_secretary', 'commission_member', 'registrar',
  'qualification_clerk', 'candidate', 'campaign_manager', 'debate_moderator', 'press',
  'chief_poll_worker', 'poll_worker',
  'tabulator', 'auditor', 'canvass_member', 'announcer', 'ombudsman'
));

-- 3. Who did what: every role sign-in and seat change. Notes never name students.
create table if not exists public.election_role_events (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.school_elections(id) on delete cascade,
  staff_id uuid references public.election_staff(id) on delete set null,
  role text,
  action text not null check (action in ('seat_created', 'seat_revoked', 'sign_in', 'bad_code')),
  label text check (label is null or char_length(label) <= 60),
  created_at timestamptz not null default now()
);
create index if not exists election_role_events_idx on public.election_role_events (election_id, created_at desc);
alter table public.election_role_events enable row level security;
-- No policies: only the server (service role) reads or writes this table.
