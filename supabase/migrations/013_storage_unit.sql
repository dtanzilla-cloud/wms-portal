-- Add storage_unit column to order_items
-- Replaces the carton_count / units_per_carton concept with a generic
-- storage-unit field (e.g. "Pallet", "Carton", "Box", "Bag").
-- The old carton columns are kept so existing data is not lost.

alter table order_items
  add column if not exists storage_unit text;
