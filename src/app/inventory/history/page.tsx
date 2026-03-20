import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ArrowDownCircle, ArrowUpCircle, Settings } from 'lucide-react'

export default async function InventoryHistoryPage({
  searchParams,
}: {
  searchParams: { sku?: string; type?: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user!.id).single()
  const isStaff = profile?.role === 'warehouse_staff' || profile?.role === 'admin'

  let query = supabase
    .from('inventory_movements')
    .select('*, skus(sku_code, description), orders(order_number, order_type), customers(name)')
    .match(isStaff ? {} : { customer_id: profile?.customer_id })
    .order('moved_at', { ascending: false })
    .limit(200)

  if (searchParams.sku) query = query.eq('sku_id', searchParams.sku)
  if (searchParams.type) query = query.eq('movement_type', searchParams.type)

  const { data: movements } = await query

  // Get SKUs for filter dropdown
  const { data: skus } = await supabase
    .from('skus')
    .select('id, sku_code, description')
    .match(isStaff ? {} : { customer_id: profile?.customer_id })
    .order('sku_code')

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Movement History</h1>
          <p className="text-sm text-gray-500 mt-1">All inventory ins and outs</p>
        </div>
        <Link href="/inventory" className="btn-secondary text-sm">← Back to inventory</Link>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-5 flex items-center gap-3">
        <span className="text-xs font-medium text-gray-500">Filter:</span>
        <form className="flex items-center gap-3">
          <select name="sku" defaultValue={searchParams.sku ?? ''} className="text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All SKUs</option>
            {skus?.map(s => <option key={s.id} value={s.id}>{s.sku_code} — {s.description}</option>)}
          </select>
          <select name="type" defaultValue={searchParams.type ?? ''} className="text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All types</option>
            <option value="inbound">Inbound</option>
            <option value="outbound">Outbound</option>
            <option value="adjustment">Adjustment</option>
          </select>
          <button type="submit" className="btn-primary text-sm py-1.5">Apply</button>
          <Link href="/inventory/history" className="text-sm text-gray-500 hover:text-gray-700">Clear</Link>
        </form>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Date</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">SKU</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Type</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-gray-500">Qty</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Order</th>
                {isStaff && <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Customer</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {movements?.length === 0 && (
                <tr>
                  <td colSpan={isStaff ? 6 : 5} className="px-5 py-10 text-center text-gray-400 text-xs">
                    No movements yet
                  </td>
                </tr>
              )}
              {movements?.map((m: any) => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 text-gray-500 text-xs">
                    {new Date(m.moved_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-5 py-3">
                    <p className="font-mono text-xs text-blue-700">{m.skus?.sku_code}</p>
                    <p className="text-xs text-gray-500">{m.skus?.description}</p>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`flex items-center gap-1.5 text-xs font-medium ${
                      m.movement_type === 'inbound' ? 'text-blue-600' :
                      m.movement_type === 'outbound' ? 'text-orange-600' : 'text-gray-600'
                    }`}>
                      {m.movement_type === 'inbound' && <ArrowDownCircle size={12} />}
                      {m.movement_type === 'outbound' && <ArrowUpCircle size={12} />}
                      {m.movement_type === 'adjustment' && <Settings size={12} />}
                      <span className="capitalize">{m.movement_type}</span>
                    </span>
                  </td>
                  <td className={`px-5 py-3 text-right font-medium ${
                    m.movement_type === 'inbound' ? 'text-blue-700' :
                    m.movement_type === 'outbound' ? 'text-orange-700' : 'text-gray-700'
                  }`}>
                    {m.movement_type === 'inbound' ? '+' : m.movement_type === 'outbound' ? '−' : ''}{m.quantity}
                  </td>
                  <td className="px-5 py-3">
                    {m.orders && (
                      <Link
                        href={`/orders/${m.orders.order_type}/${m.order_id}`}
                        className="text-xs text-blue-600 hover:underline font-mono"
                      >
                        {m.orders.order_number}
                      </Link>
                    )}
                  </td>
                  {isStaff && <td className="px-5 py-3 text-gray-500 text-xs">{m.customers?.name}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
