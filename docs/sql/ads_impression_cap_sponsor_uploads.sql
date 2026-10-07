-- Ad impression cap + sponsor self-serve creative uploads.
-- Additive and idempotent: safe to run more than once.

-- 1. Delivery target per creative ------------------------------------------
alter table public.ad_creatives
  add column if not exists max_impressions integer check (max_impressions is null or max_impressions > 0),
  add column if not exists impressions_served integer not null default 0,
  add column if not exists submitted_by uuid references public.profiles(id) on delete set null,
  add column if not exists review_note text;

-- Sponsor-submitted creatives wait for admin review before they can serve.
alter table public.ad_creatives drop constraint if exists ad_creatives_status_check;
alter table public.ad_creatives
  add constraint ad_creatives_status_check
  check (status = any (array['active','paused','ended','pending','rejected']));

-- Backfill the counter from the existing event log.
update public.ad_creatives c
set impressions_served = coalesce(e.n, 0)
from (
  select ad_id, count(*)::int n from public.ad_events where event_type = 'impression' group by ad_id
) e
where e.ad_id = c.id and c.impressions_served = 0;

create index if not exists ad_events_ad_type_idx on public.ad_events (ad_id, event_type);

-- 2. Atomic "serve one impression" -----------------------------------------
-- Claims one impression against the cap and logs it in the same statement, so
-- two simultaneous requests can never push a creative past its cap.
-- Returns true when the impression was granted.
create or replace function public.serve_ad_impression(p_ad_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  granted boolean;
begin
  update public.ad_creatives
  set impressions_served = impressions_served + 1
  where id = p_ad_id
    and status = 'active'
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now())
    and (max_impressions is null or impressions_served < max_impressions)
  returning true into granted;

  if granted is true then
    insert into public.ad_events (ad_id, event_type, user_id)
    values (p_ad_id, 'impression', auth.uid());
    return true;
  end if;
  return false;
end;
$$;
revoke all on function public.serve_ad_impression(uuid) from public;
grant execute on function public.serve_ad_impression(uuid) to anon, authenticated;

-- 3. Which sponsors can this signed-in user manage? ------------------------
-- A sponsor is managed by the confirmed account whose email matches the
-- contact email on that sponsor's approved application.
create or replace function public.my_sponsor_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select distinct a.sponsor_id
  from public.sponsor_applications a
  join auth.users u on lower(u.email) = lower(a.contact_email)
  where u.id = auth.uid()
    and u.email_confirmed_at is not null
    and a.status = 'approved'
    and a.sponsor_id is not null
$$;
revoke all on function public.my_sponsor_ids() from public;
-- anon needs execute too: the select policy below calls it (it returns nothing when signed out).
grant execute on function public.my_sponsor_ids() to anon, authenticated;

-- 4. Sponsors may add creatives (pending review) and remove their own pending ones
drop policy if exists ad_creatives_insert_sponsor on public.ad_creatives;
create policy ad_creatives_insert_sponsor on public.ad_creatives
  for insert to authenticated
  with check (
    sponsor_id in (select public.my_sponsor_ids())
    and status = 'pending'
    and submitted_by = auth.uid()
    and weight = 1
    and max_impressions is null
    and impressions_served = 0
  );

drop policy if exists ad_creatives_delete_sponsor on public.ad_creatives;
create policy ad_creatives_delete_sponsor on public.ad_creatives
  for delete to authenticated
  using (
    sponsor_id in (select public.my_sponsor_ids())
    and status in ('pending', 'rejected')
  );

-- Pending and rejected creatives are not public: only admins and the sponsor see them.
drop policy if exists ad_creatives_select_all on public.ad_creatives;
create policy ad_creatives_select_visible on public.ad_creatives
  for select
  using (
    status not in ('pending', 'rejected')
    or sponsor_id in (select public.my_sponsor_ids())
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );

-- 5. Uploads: sponsors write only under sponsors/<their sponsor id>/ -------
drop policy if exists ad_creatives_bucket_write_sponsor on storage.objects;
create policy ad_creatives_bucket_write_sponsor on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'ad-creatives'
    and (storage.foldername(name))[1] = 'sponsors'
    and (storage.foldername(name))[2] in (select x::text from public.my_sponsor_ids() x)
  );

-- 6. A sponsor's own delivery numbers --------------------------------------
create or replace function public.my_ad_stats()
returns table (ad_id uuid, impressions bigint, clicks bigint)
language sql
stable
security definer
set search_path = public
as $$
  select c.id,
         count(*) filter (where e.event_type = 'impression'),
         count(*) filter (where e.event_type = 'click')
  from public.ad_creatives c
  left join public.ad_events e on e.ad_id = c.id
  where c.sponsor_id in (select public.my_sponsor_ids())
  group by c.id
$$;
revoke all on function public.my_ad_stats() from public;
grant execute on function public.my_ad_stats() to authenticated;

-- 7. Ad uploads may be up to 105 MB (110100480 bytes) ---------------------------
update storage.buckets set file_size_limit = 110100480 where id = 'ad-creatives';

-- 8. Claim one impression against the cap (counter only) -----------------------
-- The serve route logs the analytics row itself (session, path, device,
-- country) and skips crawlers, so this only enforces the cap atomically.
create or replace function public.claim_ad_impression(p_ad_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  granted boolean;
begin
  update public.ad_creatives
  set impressions_served = impressions_served + 1
  where id = p_ad_id
    and status = 'active'
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now())
    and (max_impressions is null or impressions_served < max_impressions)
  returning true into granted;
  return coalesce(granted, false);
end;
$$;
revoke all on function public.claim_ad_impression(uuid) from public;
grant execute on function public.claim_ad_impression(uuid) to anon, authenticated;
