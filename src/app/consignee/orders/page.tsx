import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

const STATUS_COLORS: Record<string, string> = {
  submitted: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  picked:    'bg-blue-50 text-blue-700 border-blue-200',
  packed:    'bg-purple-50 text-purple-700 border-purple-200',
  shipped:   'bg-green-50 text-green-700 border-green-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
}

export default async function ConsigneeOrdersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('consignee_id')
    .eq('id', user!.id)
    .single()

  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_number, status, ship_by_date, created_at, reference_type, reference_number, carrier, tracking_number, order_items(quantity, skus(sku_code, description))')
    .eq('consignee_id', profile?.consignee_id)
    .eq('order_type', 'outbound')
    .neq('status', 'draft')
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-semibold text-gray-900 mb-1">My Orders</h1>
      <p className="text-sm text-gray-500 mb-6">{(orders ?? []).length} order{(orders ?? []).length !== 1 ? 's' : ''}</p>

      <div className="space-y-3">
        {(orders ?? []).length === 0 && (
          <div className="card px-6 py-10 text-center text-sm text-gray-400">No orders found</div>
        )}
        {(orders ?? []).map((o: any) => {
          const totalQty = (o.order_items ?? []).reduce((s: number, i: any) => s + i.quantity, 0)
          const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? ''
          return (
            <div key={o.id} className="card p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-base font-semibold text-gray-900">{o.order_number}</h2>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium capitalize ${STATUS_COLORS[o.status] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                      {o.status}
                    </span>
                  </div>
                  {o.reference_type && o.reference_number && (
                    <p className="text-xs text-gray-500">{o.reference_type}: <span className="font-mono">{o.reference_number}</span></p>
                  )}
                  {o.ship_by_date && (
                    <p className="text-xs text-gray-500">
                      Ship by: {new Date(o.ship_by_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-700">{totalQty} units</p>
                  {o.carrier && <p className="text-xs text-gray-500">{o.carrier}</p>}
                  {o.tracking_number && (
                    <p className="text-xs font-mono text-blue-600 mt-0.5">{o.tracking_number}</p>
                  )}
                </div>
              </div>

              {/* Items */}
              {(o.order_items ?? []).length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
                  {o.order_items.slice(0, 3).map((item: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                      <span className="font-mono text-orange-600">{item.skus?.sku_code}</span>
                      <span className="text-gray-400">·</span>
                      <span>{item.skus?.description}</span>
                      <span className="ml-auto font-medium text-gray-800">×{item.quantity}</span>
                    </div>
                  ))}
                  {o.order_items.length > 3 && (
                    <p className="text-xs text-gray-400">+{o.order_items.length - 3} more items</p>
                  )}
                </div>
              )}

              <div className="mt-3 pt-3 border-t border-gray-100">
                <Link href={`/track/${o.order_number}`}
                  className="text-xs text-orange-600 hover:text-orange-700 font-medium hover:underline">
                  Track shipment →
                </Link>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
