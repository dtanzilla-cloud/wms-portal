-- Allow staff and customers to delete inventory movements for their own SKUs
create policy "inventory_movements_delete"
  on inventory_movements for delete
  using (is_staff() or customer_id = my_customer_id());

-- Allow staff and customers to delete their own SKUs
create policy "skus_delete"
  on skus for delete
  using (is_staff() or customer_id = my_customer_id());
