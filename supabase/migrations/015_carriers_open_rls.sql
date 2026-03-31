-- Allow all authenticated users (not just staff) to manage carriers
drop policy if exists "Staff can insert carriers" on carriers;
drop policy if exists "Staff can update carriers" on carriers;
drop policy if exists "Staff can delete carriers" on carriers;

create policy "Authenticated users can insert carriers"
  on carriers for insert
  with check (auth.uid() is not null);

create policy "Authenticated users can update carriers"
  on carriers for update
  using (auth.uid() is not null);

create policy "Authenticated users can delete carriers"
  on carriers for delete
  using (auth.uid() is not null);
