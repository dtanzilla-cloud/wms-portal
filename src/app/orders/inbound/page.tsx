import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, ArrowDownCircle, AlertCircle } from 'lucide-react'

export default async function InboundOrdersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user!.id).single()
  const isStaff = profile?.role === 'warehouse_staff' || profile?.role === 'admin'

  const { data: orders } = await supabase
    .from('orders')
    .select('*, customers(name)')
    .eq('order_type', 'inbound')
    .match(isStaff ? {} : { customer_id: profile?.customer_id })
    .order('created_at', { ascending: false })

  const today = new Date()

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {isStaff ? 'Inbound Queue' : 'Inbound Orders'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{orders?.length ?? 0} orders</p>
        </div>
        <Link href="/orders/inbound/new" className="btn-primary flex items-center gap-2">
          <Plus size={15} /> New inbound
        </Link>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Order #</th>
                {isStaff && <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Customer</th>}
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Expected</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Pallets</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Status</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {orders?.length === 0 && (
                <tr>
                  <td colSpan={isStaff ? 6 : 5} className="px-5 py-12 text-center text-gray-400 text-xs">
                    <ArrowDownCircle size={24} className="mx-auto mb-2 text-gray-300" />
                    No inbound orders yet
                  </td>
                </tr>
              )}
              {orders?.map((order: any) => {
                const expected = order.expected_date ? new Date(order.expected_date) : null
                const overdue = expected && expected < today && !['put_away', 'cancelled'].includes(order.status)
                return (
                  <tr key={order.id} className="hover:bg-gray-50 cursor-pointer">
                    <td className="px-5 py-3">
                      <Link href={`/orders/inbound/${order.id}`} className="font-medium text-blue-700 hover:underline flex items-center gap-1.5">
                        <ArrowDownCircle size={13} className="text-blue-400" />
                        {order.order_number}
                      </Link>
                    </td>
                    {isStaff && <td className="px-5 py-3 text-gray-600">{order.customers?.name}</td>}
                    <td className="px-5 py-3 text-gray-600">
                      {expected ? (
                        <span className={`flex items-center gap-1 ${overdue ? 'text-red-600 font-medium' : ''}`}>
                          {overdue && <AlertCircle size={12} />}
                          {expected.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      ) : '—'}
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
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
