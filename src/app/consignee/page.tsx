import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Package, ArrowUpCircle, Clock, CheckCircle } from 'lucide-react'

const STATUS_COLORS: Record<string, string> = {
  submitted: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  picked:    'bg-blue-50 text-blue-700 border-blue-200',
  packed:    'bg-purple-50 text-purple-700 border-purple-200',
  shipped:   'bg-green-50 text-green-700 border-green-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
}

export default async function ConsigneeDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('consignee_id, consignees(company_name, customer_id)')
    .eq('id', user!.id)
    .single()

  const consigneeId = profile?.consignee_id
  const customerId = (profile?.consignees as any)?.customer_id

  // Recent orders addressed to this consignee
  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_number, status, ship_by_date, created_at, order_items(quantity)')
    .eq('consignee_id', consigneeId)
    .eq('order_type', 'outbound')
    .neq('status', 'draft')
    .order('created_at', { ascending: false })
    .limit(8)

  // Inventory summary — top 6 SKUs by available qty
  const { data: levels } = await supabase
    .from('inventory_levels')
    .select('sku_id, quantity_on_hand, quantity_available')
    .eq('customer_id', customerId)
    .order('quantity_available', { ascending: false })
    .limit(6)

  const skuIds = (levels ?? []).map((l: any) => l.sku_id)
  let skuMap: Record<string, any> = {}
  if (skuIds.length > 0) {
    const { data: skus } = await supabase.from('skus').select('id, sku_code, description').in('id', skuIds)
    skuMap = Object.fromEntries((skus ?? []).map((s: any) => [s.id, s]))
  }

  const pending = (orders ?? []).filter((o: any) => ['submitted','picked','packed'].includes(o.status))
  const shipped = (orders ?? []).filter((o: any) => o.status === 'shipped')

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-semibold text-gray-900 mb-1">Dashboard</h1>
      <p className="text-sm text-gray-500 mb-6">Your incoming shipments and inventory</p>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="bg-orange-50 p-2 rounded-lg"><Clock size={18} className="text-orange-500" /></div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{pending.length}</p>
              <p className="text-xs text-gray-500">Pending shipments</p>
            </div>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="bg-green-50 p-2 rounded-lg"><CheckCircle size={18} className="text-green-500" /></div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{shipped.length}</p>
              <p className="text-xs text-gray-500">Shipped</p>
            </div>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="bg-blue-50 p-2 rounded-lg"><Package size={18} className="text-blue-500" /></div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{levels?.length ?? 0}</p>
              <p className="text-xs text-gray-500">SKUs in stock</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent orders */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">Recent shipments</h2>
            <Link href="/consignee/orders" className="text-xs text-blue-600 hover:underline">View all</Link>
          </div>
          <div className="card divide-y divide-gray-100">
            {(orders ?? []).length === 0 && (
              <p className="px-4 py-6 text-sm text-center text-gray-400">No orders yet</p>
            )}
            {(orders ?? []).map((o: any) => {
              const totalQty = (o.order_items ?? []).reduce((s: number, i: any) => s + i.quantity, 0)
              return (
                <Link key={o.id} href={`/consignee/orders/${o.order_number}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{o.order_number}</p>
                    <p className="text-xs text-gray-500">{totalQty} units</p>
                  </div>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium capitalize ${STATUS_COLORS[o.status] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                    {o.status}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>

        {/* Inventory snapshot */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">Inventory snapshot</h2>
            <Link href="/consignee/inventory" className="text-xs text-blue-600 hover:underline">View all</Link>
          </div>
          <div className="card divide-y divide-gray-100">
            {(levels ?? []).length === 0 && (
              <p className="px-4 py-6 text-sm text-center text-gray-400">No inventory data</p>
            )}
            {(levels ?? []).map((l: any) => {
              const sku = skuMap[l.sku_id]
              return (
                <div key={l.sku_id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-xs font-mono text-orange-600">{sku?.sku_code}</p>
                    <p className="text-sm text-gray-700">{sku?.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">{l.quantity_available}</p>
                    <p className="text-xs text-gray-400">available</p>
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
