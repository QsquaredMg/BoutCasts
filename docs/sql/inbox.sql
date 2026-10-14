-- Admin inbox: mail sent to the BoutCasts support address, readable and answerable from /admin/inbox.
-- Run once in the Supabase SQL editor. Safe to re-run.
-- Nobody but the server (service role) can read these tables: row level security is on with no policies.

create table if not exists public.inbox_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id text not null,
  direction text not null check (direction in ('in', 'out')),
  resend_id text unique,
  message_id text,
  in_reply_to text,
  from_addr text,
  to_addrs text[] not null default '{}',
  subject text,
  text_body text,
  html_body text,
  attachments jsonb not null default '[]'::jsonb,
  authentication jsonb,
  received_at timestamptz not null default now(),
  read_at timestamptz,
  sent_by uuid references auth.users(id) on delete set null
);
create index if not exists inbox_messages_thread_idx on public.inbox_messages (thread_id, received_at);
create index if not exists inbox_messages_message_id_idx on public.inbox_messages (message_id);
create index if not exists inbox_messages_unread_idx on public.inbox_messages (received_at desc) where direction = 'in' and read_at is null;

create table if not exists public.inbox_threads (
  thread_id text primary key,
  status text not null default 'open' check (status in ('open', 'done')),
  updated_at timestamptz not null default now()
);

alter table public.inbox_messages enable row level security;
alter table public.inbox_threads enable row level security;
