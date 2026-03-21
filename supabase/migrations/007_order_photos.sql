-- ============================================================
-- Migration 007: order_photos table for inbound/outbound orders
-- ============================================================

create table if not exists order_photos (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references orders(id) on delete cascade,
  storage_path text not null,
  filename     text not null,
  uploaded_by  uuid references profiles(id),
  created_at   timestamptz default now()
);

alter table order_photos enable row level security;

create policy "order_photos_select" on order_photos for select to authenticated
  using (
    exists (
      select 1 from orders o
      where o.id = order_photos.order_id
        and (is_staff() or o.customer_id = my_customer_id())
    )
  );

create policy "order_photos_insert" on order_photos for insert to authenticated
  with check (
    exists (
      select 1 from orders o
      where o.id = order_id
        and (is_staff() or o.customer_id = my_customer_id())
    )
  );

create policy "order_photos_delete" on order_photos for delete to authenticated
  using (is_staff() or uploaded_by = auth.uid());
