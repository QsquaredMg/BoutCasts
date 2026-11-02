-- Student Roles: election class vs voting group, and voter surveys. Run after election_roles_phase2.sql. Safe to re-run.

-- Labels shown to the teacher: the class that runs the election and the class or grade that votes.
alter table public.school_elections add column if not exists election_class_label text check (election_class_label is null or char_length(election_class_label) <= 80);
alter table public.school_elections add column if not exists voting_group_label text check (voting_group_label is null or char_length(voting_group_label) <= 80);
alter table public.school_elections add column if not exists grade_level text check (grade_level in ('middle', 'high'));

-- A candidate can cite the survey finding their platform is built on ("Backed by survey").
alter table public.election_candidate_profiles add column if not exists survey_finding text check (survey_finding is null or char_length(survey_finding) <= 200);

-- One survey per election. Questions are copied from the starter bank when the teacher sets it up.
create table if not exists public.election_surveys (
  election_id uuid primary key references public.school_elections(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'open', 'closed')),
  questions jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.election_surveys enable row level security;

-- Anonymous answers: no names, no student IDs. Only grade is kept, and breakdowns need at least 5 responses.
create table if not exists public.election_survey_responses (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.school_elections(id) on delete cascade,
  source text not null default 'link' check (source in ('link', 'kiosk', 'paper')),
  grade text check (grade is null or char_length(grade) <= 20),
  answers jsonb not null,
  open_hidden boolean not null default false,
  ip_hash text,
  created_at timestamptz not null default now()
);
create index if not exists election_survey_responses_idx on public.election_survey_responses (election_id, created_at desc);
alter table public.election_survey_responses enable row level security;
-- No policies on these tables: only the server (service role) reads or writes them.
