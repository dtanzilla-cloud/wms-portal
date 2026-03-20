-- ============================================================
-- Migration 002: Add missing RLS policies for staff operations
-- Run this in Supabase SQL Editor
-- ============================================================

-- Allow staff to insert/update customers
create policy "customers_insert_staff" on customers
  for insert with check (is_staff());

create policy "customers_update_staff" on customers
  for update using (is_staff());

-- Allow staff to insert profiles (when creating customer accounts)
create policy "profiles_insert_staff" on profiles
  for insert with check (is_staff() or id = auth.uid());

create policy "profiles_update_staff" on profiles
  for update using (is_staff() or id = auth.uid());

-- Allow staff to see all profiles
create policy "profiles_select_staff" on profiles
  for select using (is_staff() or id = auth.uid());
