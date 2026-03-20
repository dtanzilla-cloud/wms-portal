import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Building2, MapPin, Phone, Mail, ArrowUpCircle } from 'lucide-react'

export default async function ConsigneeDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user!.id).single()
  const isStaff = profile?.role === 'warehouse_staff' || profile?.role === 'admin'

  const { data: consignee } = await supabase
    .from('consignees')
    .select('*, consignee_addresses(*), customers(name)')
    .eq('id', params.id)
    .single()

  if (!consignee) notFound()
  if (!isStaff && consignee.customer_id !== profile?.customer_id) notFound()

  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_number, status, ship_by_date, created_at')
    .eq('consignee_id', params.id)
    .order('created_at', { ascending: false })
    .limit(10)

  const sortedAddresses = [...(consignee.consignee_addresses ?? [])].sort((a: any, b: any) =>
    b.is_default - a.is_default
  )

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <Link href="/consignees" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft size={14} /> Back to consignees
        </Link>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-50 p-2.5 rounded-lg">
              <Building2 size={20} className="text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">{consignee.company_name}</h1>
              {isStaff && <p className="text-sm text-gray-500">{consignee.customers?.name}</p>}
            </div>
          </div>
          <Link href={`/orders/outbound/new`} className="btn-primary flex items-center gap-2 text-sm">
            <ArrowUpCircle size={14} /> New order
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="space-y-5">
          {/* Contact info */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Contact</h2>
            <div className="space-y-2">
              {consignee.contact_name && (
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Building2 size={13} className="text-gray-400 shrink-0" />
                  {consignee.contact_name}
                </div>
              )}
              {consignee.contact_phone && (
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Phone size={13} className="text-gray-400 shrink-0" />
                  {consignee.contact_phone}
                </div>
              )}
              {consignee.contact_email && (
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Mail size={13} className="text-gray-400 shrink-0" />
                  <a href={`mailto:${consignee.contact_email}`} className="text-blue-600 hover:underline">
                    {consignee.contact_email}
                  </a>
                </div>
              )}
              {!consignee.contact_name && !consignee.contact_phone && !consignee.contact_email && (
                <p className="text-xs text-gray-400">No contact details</p>
              )}
            </div>
          </div>

          {/* Addresses */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">
              Addresses
              <span className="text-gray-400 font-normal ml-1">({sortedAddresses.length})</span>
            </h2>
            <div className="space-y-3">
              {sortedAddresses.map((addr: any) => (
                <div key={addr.id} className="border border-gray-100 rounded-md p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <MapPin size={11} className="text-gray-400" />
                    <span className="text-xs font-medium text-gray-700">{addr.label}</span>
                    {addr.is_default && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Default</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 ml-3">{addr.address_line1}</p>
                  {addr.address_line2 && <p className="text-xs text-gray-600 ml-3">{addr.address_line2}</p>}
                  <p className="text-xs text-gray-600 ml-3">{addr.city}, {addr.state} {addr.postal_code}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Order history */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700">Order history</h2>
            </div>
            {orders?.length === 0 ? (
              <p className="px-5 py-8 text-xs text-gray-400 text-center">No orders yet for this consignee</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {orders?.map((order: any) => (
                  <div key={order.id} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50">
                    <div className="flex items-center gap-2">
                      <ArrowUpCircle size={13} className="text-orange-400" />
                      <Link href={`/orders/outbound/${order.id}`} className="text-sm font-medium text-blue-700 hover:underline">
                        {order.order_number}
                      </Link>
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
