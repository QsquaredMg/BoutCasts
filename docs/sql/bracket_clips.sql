-- Video clips on crowd-vote bracket contestants.
-- Each contestant can carry a clip (an uploaded video or a YouTube/Vimeo/TikTok/Instagram/Google Drive link).
-- The clip lives on the contestant, so it follows them as they advance round to round.
-- Safe to run more than once. Run before deploying the matching app code.

alter table public.pred_bracket_teams add column if not exists clip_url text;
alter table public.pred_bracket_teams drop constraint if exists pred_bracket_teams_clip_url_check;
alter table public.pred_bracket_teams add constraint pred_bracket_teams_clip_url_check
  check (clip_url is null or clip_url ~ '^https://[^ ]{1,600}$');

-- Every function that creates contestants now also stores the clip passed in p_teams[].clip.
do $do$
declare r record; d text; n int := 0;
begin
  for r in select p.oid from pg_proc p
           where p.pronamespace = 'public'::regnamespace
             and p.prosrc like '%insert into pred_bracket_teams(id, bracket_id, seed, name, logo)%'
             and p.prosrc not like '%clip_url%'
  loop
    d := pg_get_functiondef(r.oid);
    d := regexp_replace(
      d,
      'insert into pred_bracket_teams\(id, bracket_id, seed, name, logo\)(\s*)values \(tid, sid, i, btrim\(t ->> ''name''\), nullif\(btrim\(coalesce\(t ->> ''logo'',''''\)\),''''\)\)',
      'insert into pred_bracket_teams(id, bracket_id, seed, name, logo, clip_url)\1values (tid, sid, i, btrim(t ->> ''name''), nullif(btrim(coalesce(t ->> ''logo'','''')),''''), case when t ->> ''clip'' ~ ''^https://[^ ]{1,600}$'' then t ->> ''clip'' end)'
    );
    if d like '%clip_url%' then execute d; n := n + 1; end if;
  end loop;
  raise notice 'functions updated: %', n;
end $do$;
