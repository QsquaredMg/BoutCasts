-- Sales and free grants recorded by hand in Admin > Purchases (cash, check, Venmo, comps).
-- Only the server's admin key can read or write this table: row security is on with no policies,
-- and the public roles have no access. Run once in the Supabase SQL editor.
create table if not exists public.manual_sales (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid unique,                      -- stops a double-click from saving the entry twice
  created_at   timestamptz not null default now(),
  sold_at      timestamptz not null default now(),
  kind         text not null check (kind in ('offline', 'comp')),
  what         text not null check (char_length(what) between 1 and 120),
  amount_cents integer not null default 0 check (amount_cents >= 0),
  method       text,
  buyer_name   text,
  buyer_email  text,
  note         text,
  recorded_by  text not null,
  voided_at    timestamptz,
  voided_by    text,
  check (kind = 'offline' or amount_cents = 0)
);

alter table public.manual_sales enable row level security;
revoke all on public.manual_sales from anon, authenticated;

create index if not exists manual_sales_sold_at_idx on public.manual_sales (sold_at desc);
