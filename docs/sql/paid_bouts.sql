-- Paid Bouts: competitions with an entry fee, published rules, invites,
-- and a fixed payout order.
--
-- Money rules (these are the published terms; the code and this file agree):
--   * Entrants pay the entry fee by card at checkout.
--   * BoutCasts keeps platform_fee_pct (20) percent of all entry fees.
--   * Prizes are fixed amounts, set before the bout opens, and are paid next.
--   * The organizer receives whatever is left, and only after the platform
--     fee and every prize is paid.
--   * A bout opens only if the prizes are fully covered at the minimum number
--     of entries. If the minimum isn't reached, the bout is cancelled and every
--     entrant is refunded in full.
--
-- All writes go through the server (service role) or the SECURITY DEFINER
-- functions below; the tables only expose read policies.
-- Additive and idempotent.

create table if not exists public.paid_bouts (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.profiles(id),
  created_by_admin boolean not null default false,
  title text not null check (char_length(title) between 3 and 120),
  description text check (description is null or char_length(description) <= 2000),
  rules text not null check (char_length(rules) between 40 and 8000),
  judging text not null check (char_length(judging) between 20 and 2000),
  entry_fee_cents integer not null check (entry_fee_cents between 500 and 50000),
  platform_fee_pct integer not null default 20 check (platform_fee_pct between 0 and 100),
  min_entries integer not null check (min_entries >= 2),
  max_entries integer check (max_entries is null or max_entries >= min_entries),
  entry_deadline timestamptz not null,
  invite_only boolean not null default false,
  status text not null default 'draft'
    check (status in ('draft','pending_review','open','closed','settling','settled','cancelled')),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  review_note text,
  cancelled_reason text,
  created_at timestamptz not null default now()
);
create index if not exists paid_bouts_status_idx on public.paid_bouts (status, entry_deadline);
create index if not exists paid_bouts_organizer_idx on public.paid_bouts (organizer_id);

create table if not exists public.paid_bout_prizes (
  id uuid primary key default gen_random_uuid(),
  bout_id uuid not null references public.paid_bouts(id) on delete cascade,
  place integer not null check (place between 1 and 10),
  amount_cents integer not null check (amount_cents > 0),
  winner_entry_id uuid,
  unique (bout_id, place)
);

