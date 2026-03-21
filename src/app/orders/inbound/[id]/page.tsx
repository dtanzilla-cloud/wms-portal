import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ArrowDownCircle, Package, Truck, FileText, CheckCircle } from 'lucide-react'
import OrderStatusActions from '@/components/orders/OrderStatusActions'
import DocumentUpload from '@/components/documents/DocumentUpload'
import OrderPhotos from '@/components/orders/OrderPhotos'
import CancelOrderButton from '@/components/orders/CancelOrderButton'

export default async function InboundOrderDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user!.id).single()
  const isStaff = profile?.role === 'warehouse_staff' || profile?.role === 'admin'

  const { data: order } = await supabase
    .from('orders')
    .select('*, customers(name, billing_email), order_items(*, skus(sku_code, description, unit)), documents(*)')
    .eq('id', params.id)
    .single()

  if (!order) notFound()

  // Check access
  if (!isStaff && order.customer_id !== profile?.customer_id) notFound()

  const statusFlow = ['draft', 'submitted', 'received', 'put_away']
  const currentIdx = statusFlow.indexOf(order.status)

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <Link href="/orders/inbound" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft size={14} /> Back to inbound orders
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <ArrowDownCircle size={18} className="text-blue-500" />
              <h1 className="text-2xl font-semibold text-gray-900">{order.order_number}</h1>
              <span className={`status-${order.status} px-2 py-0.5 rounded text-xs font-medium`}>
                {order.status.replace('_', ' ')}
              </span>
            </div>
            {isStaff && <p className="text-sm text-gray-500 ml-9">{order.customers?.name}</p>}
          </div>
          {isStaff && <OrderStatusActions order={order} type="inbound" />}
          {!isStaff && ['draft', 'submitted'].includes(order.status) && (
            <CancelOrderButton orderId={order.id} />
          )}
        </div>
      </div>

      {/* Status progress */}
      <div className="card p-5 mb-5">
        <div className="flex items-center">
          {statusFlow.map((s, i) => (
            <div key={s} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                  i < currentIdx ? 'bg-blue-600 text-white' :
                  i === currentIdx ? 'bg-blue-100 border-2 border-blue-600 text-blue-700' :
                  'bg-gray-100 text-gray-400'
                }`}>
                  {i < currentIdx ? <CheckCircle size={14} /> : i + 1}
                </div>
                <span className={`text-xs mt-1.5 capitalize ${i <= currentIdx ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>
                  {s.replace('_', ' ')}
                </span>
              </div>
              {i < statusFlow.length - 1 && (
                <div className={`h-0.5 flex-1 mx-2 mb-4 ${i < currentIdx ? 'bg-blue-600' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Line items */}
        <div className="lg:col-span-2 space-y-5">
          <div className="card">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
              <Package size={15} className="text-gray-500" />
              <h2 className="text-sm font-semibold text-gray-700">Items</h2>
              <span className="text-xs text-gray-400 ml-auto">{order.order_items?.length ?? 0} lines</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">SKU</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Description</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-gray-500">Qty</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-gray-500">Cartons</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-gray-500">Units/ctn</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {order.order_items?.map((item: any) => (
                  <tr key={item.id}>
                    <td className="px-5 py-3 font-mono text-xs text-blue-700">{item.skus?.sku_code}</td>
                    <td className="px-5 py-3 text-gray-700">{item.skus?.description}</td>
                    <td className="px-5 py-3 text-right text-gray-800 font-medium">{item.quantity}</td>
                    <td className="px-5 py-3 text-right text-gray-600">{item.carton_count ?? '—'}</td>
                    <td className="px-5 py-3 text-right text-gray-600">{item.units_per_carton ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Documents */}
          <DocumentUpload orderId={order.id} documents={order.documents ?? []} />

          {/* Photos */}
          <OrderPhotos orderId={order.id} />
        </div>

        {/* Side panel */}
        <div className="space-y-5">
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Shipment info</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Expected</dt>
                <dd className="text-gray-800">
                  {order.expected_date
                    ? new Date(order.expected_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : '—'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Pallets</dt>
                <dd className="text-gray-800">{order.pallet_count}</dd>
              </div>
              {order.carrier && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Carrier</dt>
                  <dd className="text-gray-800">{order.carrier}</dd>
                </div>
              )}
              {order.tracking_number && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Tracking</dt>
                  <dd className="text-gray-800 font-mono text-xs">{order.tracking_number}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-gray-500">Created</dt>
                <dd className="text-gray-800">{new Date(order.created_at).toLocaleDateString()}</dd>
              </div>
            </dl>
          </div>

          {order.notes && (
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-2">Notes</h2>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{order.notes}</p>
            </div>
          )}

          {isStaff && order.internal_notes && (
            <div className="card p-5 border-amber-200 bg-amber-50">
              <h2 className="text-sm font-semibold text-amber-700 mb-2">Internal notes</h2>
              <p className="text-sm text-amber-800 whitespace-pre-wrap">{order.internal_notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
