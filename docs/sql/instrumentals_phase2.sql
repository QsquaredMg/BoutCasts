-- Instrumental library, phase 2: let any signed-in producer submit a track for staff review.
-- Tracks still enter as 'pending' and are invisible to the public until an admin approves them.

drop policy if exists "instrumentals_insert" on public.instrumentals;
create policy "instrumentals_insert" on public.instrumentals
  for insert with check (uploaded_by = auth.uid() and status = 'pending');

drop policy if exists "instrumentals_bucket_insert_own" on storage.objects;
create policy "instrumentals_bucket_insert_own" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'instrumentals'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
