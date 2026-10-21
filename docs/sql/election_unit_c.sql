-- Civics unit, part C: poll worker roles, the incident log, and debate / forum mode.
-- Run after election_unit_b.sql. Safe to run more than once.

-- Poll worker roles. check_in and judge open the booth desk; judge can also resolve incidents and moderate the forum;
-- observer sees no roster and can only log and read incidents. Existing seats stay check_in.
alter table public.election_staff add column if not exists role text not null default 'check_in';
alter table public.election_staff drop constraint if exists election_staff_role_chk;
alter table public.election_staff add constraint election_staff_role_chk check (role in ('check_in', 'judge', 'observer'));

alter table public.school_elections add column if not exists forum_enabled boolean not null default false;

-- Incident log. Notes must not name students; the server only stores what workers type.
create table if not exists public.election_incidents (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.school_elections(id) on delete cascade,
  staff_id uuid references public.election_staff(id) on delete set null,
  reporter_label text not null check (char_length(btrim(reporter_label)) between 1 and 60),
  kind text not null check (kind in ('voter_issue', 'equipment', 'electioneering', 'safety', 'other')),
  note text not null check (char_length(btrim(note)) between 1 and 500),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by text check (resolved_by is null or char_length(resolved_by) <= 60),
  resolution text check (resolution is null or char_length(resolution) <= 300)
);
create index if not exists election_incidents_election_idx on public.election_incidents (election_id, created_at desc);
alter table public.election_incidents enable row level security;

-- Debate and forum questions from students, held until a teacher approves them.
create table if not exists public.election_forum_questions (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.school_elections(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 10 and 200),
  asker text check (asker is null or char_length(asker) <= 40),
  status text not null default 'pending' check (status in ('pending', 'approved', 'asked', 'hidden')),
  ip_hash text,
  created_at timestamptz not null default now()
);
create index if not exists election_forum_questions_election_idx on public.election_forum_questions (election_id, status, created_at);
alter table public.election_forum_questions enable row level security;

-- Anyone with the link may submit a question. Limits: 3 per person per 10 minutes, 100 waiting per election.
create or replace function public.submit_forum_question(p_election_id uuid, p_body text, p_asker text, p_ip_hash text)
returns jsonb language plpgsql security definer set search_path to 'public' as $fn$
declare el school_elections; b text := btrim(coalesce(p_body, '')); a text := nullif(btrim(coalesce(p_asker, '')), '');
begin
  select * into el from school_elections where id = p_election_id;
  if not found or not el.forum_enabled then return jsonb_build_object('ok', false, 'error', 'not_open'); end if;
  if el.status = 'closed' then return jsonb_build_object('ok', false, 'error', 'closed'); end if;
  if char_length(b) < 10 or char_length(b) > 200 or (a is not null and char_length(a) > 40) then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;
  if p_ip_hash is not null and (select count(*) from election_forum_questions
       where election_id = p_election_id and ip_hash = p_ip_hash and created_at > now() - interval '10 minutes') >= 3 then
    return jsonb_build_object('ok', false, 'error', 'slow_down');
  end if;
  if (select count(*) from election_forum_questions where election_id = p_election_id and status = 'pending') >= 100 then
    return jsonb_build_object('ok', false, 'error', 'queue_full');
  end if;
  insert into election_forum_questions (election_id, body, asker, ip_hash) values (p_election_id, b, a, p_ip_hash);
  return jsonb_build_object('ok', true);
end $fn$;

revoke all on function public.submit_forum_question(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.submit_forum_question(uuid, text, text, text) to service_role;
