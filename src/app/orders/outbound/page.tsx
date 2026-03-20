import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, ArrowUpCircle } from 'lucide-react'

export default async function OutboundOrdersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user!.id).single()
  const isStaff = profile?.role === 'warehouse_staff' || profile?.role === 'admin'

  const { data: orders } = await supabase
    .from('orders')
    .select('*, customers(name), consignees(company_name)')
    .eq('order_type', 'outbound')
    .match(isStaff ? {} : { customer_id: profile?.customer_id })
    .order('created_at', { ascending: false })

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Outbound Orders</h1>
          <p className="text-sm text-gray-500 mt-1">{orders?.length ?? 0} orders</p>
        </div>
        <Link href="/orders/outbound/new" className="btn-primary flex items-center gap-2">
          <Plus size={15} /> New order
        </Link>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Order #</th>
                {isStaff && <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Customer</th>}
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Consignee</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Ship by</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Pallets</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Status</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {orders?.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-400 text-xs">No outbound orders yet</td></tr>
              )}
              {orders?.map((order: any) => (
                <tr key={order.id} className="hover:bg-gray-50 cursor-pointer">
                  <td className="px-5 py-3">
                    <Link href={`/orders/outbound/${order.id}`} className="font-medium text-blue-700 hover:underline flex items-center gap-1.5">
                      <ArrowUpCircle size={13} className="text-orange-400" />
                      {order.order_number}
                    </Link>
                  </td>
                  {isStaff && <td className="px-5 py-3 text-gray-600">{order.customers?.name}</td>}
                  <td className="px-5 py-3 text-gray-600">{order.consignees?.company_name ?? '—'}</td>
                  <td className="px-5 py-3 text-gray-600">
                    {order.ship_by_date
                      ? new Date(order.ship_by_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : '—'}
                  </td>
                  <td className="px-5 py-3 text-gray-600">{order.pallet_count}</td>
                  <td className="px-5 py-3">
                    <span className={`status-${order.status} px-2 py-0.5 rounded text-xs font-medium`}>
                      {order.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-400 text-xs">
                    {new Date(order.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
