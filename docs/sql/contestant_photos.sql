-- Contestant photo shown on bout share cards (for uploaded/embedded clips with no thumbnail)
alter table public.submissions add column if not exists photo_url text;
