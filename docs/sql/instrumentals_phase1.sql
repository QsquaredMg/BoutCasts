-- Instrumental library, phase 1. Review before running; adjust role checks to match your existing policies.

create table if not exists public.instrumentals (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  producer_name text not null,
  producer_id uuid references auth.users(id) on delete set null,
  file_url text not null,
  bpm integer,
  musical_key text,
  genre text,
  duration_seconds integer,
  license_type text not null default 'original'
    check (license_type in ('original', 'royalty_free', 'licensed_to_boutcasts')),
  license_source_url text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'removed')),
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.bouts
  add column if not exists instrumental_id uuid references public.instrumentals(id) on delete set null;

alter table public.instrumentals enable row level security;

-- Helper checks (security definer so RLS on profiles/categories doesn't interfere).
create or replace function public.is_admin_user() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.is_organizer_user() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.categories where owner_id = auth.uid())
$$;

-- Read: approved tracks are public; uploaders see their own; admins see everything.
create policy "instrumentals_read" on public.instrumentals
  for select using (status = 'approved' or uploaded_by = auth.uid() or public.is_admin_user());

-- Insert: staff (admins) and organizers only, always as pending.
create policy "instrumentals_insert" on public.instrumentals
  for insert with check (
    uploaded_by = auth.uid() and status = 'pending'
    and (public.is_admin_user() or public.is_organizer_user())
  );

-- Admins approve / reject / remove.
create policy "instrumentals_admin_update" on public.instrumentals
  for update using (public.is_admin_user()) with check (public.is_admin_user());

create policy "instrumentals_admin_delete" on public.instrumentals
  for delete using (public.is_admin_user());

-- Storage bucket (public read, 50 MB, audio only).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('instrumentals', 'instrumentals', true, 52428800,
        array['audio/mpeg','audio/wav','audio/x-wav','audio/mp4','audio/x-m4a'])
on conflict (id) do nothing;

create policy "instrumentals_bucket_select_all" on storage.objects
  for select using (bucket_id = 'instrumentals');

create policy "instrumentals_bucket_insert_own" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'instrumentals'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (public.is_admin_user() or public.is_organizer_user())
  );

create policy "instrumentals_bucket_delete_admin" on storage.objects
  for delete using (bucket_id = 'instrumentals' and public.is_admin_user());
