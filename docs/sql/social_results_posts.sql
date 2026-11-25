-- Allow the two new automatic results posts: one per finished standalone game, and one daily scoreboard.
-- Run once; safe to run again.
alter table public.social_posts drop constraint if exists social_posts_kind_check;
alter table public.social_posts add constraint social_posts_kind_check
  check (kind in ('bout','bracket','livevote','predictions','trivia','bout_launch','paidbout_launch',
                  'predictions_launch','predbracket_launch','bracket_launch','game_result','daily_results'));
