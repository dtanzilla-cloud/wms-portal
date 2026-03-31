-- Carriers repository (global lookup, managed by staff)
create table carriers (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  scac_code     text,
  contact_name  text,
  contact_phone text,
  contact_email text,
  notes         text,
  created_at    timestamptz default now()
);

alter table carriers enable row level security;

-- All authenticated users can view carriers (needed for order form dropdowns)
create policy "Authenticated users can view carriers"
  on carriers for select
  using (auth.uid() is not null);

-- Only staff can manage carriers
create policy "Staff can insert carriers"
  on carriers for insert
  with check (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'warehouse_staff'))
  );

create policy "Staff can update carriers"
  on carriers for update
  using (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'warehouse_staff'))
  );

create policy "Staff can delete carriers"
  on carriers for delete
  using (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'warehouse_staff'))
  );
