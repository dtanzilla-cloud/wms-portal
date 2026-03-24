-- Add pallet weight and dimensions to orders
alter table orders
  add column if not exists pallet_weight_kg numeric(10,2),
  add column if not exists pallet_dimensions text;
