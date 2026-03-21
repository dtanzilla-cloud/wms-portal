-- ============================================================
-- Migration 006: Backfill initial inventory adjustment movements
-- for SKUs that have a quantity set but no existing movements.
-- Run this in Supabase SQL Editor.
-- ============================================================

insert into inventory_movements (sku_id, customer_id, movement_type, quantity)
select s.id, s.customer_id, 'adjustment', s.quantity
from skus s
where s.quantity > 0
  and not exists (
    select 1 from inventory_movements m where m.sku_id = s.id
  );
