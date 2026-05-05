-- ============================================================
-- 014 — Charges: rates, invoices, handling_units on movements
-- ============================================================

-- 1. handling_units on inventory_movements
--    Stores the number of pallets / handling units for the movement,
--    separate from quantity (pieces). Used for per-unit billing.
alter table inventory_movements
  add column if not exists handling_units integer;

-- 2. charge_rates — one row per customer, stores the three billing rates
create table if not exists charge_rates (
  id                              uuid primary key default gen_random_uuid(),
  customer_id                     uuid not null references customers(id) on delete cascade,
  storage_rate_per_unit_per_week  numeric(10,4) not null default 0,
  inbound_rate_per_unit           numeric(10,4) not null default 0,
  outbound_rate_per_unit          numeric(10,4) not null default 0,
  updated_at                      timestamptz default now(),
  updated_by                      uuid references profiles(id) on delete set null,
  unique(customer_id)
);

-- 3. charge_invoices — PDF invoices attached to a billing month
create table if not exists charge_invoices (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid not null references customers(id) on delete cascade,
  billing_month   date not null,        -- always stored as first-of-month, e.g. 2026-04-01
  filename        text not null,
  storage_path    text not null,
  file_size_bytes integer,
  notes           text,
  created_at      timestamptz default now(),
  created_by      uuid references profiles(id) on delete set null
);

-- 4. Row-level security
alter table charge_rates    enable row level security;
alter table charge_invoices enable row level security;

-- Staff: full access
create policy "staff_manage_charge_rates" on charge_rates
  for all using (is_staff());

create policy "staff_manage_charge_invoices" on charge_invoices
  for all using (is_staff());

-- Customers: read their own data only
create policy "customer_read_charge_rates" on charge_rates
  for select using (customer_id = my_customer_id() and my_customer_id() is not null);

create policy "customer_read_charge_invoices" on charge_invoices
  for select using (customer_id = my_customer_id() and my_customer_id() is not null);
