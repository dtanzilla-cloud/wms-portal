export type UserRole = 'customer' | 'warehouse_staff' | 'admin'
export type AccountStatus = 'trial' | 'active' | 'suspended'
export type OrderStatus = 'draft' | 'submitted' | 'received' | 'put_away' | 'picked' | 'packed' | 'shipped' | 'cancelled'
export type OrderType = 'inbound' | 'outbound'
export type DocumentType = 'packing_list' | 'bill_of_lading' | 'commercial_invoice' | 'other'

export interface Customer {
  id: string
  name: string
  code: string
  billing_email: string
  status: AccountStatus
  trial_ends_at: string | null
  created_at: string
}

export interface Profile {
  id: string
  customer_id: string | null
  role: UserRole
  full_name: string
  email: string
  created_at: string
}

export interface SKU {
  id: string
  customer_id: string
  sku_code: string
  description: string
  unit: string
  weight_kg: number | null
  dimensions_cm: string | null
  created_at: string
}

export interface Consignee {
  id: string
  customer_id: string
  company_name: string
  contact_name: string | null
  contact_phone: string | null
  contact_email: string | null
  addresses: ConsigneeAddress[]
  created_at: string
}

export interface ConsigneeAddress {
  id: string
  consignee_id: string
  label: string
  address_line1: string
  address_line2: string | null
  city: string
  state: string
  postal_code: string
  country: string
  is_default: boolean
}

export interface Order {
  id: string
  customer_id: string
  order_type: OrderType
  order_number: string
  status: OrderStatus
  consignee_id: string | null
  consignee_address_id: string | null
  expected_date: string | null
  ship_by_date: string | null
  pallet_count: number
  notes: string | null
  internal_notes: string | null
  delivery_instructions: string | null
  carrier: string | null
  tracking_number: string | null
  created_by: string
  created_at: string
  updated_at: string
  // relations
  customer?: Customer
  consignee?: Consignee
  items?: OrderItem[]
  documents?: Document[]
}

export interface OrderItem {
  id: string
  order_id: string
  sku_id: string
  quantity: number
  carton_count: number | null
  units_per_carton: number | null
  weight_kg: number | null
  dimensions_cm: string | null
  // relations
  sku?: SKU
}

export interface Document {
  id: string
  order_id: string
  customer_id: string
  document_type: DocumentType
  filename: string
  storage_path: string
  file_size_bytes: number | null
  uploaded_by: string
  is_generated: boolean
  created_at: string
}

export interface InventoryLevel {
  sku_id: string
  customer_id: string
  quantity_on_hand: number
  quantity_reserved: number
  quantity_available: number
  last_movement_at: string | null
  sku?: SKU
}

export interface Notification {
  id: string
  user_id: string
  title: string
  message: string
  read: boolean
  created_at: string
}
