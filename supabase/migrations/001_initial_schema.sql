-- ============================================================
-- WMS Database Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- CUSTOMERS
-- ============================================================
create table customers (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null,
  code            text not null unique,
  billing_email   text not null,
  status          text not null default 'trial' check (status in ('trial','active','suspended')),
  trial_ends_at   timestamptz,
  created_at      timestamptz default now()
);

-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================
create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  customer_id   uuid references customers(id) on delete set null,
  role          text not null default 'customer' check (role in ('customer','warehouse_staff','admin')),
  full_name     text not null,
  email         text not null,
  created_at    timestamptz default now()
);

-- ============================================================
-- SKUs
-- ============================================================
create table skus (
  id             uuid primary key default uuid_generate_v4(),
  customer_id    uuid not null references customers(id) on delete cascade,
  sku_code       text not null,
  description    text not null,
  unit           text not null default 'each',
  weight_kg      numeric(10,3),
  dimensions_cm  text,
  created_at     timestamptz default now(),
  unique(customer_id, sku_code)
);

-- ============================================================
-- CONSIGNEES
-- ============================================================
create table consignees (
  id             uuid primary key default uuid_generate_v4(),
  customer_id    uuid not null references customers(id) on delete cascade,
  company_name   text not null,
  contact_name   text,
  contact_phone  text,
  contact_email  text,
  created_at     timestamptz default now()
);

create table consignee_addresses (
  id              uuid primary key default uuid_generate_v4(),
  consignee_id    uuid not null references consignees(id) on delete cascade,
  label           text not null default 'Default',
  address_line1   text not null,
  address_line2   text,
  city            text not null,
  state           text not null,
  postal_code     text not null,
  country         text not null default 'US',
  is_default      boolean default false,
  created_at      timestamptz default now()
);

-- ============================================================
-- ORDERS
-- ============================================================
create table orders (
  id                      uuid primary key default uuid_generate_v4(),
  customer_id             uuid not null references customers(id) on delete cascade,
  order_type              text not null check (order_type in ('inbound','outbound')),
  order_number            text not null unique,
  status                  text not null default 'draft'
                            check (status in ('draft','submitted','received','put_away','picked','packed','shipped','cancelled')),
  consignee_id            uuid references consignees(id) on delete set null,
  consignee_address_id    uuid references consignee_addresses(id) on delete set null,
  expected_date           date,
  ship_by_date            date,
  pallet_count            integer not null default 1,
  notes                   text,
  internal_notes          text,
  delivery_instructions   text,
  carrier                 text,
  tracking_number         text,
  created_by              uuid not null references profiles(id),
  created_at              timestamptz default now(),
  updated_at              timestamptz default now()
);

-- Auto-generate order numbers
create sequence order_seq start 1000;
create or replace function generate_order_number()
returns trigger as $$
begin
  if new.order_type = 'inbound' then
    new.order_number := 'IN-' || lpad(nextval('order_seq')::text, 6, '0');
  else
    new.order_number := 'OUT-' || lpad(nextval('order_seq')::text, 6, '0');
  end if;
  return new;
end;
$$ language plpgsql;

create trigger set_order_number
  before insert on orders
  for each row when (new.order_number is null or new.order_number = '')
  execute function generate_order_number();

-- Update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger orders_updated_at
  before update on orders
  for each row execute function update_updated_at();

-- ============================================================
-- ORDER ITEMS
-- ============================================================
create table order_items (
  id                uuid primary key default uuid_generate_v4(),
  order_id          uuid not null references orders(id) on delete cascade,
  sku_id            uuid not null references skus(id),
  quantity          integer not null check (quantity > 0),
  carton_count      integer,
  units_per_carton  integer,
  weight_kg         numeric(10,3),
  dimensions_cm     text
);

-- ============================================================
-- DOCUMENTS
-- ============================================================
create table documents (
  id                uuid primary key default uuid_generate_v4(),
  order_id          uuid not null references orders(id) on delete cascade,
  customer_id       uuid not null references customers(id) on delete cascade,
  document_type     text not null default 'other'
                      check (document_type in ('packing_list','bill_of_lading','commercial_invoice','other')),
  filename          text not null,
  storage_path      text not null,
  file_size_bytes   integer,
  uploaded_by       uuid not null references profiles(id),
  is_generated      boolean default false,
  created_at        timestamptz default now()
);

-- ============================================================
-- INVENTORY (maintained via triggers on order status changes)
-- ============================================================
create table inventory_movements (
  id           uuid primary key default uuid_generate_v4(),
  sku_id       uuid not null references skus(id),
  customer_id  uuid not null references customers(id),
  order_id     uuid references orders(id),
  movement_type text not null check (movement_type in ('inbound','outbound','adjustment')),
  quantity     integer not null,
  moved_at     timestamptz default now(),
  created_by   uuid references profiles(id)
);

