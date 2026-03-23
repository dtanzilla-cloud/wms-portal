-- Add lot number and inbound date to SKUs
alter table skus
  add column if not exists lot_number   text,
  add column if not exists inbound_date date;
