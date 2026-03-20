-- Add quantity and storage_unit fields to skus table
ALTER TABLE skus
  ADD COLUMN IF NOT EXISTS quantity integer,
  ADD COLUMN IF NOT EXISTS storage_unit integer;
