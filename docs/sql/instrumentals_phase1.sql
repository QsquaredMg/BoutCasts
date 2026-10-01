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

-- Anyone can read approved tracks; uploaders can read their own.
create policy "instrumentals_read" on public.instrumentals
  for select using (status = 'approved' or uploaded_by = auth.uid());

-- Signed-in users can add tracks as pending. Staff approval happens via the admin UI / SQL.
create policy "instrumentals_insert" on public.instrumentals
  for insert with check (uploaded_by = auth.uid() and status = 'pending');

-- NOTE: add an UPDATE policy for admins to approve/reject/remove, using whatever
-- admin check the rest of the app uses (for example the same one behind moderate_submission).

-- Storage: create a public-read bucket named "instrumentals" (audio/mpeg, audio/wav, audio/mp4)
-- and allow authenticated uploads under "<user_id>/..." paths, mirroring "submission-clips".