create table if not exists public.paid_bout_entries (
  id uuid primary key default gen_random_uuid(),
  bout_id uuid not null references public.paid_bouts(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  entry_title text check (entry_title is null or char_length(entry_title) <= 120),
  entry_url text check (entry_url is null or entry_url ~* '^https?://'),
  fee_cents integer not null check (fee_cents > 0),
  status text not null default 'pending' check (status in ('pending','paid','refunded')),
  rules_accepted_at timestamptz not null default now(),
  stripe_session_id text,
  stripe_payment_intent text,
  invite_id uuid,
  paid_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  unique (bout_id, user_id)
);
create index if not exists paid_bout_entries_bout_idx on public.paid_bout_entries (bout_id, status);

alter table public.paid_bout_prizes
  drop constraint if exists paid_bout_prizes_winner_fk;
alter table public.paid_bout_prizes
  add constraint paid_bout_prizes_winner_fk
  foreign key (winner_entry_id) references public.paid_bout_entries(id);

create table if not exists public.paid_bout_invites (
  id uuid primary key default gen_random_uuid(),
  bout_id uuid not null references public.paid_bouts(id) on delete cascade,
  email text not null check (email = lower(email) and email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  status text not null default 'sent' check (status in ('sent','accepted')),
  invited_by uuid references public.profiles(id),
  accepted_by uuid references public.profiles(id),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (bout_id, email)
);

alter table public.paid_bout_entries
  drop constraint if exists paid_bout_entries_invite_fk;
alter table public.paid_bout_entries
  add constraint paid_bout_entries_invite_fk
  foreign key (invite_id) references public.paid_bout_invites(id) on delete set null;

-- The settlement ledger. seq is the payout order: platform fee, then prizes by
-- place, then the organizer last.
create table if not exists public.paid_bout_payouts (
  id uuid primary key default gen_random_uuid(),
  bout_id uuid not null references public.paid_bouts(id) on delete cascade,
  seq integer not null,
  kind text not null check (kind in ('platform_fee','prize','organizer')),
  place integer,
  recipient_id uuid references public.profiles(id),
  entry_id uuid references public.paid_bout_entries(id),
  amount_cents integer not null check (amount_cents >= 0),
  status text not null default 'pending' check (status in ('pending','paid')),
  method text,
  note text,
  paid_by uuid references public.profiles(id),
  paid_at timestamptz,
  unique (bout_id, seq)
);

-- Funding rule -------------------------------------------------------------
-- Entry-fee income left after the platform fee, at a given number of entries.
create or replace function public.paid_bout_net_after_fee(p_gross integer, p_pct integer)
returns integer
language sql
immutable
as $$ select p_gross - (((p_gross::bigint * p_pct) + 50) / 100)::integer $$;

create or replace function public.paid_bouts_guard()
returns trigger
language plpgsql
as $$
declare
  prizes integer;
begin
  if new.status = 'open' and (tg_op = 'INSERT' or old.status is distinct from 'open') then
    select coalesce(sum(amount_cents), 0) into prizes from public.paid_bout_prizes where bout_id = new.id;
    if prizes <= 0 then
      raise exception 'A paid bout needs at least one prize before it can open';
    end if;
    if prizes > public.paid_bout_net_after_fee(new.min_entries * new.entry_fee_cents, new.platform_fee_pct) then
      raise exception 'Prizes are not covered at the minimum number of entries';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists paid_bouts_guard_trg on public.paid_bouts;
create trigger paid_bouts_guard_trg before insert or update on public.paid_bouts
  for each row execute function public.paid_bouts_guard();

-- Confirm a paid entry atomically (called by the Stripe webhook) -------------
-- Locks the bout so two last-seat payments can't both succeed.
-- Returns 'paid', 'full' or 'closed'. 'full' and 'closed' mean the caller must refund.
create or replace function public.paid_bout_confirm_entry(p_entry uuid, p_payment_intent text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  e public.paid_bout_entries;
  b public.paid_bouts;
  taken integer;
begin
  select * into e from public.paid_bout_entries where id = p_entry for update;
  if not found then return 'closed'; end if;
  if e.status = 'paid' then return 'paid'; end if;
  select * into b from public.paid_bouts where id = e.bout_id for update;
  if b.status <> 'open' or now() > b.entry_deadline then return 'closed'; end if;
  select count(*) into taken from public.paid_bout_entries where bout_id = b.id and status = 'paid';
  if b.max_entries is not null and taken >= b.max_entries then return 'full'; end if;
  update public.paid_bout_entries
    set status = 'paid', paid_at = now(), stripe_payment_intent = p_payment_intent
    where id = e.id;
  if e.invite_id is not null then
    update public.paid_bout_invites set status = 'accepted', accepted_by = e.user_id, accepted_at = now()
      where id = e.invite_id;
  end if;
  return 'paid';
end;
$$;
revoke all on function public.paid_bout_confirm_entry(uuid, text) from public, anon, authenticated;

-- Settlement ----------------------------------------------------------------
-- Writes the payout ledger for a closed bout. Order: platform fee, prizes by
-- place, organizer last. The platform fee is retained by BoutCasts, so its row
-- is recorded as paid; prizes and the organizer's share start pending.
create or replace function public.paid_bout_settle(p_bout uuid)
returns table (out_kind text, out_place integer, out_amount_cents integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  b public.paid_bouts;
  gross integer;
  fee integer;
  prizes integer;
  remainder integer;
  n integer := 1;
  pr record;
begin
  select * into b from public.paid_bouts where id = p_bout for update;
  if not found then raise exception 'Bout not found'; end if;
  if not (public.is_admin_user() or b.organizer_id = auth.uid()) then
    raise exception 'Only the organizer or an admin can settle this bout';
  end if;
  if b.status <> 'closed' then raise exception 'Only a closed bout can be settled'; end if;
  if exists (select 1 from public.paid_bout_prizes where bout_id = b.id and winner_entry_id is null) then
    raise exception 'Choose a winner for every prize first';
  end if;

  select coalesce(sum(fee_cents), 0) into gross from public.paid_bout_entries where bout_id = b.id and status = 'paid';
  fee := (((gross::bigint * b.platform_fee_pct) + 50) / 100)::integer;
  select coalesce(sum(amount_cents), 0) into prizes from public.paid_bout_prizes where bout_id = b.id;
  remainder := gross - fee - prizes;
  if remainder < 0 then raise exception 'Entry fees do not cover the prizes'; end if;

  insert into public.paid_bout_payouts (bout_id, seq, kind, amount_cents, status, method, paid_at)
    values (b.id, n, 'platform_fee', fee, 'paid', 'retained', now());
  for pr in
    select p.place, p.amount_cents, p.winner_entry_id, e.user_id
    from public.paid_bout_prizes p join public.paid_bout_entries e on e.id = p.winner_entry_id
    where p.bout_id = b.id order by p.place
  loop
    n := n + 1;
    insert into public.paid_bout_payouts (bout_id, seq, kind, place, recipient_id, entry_id, amount_cents)
      values (b.id, n, 'prize', pr.place, pr.user_id, pr.winner_entry_id, pr.amount_cents);
  end loop;
  n := n + 1;
  insert into public.paid_bout_payouts (bout_id, seq, kind, recipient_id, amount_cents)
    values (b.id, n, 'organizer', b.organizer_id, remainder);

  update public.paid_bouts set status = 'settling' where id = b.id;

  return query select x.kind, x.place, x.amount_cents from public.paid_bout_payouts x where x.bout_id = b.id order by x.seq;
end;
$$;
revoke all on function public.paid_bout_settle(uuid) from public, anon;
grant execute on function public.paid_bout_settle(uuid) to authenticated;

-- Admin records that a payout was sent. The organizer's row can only be marked
-- paid once the fee and every prize are paid. When the last row is paid the
-- bout is marked settled.
create or replace function public.paid_bout_mark_paid(p_payout uuid, p_method text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  po public.paid_bout_payouts;
begin
  if not public.is_admin_user() then raise exception 'Admins only'; end if;
  select * into po from public.paid_bout_payouts where id = p_payout for update;
  if not found then raise exception 'Payout not found'; end if;
  if po.status = 'paid' then return; end if;
  if coalesce(trim(p_method), '') = '' then raise exception 'Say how it was paid (for example Zelle, ACH, check)'; end if;
  if po.kind = 'organizer' and exists (
    select 1 from public.paid_bout_payouts o
    where o.bout_id = po.bout_id and o.kind <> 'organizer' and o.status <> 'paid'
  ) then
    raise exception 'Pay the platform fee and every prize before paying the organizer';
  end if;
  update public.paid_bout_payouts
    set status = 'paid', method = trim(p_method), note = p_note, paid_by = auth.uid(), paid_at = now()
    where id = po.id;
  if not exists (select 1 from public.paid_bout_payouts where bout_id = po.bout_id and status <> 'paid') then
    update public.paid_bouts set status = 'settled' where id = po.bout_id;
  end if;
end;
$$;
revoke all on function public.paid_bout_mark_paid(uuid, text, text) from public, anon;
grant execute on function public.paid_bout_mark_paid(uuid, text, text) to authenticated;

-- Public numbers for a bout page (entry count without exposing entrants) -----
create or replace function public.paid_bout_public_stats(p_bout uuid)
returns table (paid_entries integer, gross_cents integer)
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer, coalesce(sum(fee_cents), 0)::integer
  from public.paid_bout_entries where bout_id = p_bout and status = 'paid'
$$;
grant execute on function public.paid_bout_public_stats(uuid) to anon, authenticated;

-- Row-level security: reads only --------------------------------------------
alter table public.paid_bouts enable row level security;
alter table public.paid_bout_prizes enable row level security;
alter table public.paid_bout_entries enable row level security;
alter table public.paid_bout_invites enable row level security;
alter table public.paid_bout_payouts enable row level security;

drop policy if exists paid_bouts_read on public.paid_bouts;
create policy paid_bouts_read on public.paid_bouts for select using (
  status in ('open','closed','settling','settled')
  or organizer_id = auth.uid()
  or public.is_admin_user()
);

drop policy if exists paid_bout_prizes_read on public.paid_bout_prizes;
create policy paid_bout_prizes_read on public.paid_bout_prizes for select using (
  exists (select 1 from public.paid_bouts b where b.id = bout_id)
);

drop policy if exists paid_bout_entries_read on public.paid_bout_entries;
create policy paid_bout_entries_read on public.paid_bout_entries for select using (
  user_id = auth.uid()
  or public.is_admin_user()
  or exists (select 1 from public.paid_bouts b where b.id = bout_id and b.organizer_id = auth.uid())
);

drop policy if exists paid_bout_invites_read on public.paid_bout_invites;
create policy paid_bout_invites_read on public.paid_bout_invites for select using (
  public.is_admin_user()
  or exists (select 1 from public.paid_bouts b where b.id = bout_id and b.organizer_id = auth.uid())
);

drop policy if exists paid_bout_payouts_read on public.paid_bout_payouts;
create policy paid_bout_payouts_read on public.paid_bout_payouts for select using (
  public.is_admin_user()
  or recipient_id = auth.uid()
  or exists (select 1 from public.paid_bouts b where b.id = bout_id and b.organizer_id = auth.uid())
);
