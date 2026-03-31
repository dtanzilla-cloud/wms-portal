import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Truck, Phone, Mail, User, ArrowUpCircle, Pencil } from 'lucide-react'

export default async function CarrierDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()

  const { data: carrier } = await supabase
    .from('carriers')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!carrier) notFound()

  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_number, status, ship_by_date, created_at, customers(name)')
    .eq('carrier', carrier.name)
    .eq('order_type', 'outbound')
    .order('created_at', { ascending: false })
    .limit(10)

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <Link href="/carriers" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft size={14} /> Back to carriers
        </Link>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-orange-50 p-2.5 rounded-lg">
              <Truck size={20} className="text-orange-600" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">{carrier.name}</h1>
              {carrier.scac_code && (
                <p className="text-sm text-gray-500 font-mono">{carrier.scac_code}</p>
              )}
            </div>
          </div>
          <Link href={`/carriers/${params.id}/edit`} className="btn-secondary flex items-center gap-2 text-sm">
            <Pencil size={13} /> Edit
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="space-y-5">
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Contact</h2>
            <div className="space-y-2">
              {carrier.contact_name && (
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <User size={13} className="text-gray-400 shrink-0" />
                  {carrier.contact_name}
                </div>
              )}
              {carrier.contact_phone && (
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Phone size={13} className="text-gray-400 shrink-0" />
                  {carrier.contact_phone}
                </div>
              )}
              {carrier.contact_email && (
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Mail size={13} className="text-gray-400 shrink-0" />
                  <a href={`mailto:${carrier.contact_email}`} className="text-blue-600 hover:underline">
                    {carrier.contact_email}
                  </a>
                </div>
              )}
              {!carrier.contact_name && !carrier.contact_phone && !carrier.contact_email && (
                <p className="text-xs text-gray-400">No contact details</p>
              )}
            </div>
          </div>

          {carrier.notes && (
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-2">Notes</h2>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{carrier.notes}</p>
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          <div className="card">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700">Recent orders</h2>
            </div>
            {orders?.length === 0 ? (
              <p className="px-5 py-8 text-xs text-gray-400 text-center">No orders yet for this carrier</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {orders?.map((order: any) => (
                  <div key={order.id} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50">
                    <div className="flex items-center gap-2">
                      <ArrowUpCircle size={13} className="text-orange-400" />
                      <Link href={`/orders/outbound/${order.id}`} className="text-sm font-medium text-blue-700 hover:underline">
                        {order.order_number}
                      </Link>
                      {order.customers?.name && (
                        <span className="text-xs text-gray-400">{order.customers.name}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`status-${order.status} px-2 py-0.5 rounded text-xs font-medium`}>
                        {order.status.replace('_', ' ')}
                      </span>
                      {order.ship_by_date && (
                        <span className="text-xs text-gray-400">
                          {new Date(order.ship_by_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
