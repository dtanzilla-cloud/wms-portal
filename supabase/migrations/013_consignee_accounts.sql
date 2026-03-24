-- ============================================================
-- 013 — Consignee accounts, invite tokens, document fixes
-- ============================================================

-- 1. Add 'consignee' role to profiles
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('customer', 'warehouse_staff', 'admin', 'consignee'));

-- 2. Add consignee_id to profiles (links a consignee user to their consignee record)
alter table profiles
  add column if not exists consignee_id uuid references consignees(id) on delete set null;

-- 3. Add invite token columns to consignees
alter table consignees
  add column if not exists invite_token text,
  add column if not exists invite_sent_at timestamptz,
  add column if not exists invite_accepted_at timestamptz;

-- 4. Fix documents table so anonymous (consignee) uploads work
--    a) Make uploaded_by nullable
alter table documents
  alter column uploaded_by drop not null;

--    b) Add 'consignee_attachment' to allowed document_type values
alter table documents
  drop constraint if exists documents_document_type_check;
alter table documents
  add constraint documents_document_type_check
    check (document_type in (
      'packing_list', 'bill_of_lading', 'commercial_invoice',
      'other', 'consignee_attachment'
    ));

-- ============================================================
-- 5. Helper functions for consignee RLS
-- ============================================================

-- Returns the consignee_id for the current logged-in user (null if not a consignee)
create or replace function my_consignee_id()
returns uuid as $$
  select consignee_id from profiles where id = auth.uid();
$$ language sql security definer;

-- Returns the customer_id that the current consignee belongs to
create or replace function consignee_customer_id()
returns uuid as $$
  select c.customer_id
  from consignees c
  where c.id = (select consignee_id from profiles where id = auth.uid())
  limit 1;
$$ language sql security definer;

-- ============================================================
-- 6. RLS policies for consignee role
-- ============================================================

-- Consignees can see their own consignee record
create policy "consignee_own_record_select" on consignees for select
  using (id = my_consignee_id() and my_consignee_id() is not null);

-- Consignees can see addresses for their consignee
create policy "consignee_own_addresses_select" on consignee_addresses for select
  using (consignee_id = my_consignee_id() and my_consignee_id() is not null);

-- Consignees can see the customer record they belong to
create policy "consignee_customer_select" on customers for select
  using (id = consignee_customer_id() and consignee_customer_id() is not null);

-- Consignees can see outbound orders addressed to them
create policy "consignee_orders_select" on orders for select
  using (consignee_id = my_consignee_id() and my_consignee_id() is not null);

-- Consignees can see order items for their orders
create policy "consignee_order_items_select" on order_items for select
  using (
    my_consignee_id() is not null and
    (select consignee_id from orders where id = order_id) = my_consignee_id()
  );

-- Consignees can see documents attached to their orders
create policy "consignee_documents_select" on documents for select
  using (
    my_consignee_id() is not null and
    order_id in (select id from orders where consignee_id = my_consignee_id())
  );

-- Consignees can see their customer's SKUs (for inventory page)
create policy "consignee_skus_select" on skus for select
  using (customer_id = consignee_customer_id() and consignee_customer_id() is not null);

-- Consignees can see their customer's inventory movements
create policy "consignee_inventory_select" on inventory_movements for select
  using (customer_id = consignee_customer_id() and consignee_customer_id() is not null);
