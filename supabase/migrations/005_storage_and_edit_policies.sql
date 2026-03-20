-- ============================================================
-- Migration 005: Storage bucket + policies, order_items delete
-- Run this in Supabase SQL Editor
-- ============================================================

-- Create the documents storage bucket (if not already created)
insert into storage.buckets (id, name, public)
  values ('documents', 'documents', false)
  on conflict (id) do nothing;

-- Storage policies: allow any authenticated user to upload/read/delete
create policy "docs_insert" on storage.objects
  for insert with check (
    bucket_id = 'documents' and auth.role() = 'authenticated'
  );

create policy "docs_select" on storage.objects
  for select using (
    bucket_id = 'documents' and auth.role() = 'authenticated'
  );

create policy "docs_update" on storage.objects
  for update using (
    bucket_id = 'documents' and auth.role() = 'authenticated'
  );

create policy "docs_delete" on storage.objects
  for delete using (
    bucket_id = 'documents' and auth.role() = 'authenticated'
  );

-- Allow staff/owner to delete order items (needed for order editing)
create policy "order_items_delete" on order_items
  for delete using (
    is_staff() or (select customer_id from orders where id = order_id) = my_customer_id()
  );

-- Allow staff/owner to delete documents
create policy "documents_delete" on documents
  for delete using (
    is_staff() or customer_id = my_customer_id()
  );
