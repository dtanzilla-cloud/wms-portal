-- ============================================================
-- Company / Warehouse Settings (singleton row)
-- ============================================================
create table company_settings (
  id              integer primary key default 1 check (id = 1),
  warehouse_name  text,
  address_line1   text,
  address_line2   text,
  city            text,
  state           text,
  postal_code     text,
  country         text default 'US',
  phone           text,
  email           text,
  updated_at      timestamptz default now()
);

-- Seed empty singleton
insert into company_settings (id) values (1) on conflict do nothing;

-- RLS
alter table company_settings enable row level security;

create policy "Authenticated users can read company settings"
  on company_settings for select
  using (auth.uid() is not null);

create policy "Admins can update company settings"
  on company_settings for update
  using (exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  ));
