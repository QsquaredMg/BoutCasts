-- Launch posts for new public prediction games, prediction brackets and bout brackets.
-- Run after social_launch_posts.sql, once, in the Supabase SQL editor. Safe to re-run.
-- Only widens the allowed post kinds; nothing is deleted or changed.

alter table public.social_posts drop constraint if exists social_posts_kind_check;
alter table public.social_posts add constraint social_posts_kind_check
  check (kind in (
    'bout','bracket','livevote','predictions','trivia','bout_launch','paidbout_launch',
    'predictions_launch','predbracket_launch','bracket_launch'
  ));
