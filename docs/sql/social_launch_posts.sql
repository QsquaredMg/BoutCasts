-- Launch posts for paid bouts and admin-created bouts, plus school social handles.
-- Run after social_posts.sql, once, in the Supabase SQL editor.

-- 1. New kinds of queued post.
alter table public.social_posts drop constraint if exists social_posts_kind_check;
alter table public.social_posts add constraint social_posts_kind_check
  check (kind in ('bout','bracket','livevote','predictions','trivia','bout_launch','paidbout_launch'));

-- 2. School / team social accounts (edited on Admin > Teams).
alter table public.team_directory add column if not exists instagram_handle text;
alter table public.team_directory add column if not exists facebook_page text;

-- 3. Remember which bouts an admin created, so only those get an automatic launch post.
alter table public.bouts add column if not exists created_by_admin boolean not null default false;

create or replace function public.bouts_mark_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  new.created_by_admin := coalesce(public.pred_is_admin(), false);
  return new;
end
$fn$;

drop trigger if exists bouts_mark_admin_ins on public.bouts;
create trigger bouts_mark_admin_ins
  before insert on public.bouts
  for each row execute function public.bouts_mark_admin();
