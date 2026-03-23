-- Add lot_number to order_items so each line item can carry its own lot number
alter table order_items
  add column if not exists lot_number text;
