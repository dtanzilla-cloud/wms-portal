-- Allow customers to insert inventory movements for their own SKUs
-- (needed for quantity adjustments when editing a SKU)
drop policy if exists "inventory_insert" on inventory_movements;

create policy "inventory_insert" on inventory_movements for insert with check (
  is_staff() or customer_id = my_customer_id()
);
