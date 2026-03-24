import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowDownCircle, ArrowUpCircle, Package, Clock } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles').select('*, customers(*)').eq('id', user!.id).single()

  // Consignee users go to their own portal
  if (profile?.role === 'consignee') redirect('/consignee')

  const isStaff = profile?.role === 'warehouse_staff' || profile?.role === 'admin'
  const customerId = profile?.customer_id

  // Fetch summary counts
  const [inboundPending, outboundPending, outboundShipped, skuCount] = await Promise.all([
    supabase.from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('order_type', 'inbound')
      .in('status', ['submitted', 'received'])
      .match(isStaff ? {} : { customer_id: customerId }),
    supabase.from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('order_type', 'outbound')
      .in('status', ['submitted', 'picked', 'packed'])
      .match(isStaff ? {} : { customer_id: customerId }),
    supabase.from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('order_type', 'outbound').eq('status', 'shipped')
      .match(isStaff ? {} : { customer_id: customerId }),
    supabase.from('skus')
      .select('id', { count: 'exact', head: true })
      .match(isStaff ? {} : { customer_id: customerId }),
  ])

  const stats = [
    { label: 'Pending inbound',   value: inboundPending.count ?? 0,  icon: ArrowDownCircle, color: 'text-blue-600',   bg: 'bg-blue-50',   href: '/orders/inbound' },
    { label: 'Pending outbound',  value: outboundPending.count ?? 0, icon: ArrowUpCircle,   color: 'text-orange-600', bg: 'bg-orange-50', href: '/orders/outbound' },
    { label: 'Shipped this month',value: outboundShipped.count ?? 0, icon: Clock,           color: 'text-green-600',  bg: 'bg-green-50',  href: '/orders/outbound' },
    { label: 'Active SKUs',       value: skuCount.count ?? 0,        icon: Package,         color: 'text-purple-600', bg: 'bg-purple-50', href: '/inventory' },
  ]

  // Recent orders
  const { data: recentOrders } = await supabase
    .from('orders')
    .select('id, order_number, order_type, status, created_at, customers(name)')
    .match(isStaff ? {} : { customer_id: customerId })
    .order('created_at', { ascending: false })
    .limit(8)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          {isStaff ? 'Warehouse overview — all customers' : `Welcome back, ${profile?.full_name}`}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(({ label, value, icon: Icon, color, bg, href }) => (
          <Link key={label} href={href} className="card p-5 hover:shadow-md transition-shadow group">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-500 group-hover:text-gray-700 transition-colors">{label}</p>
              <div className={`${bg} p-2 rounded-md`}>
                <Icon size={16} className={color} />
              </div>
            </div>
            <p className="text-3xl font-semibold text-gray-900">{value}</p>
          </Link>
        ))}
      </div>

      {/* Recent orders */}
      <div className="card">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Recent orders</h2>
        </div>
        <div className="divide-y divide-gray-50">
          {recentOrders?.length === 0 && (
            <p className="px-5 py-8 text-sm text-gray-400 text-center">No orders yet</p>
          )}
          {recentOrders?.map((order: any) => (
            <Link
              key={order.id}
              href={`/orders/${order.order_type}/${order.id}`}
              className="px-5 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                {order.order_type === 'inbound'
                  ? <ArrowDownCircle size={15} className="text-blue-500" />
                  : <ArrowUpCircle size={15} className="text-orange-500" />
                }
                <div>
                  <p className="text-sm font-medium text-gray-800">{order.order_number}</p>
                  {isStaff && <p className="text-xs text-gray-400">{order.customers?.name}</p>}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`status-${order.status} px-2 py-0.5 rounded text-xs font-medium`}>
                  {order.status.replace('_', ' ')}
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(order.created_at).toLocaleDateString()}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
