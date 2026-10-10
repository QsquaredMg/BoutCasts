-- Social posting queue: finished bouts, brackets, live votes, prediction slates and
-- trivia games become a ready-to-post result (card + caption + top 10) that an admin
-- approves before it goes to the BoutCasts Facebook Page and Instagram.
-- Run once in the Supabase SQL editor.

create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('bout','bracket','livevote','predictions','trivia')),
  source_id text not null,
  title text not null,
  winner text,
  top10 jsonb not null default '[]'::jsonb,
  caption_facebook text not null,
  caption_instagram text not null,
  status text not null default 'pending' check (status in ('pending','posted','partial','failed','skipped')),
  results jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now(),
  posted_at timestamptz,
  unique (kind, source_id)
);
create index if not exists social_posts_status_idx on public.social_posts(status, created_at desc);

create table if not exists public.social_settings (
  id int primary key default 1 check (id = 1),
  mode text not null default 'approve' check (mode in ('off','approve','auto')),
  hashtags text not null default '#BoutCasts #Vote #Versus'
);
insert into public.social_settings (id) values (1) on conflict do nothing;

alter table public.social_posts enable row level security;
alter table public.social_settings enable row level security;

drop policy if exists social_posts_admin_all on public.social_posts;
create policy social_posts_admin_all on public.social_posts
  for all using (public.pred_is_admin()) with check (public.pred_is_admin());

drop policy if exists social_settings_admin_all on public.social_settings;
create policy social_settings_admin_all on public.social_settings
  for all using (public.pred_is_admin()) with check (public.pred_is_admin());
