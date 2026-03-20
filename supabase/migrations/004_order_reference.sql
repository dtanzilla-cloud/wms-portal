-- Add reference fields to orders table
alter table orders
  add column if not exists reference_type   text,
  add column if not exists reference_number text;