-- Inventory levels view
create or replace view inventory_levels as
select
  s.id                                                    as sku_id,
  s.customer_id,
  coalesce(sum(case when m.movement_type = 'inbound'  then m.quantity
                    when m.movement_type = 'outbound' then -m.quantity
                    else m.quantity end), 0)::integer     as quantity_on_hand,
  coalesce((
    select sum(oi.quantity)
    from order_items oi
    join orders o on o.id = oi.order_id
    where oi.sku_id = s.id
      and o.status in ('submitted','picked','packed')
      and o.order_type = 'outbound'
  ), 0)::integer                                          as quantity_reserved,
  (coalesce(sum(case when m.movement_type = 'inbound'  then m.quantity
                     when m.movement_type = 'outbound' then -m.quantity
                     else m.quantity end), 0)
   - coalesce((
    select sum(oi.quantity)
    from order_items oi
    join orders o on o.id = oi.order_id
    where oi.sku_id = s.id
      and o.status in ('submitted','picked','packed')
      and o.order_type = 'outbound'
  ), 0))::integer                                         as quantity_available,
  max(m.moved_at)                                         as last_movement_at
from skus s
left join inventory_movements m on m.sku_id = s.id
group by s.id, s.customer_id;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table customers          enable row level security;
alter table profiles           enable row level security;
alter table skus               enable row level security;
alter table consignees         enable row level security;
alter table consignee_addresses enable row level security;
alter table orders             enable row level security;
alter table order_items        enable row level security;
alter table documents          enable row level security;
alter table inventory_movements enable row level security;

-- Helper: get current user's customer_id
create or replace function my_customer_id()
returns uuid as $$
  select customer_id from profiles where id = auth.uid();
$$ language sql security definer;

-- Helper: is current user staff?
create or replace function is_staff()
returns boolean as $$
  select role in ('warehouse_staff','admin') from profiles where id = auth.uid();
$$ language sql security definer;

-- Customers: staff see all, customers see own
create policy "customers_select" on customers for select using (
  is_staff() or id = my_customer_id()
);

-- Profiles: staff see all, users see own
create policy "profiles_select" on profiles for select using (
  is_staff() or id = auth.uid()
);
create policy "profiles_insert" on profiles for insert with check (id = auth.uid());
create policy "profiles_update" on profiles for update using (id = auth.uid());

-- SKUs
create policy "skus_select" on skus for select using (
  is_staff() or customer_id = my_customer_id()
);
create policy "skus_insert" on skus for insert with check (
  is_staff() or customer_id = my_customer_id()
);
create policy "skus_update" on skus for update using (
  is_staff() or customer_id = my_customer_id()
);

-- Consignees
create policy "consignees_select" on consignees for select using (
  is_staff() or customer_id = my_customer_id()
);
create policy "consignees_insert" on consignees for insert with check (
  is_staff() or customer_id = my_customer_id()
);
create policy "consignees_update" on consignees for update using (
  is_staff() or customer_id = my_customer_id()
);
create policy "consignee_addresses_select" on consignee_addresses for select using (
  is_staff() or (select customer_id from consignees where id = consignee_id) = my_customer_id()
);
create policy "consignee_addresses_insert" on consignee_addresses for insert with check (
  is_staff() or (select customer_id from consignees where id = consignee_id) = my_customer_id()
);

-- Orders
create policy "orders_select" on orders for select using (
  is_staff() or customer_id = my_customer_id()
);
create policy "orders_insert" on orders for insert with check (
  is_staff() or customer_id = my_customer_id()
);
create policy "orders_update" on orders for update using (
  is_staff() or customer_id = my_customer_id()
);

-- Order items
create policy "order_items_select" on order_items for select using (
  is_staff() or (select customer_id from orders where id = order_id) = my_customer_id()
);
create policy "order_items_insert" on order_items for insert with check (
  is_staff() or (select customer_id from orders where id = order_id) = my_customer_id()
);

-- Documents
create policy "documents_select" on documents for select using (
  is_staff() or customer_id = my_customer_id()
);
create policy "documents_insert" on documents for insert with check (
  is_staff() or customer_id = my_customer_id()
);

-- Inventory movements
create policy "inventory_select" on inventory_movements for select using (
  is_staff() or customer_id = my_customer_id()
);
create policy "inventory_insert" on inventory_movements for insert with check (
  is_staff()
);

-- ============================================================
-- STORAGE BUCKETS (run in Supabase Storage dashboard or SQL)
-- ============================================================
-- insert into storage.buckets (id, name, public) values ('documents', 'documents', false);
-- insert into storage.buckets (id, name, public) values ('generated-docs', 'generated-docs', false);

-- ============================================================
-- INDEXES
-- ============================================================
create index idx_orders_customer    on orders(customer_id);
create index idx_orders_status      on orders(status);
create index idx_orders_type        on orders(order_type);
create index idx_order_items_order  on order_items(order_id);
create index idx_order_items_sku    on order_items(sku_id);
create index idx_documents_order    on documents(order_id);
create index idx_inventory_sku      on inventory_movements(sku_id);
create index idx_consignees_cust    on consignees(customer_id);
