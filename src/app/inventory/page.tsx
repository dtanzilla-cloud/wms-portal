import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { AlertCircle, Plus, Upload } from 'lucide-react'
import CustomerPicker from './CustomerPicker'

export default async function InventoryPage({ searchParams }: { searchParams: { customer?: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user!.id).single()
  const isStaff = profile?.role === 'warehouse_staff' || profile?.role === 'admin'

  // For staff: load all customers for the picker
  let customers: { id: string; name: string }[] = []
  if (isStaff) {
    const { data } = await supabase.from('customers').select('id, name').order('name')
    customers = data ?? []
  }

  // Determine which customer to filter by
  const selectedCustomerId = isStaff
    ? (searchParams.customer ?? '')
    : (profile?.customer_id ?? '')

  // Build inventory query
  let inventoryQuery = supabase
    .from('inventory_levels')
    .select('*, skus(sku_code, description, unit)')
    .order('quantity_available', { ascending: true })

  if (selectedCustomerId) {
    inventoryQuery = inventoryQuery.eq('customer_id', selectedCustomerId)
  }

  const { data: inventory } = await inventoryQuery

  // Pending outbound orders
  let ordersQuery = supabase
    .from('orders')
    .select('id, order_number, ship_by_date, status, order_items(quantity, skus(sku_code, description))')
    .eq('order_type', 'outbound')
    .in('status', ['submitted', 'picked', 'packed'])
    .order('ship_by_date', { ascending: true })

  if (selectedCustomerId) {
    ordersQuery = ordersQuery.eq('customer_id', selectedCustomerId)
  }

  const { data: pendingOrders } = await ordersQuery

  const today = new Date()
  const selectedCustomerName = customers.find(c => c.id === selectedCustomerId)?.name

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Inventory</h1>
          <p className="text-sm text-gray-500 mt-1">
            {isStaff
              ? selectedCustomerName ? `Showing inventory for ${selectedCustomerName}` : 'Showing all customers'
              : 'Current stock levels and pending shipments'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isStaff && (
            <CustomerPicker customers={customers} selectedId={selectedCustomerId} />
          )}
          <Link href="/inventory/history" className="btn-secondary text-sm flex items-center gap-2">
            History
          </Link>
          <Link href="/inventory/skus/new" className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={14} /> Add SKU
          </Link>
          <Link href="/inventory/skus/import" className="btn-secondary text-sm flex items-center gap-2">
            <Upload size={14} /> Import CSV
          </Link>
          <a href="/api/inventory/export" className="btn-secondary text-sm flex items-center gap-2">
            Export CSV
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stock levels table */}
        <div className="lg:col-span-2 card">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Stock levels</h2>
            <span className="text-xs text-gray-400">{inventory?.length ?? 0} SKUs</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">SKU</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Description</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-gray-500">On hand</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-gray-500">Reserved</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-gray-500">Available</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(!inventory || inventory.length === 0) && (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-gray-400 text-xs">
                      {isStaff && !selectedCustomerId ? 'Select a customer to view inventory, or view all above' : 'No inventory yet'}
                    </td>
                  </tr>
                )}
                {inventory?.map((row: any) => (
                  <tr key={row.sku_id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-mono text-xs">
                      <Link href={`/inventory/skus/${row.sku_id}`} className="text-blue-700 hover:underline">
                        {row.skus?.sku_code}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-gray-700">{row.skus?.description}</td>
                    <td className="px-5 py-3 text-right text-gray-700">{row.quantity_on_hand}</td>
                    <td className="px-5 py-3 text-right text-amber-600">{row.quantity_reserved}</td>
                    <td className={`px-5 py-3 text-right font-medium ${row.quantity_available <= 0 ? 'text-red-600' : 'text-green-700'}`}>
                      {row.quantity_available}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pending shipments panel */}
        <div className="card">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">Pending to ship</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {(!pendingOrders || pendingOrders.length === 0) && (
              <p className="px-5 py-8 text-xs text-gray-400 text-center">No pending shipments</p>
            )}
            {pendingOrders?.map((order: any) => {
              const shipBy = order.ship_by_date ? new Date(order.ship_by_date) : null
              const overdue = shipBy && shipBy < today
              return (
                <div key={order.id} className="px-5 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{order.order_number}</p>
                      <div className="mt-1 space-y-0.5">
                        {order.order_items?.slice(0, 2).map((item: any, i: number) => (
                          <p key={i} className="text-xs text-gray-500">
                            {item.quantity}× {item.skus?.sku_code}
                          </p>
                        ))}
                        {order.order_items?.length > 2 && (
                          <p className="text-xs text-gray-400">+{order.order_items.length - 2} more</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`status-${order.status} px-2 py-0.5 rounded text-xs font-medium`}>
                        {order.status}
                      </span>
                      {shipBy && (
                        <p className={`text-xs mt-1 flex items-center gap-1 justify-end ${overdue ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
                          {overdue && <AlertCircle size={11} />}
                          {shipBy.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
