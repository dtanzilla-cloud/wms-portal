create table email_transactions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  sender_email text not null,
  sender_role text, -- 'staff', 'customer', or 'unknown'
  raw_subject text,
  raw_body text,
  parsed_action text, -- 'IN', 'OUT', null if failed
  parsed_quantity numeric,
  parsed_unit text,
  parsed_sku_id uuid references skus(id),
  parsed_lot_number text,
  parsed_po_number text,
  parsed_confidence text, -- 'high', 'low', 'failed'
  parsed_raw_intent text,
  status text not null default 'pending', -- 'pending', 'applied', 'rejected', 'clarification_needed'
  rejection_reason text,
  inventory_movement_id uuid references inventory_movements(id),
  postmark_message_id text,
  reply_sent_at timestamptz
);

alter table email_transactions enable row level security;

create policy "staff and admin can view email transactions"
  on email_transactions for select
  using (is_staff());
