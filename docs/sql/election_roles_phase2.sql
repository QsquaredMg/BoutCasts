-- Student Roles, phase 2: before-voting tools. Run after docs/sql/election_roles.sql. Safe to re-run.

-- A candidate or campaign manager seat is tied to exactly one candidate.
alter table public.election_staff add column if not exists option_id uuid references public.live_vote_options(id) on delete set null;

-- Commission: advice to the Supervisor, and the secretary's minutes. The Supervisor records the final decision.
create table if not exists public.election_commission_items (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.school_elections(id) on delete cascade,
  staff_id uuid references public.election_staff(id) on delete set null,
  author_label text not null check (char_length(btrim(author_label)) between 1 and 60),
  kind text not null check (kind in ('advice', 'minutes')),
  topic text not null default 'other' check (topic in ('eligibility', 'calendar', 'dispute', 'other')),
  subject text not null check (char_length(btrim(subject)) between 1 and 120),
  body text not null check (char_length(btrim(body)) between 1 and 1500),
  option_id uuid references public.live_vote_options(id) on delete set null,
  decision text check (decision is null or char_length(decision) <= 400),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists election_commission_items_idx on public.election_commission_items (election_id, created_at desc);
alter table public.election_commission_items enable row level security;

-- Qualification clerk: one filing check per candidate. The Supervisor's decision is recorded beside it.
create table if not exists public.election_filings (
  option_id uuid primary key references public.live_vote_options(id) on delete cascade,
  election_id uuid not null references public.school_elections(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'complete', 'incomplete')),
  note text check (note is null or char_length(note) <= 300),
  clerk_label text check (clerk_label is null or char_length(clerk_label) <= 60),
  supervisor_decision text check (supervisor_decision in ('approved', 'declined')),
  updated_at timestamptz not null default now()
);
create index if not exists election_filings_idx on public.election_filings (election_id);
alter table public.election_filings enable row level security;

-- Student press: articles (published only after the Supervisor approves) and fact-check flags (seen by the Commission).
create table if not exists public.election_press_posts (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.school_elections(id) on delete cascade,
  staff_id uuid references public.election_staff(id) on delete set null,
  author_label text not null check (char_length(btrim(author_label)) between 1 and 60),
  kind text not null check (kind in ('article', 'claim_flag')),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  source_url text check (source_url is null or (char_length(source_url) <= 300 and source_url ~* '^https?://')),
  option_id uuid references public.live_vote_options(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'published', 'hidden')),
  created_at timestamptz not null default now()
);
create index if not exists election_press_posts_idx on public.election_press_posts (election_id, status, created_at desc);
alter table public.election_press_posts enable row level security;
-- No policies on these tables: only the server (service role) reads or writes them.
