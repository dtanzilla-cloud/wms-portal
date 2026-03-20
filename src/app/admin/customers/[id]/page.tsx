import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ArrowDownCircle, ArrowUpCircle, Users, Package } from 'lucide-react'
import CustomerStatusToggle from '@/components/admin/CustomerStatusToggle'

export default async function AdminCustomerDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  if (!profile || !['warehouse_staff', 'admin'].includes(profile.role)) redirect('/dashboard')

  const { data: customer } = await supabase.from('customers').select('*').eq('id', params.id).single()
  if (!customer) notFound()

  const [{ data: users }, { data: orders }, { data: skus }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, email, role, created_at').eq('customer_id', params.id),
    supabase.from('orders').select('id, order_number, order_type, status, created_at').eq('customer_id', params.id).order('created_at', { ascending: false }).limit(10),
    supabase.from('skus').select('id', { count: 'exact', head: true }).eq('customer_id', params.id),
  ])

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <Link href="/admin/customers" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft size={14} /> Back to customers
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{customer.name}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{customer.billing_email} · <span className="font-mono text-xs">{customer.code}</span></p>
          </div>
          <CustomerStatusToggle customer={customer} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Users', value: users?.length ?? 0, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Orders', value: orders?.length ?? 0, icon: ArrowDownCircle, color: 'text-orange-600', bg: 'bg-orange-50' },
          { label: 'SKUs', value: (skus as any)?.count ?? 0, icon: Package, color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="card p-4 flex items-center gap-3">
            <div className={`${bg} p-2 rounded-md`}><Icon size={16} className={color} /></div>
            <div>
              <p className="text-2xl font-semibold text-gray-900">{value}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Users */}
        <div className="card">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Users</h2>
          </div>
          {users?.length === 0 ? (
            <p className="px-5 py-6 text-xs text-gray-400 text-center">No users</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {users?.map((u: any) => (
                <div key={u.id} className="px-5 py-3">
                  <p className="text-sm font-medium text-gray-800">{u.full_name}</p>
                  <p className="text-xs text-gray-500">{u.email}</p>
                  <p className="text-xs text-gray-400 mt-0.5 capitalize">{u.role} · joined {new Date(u.created_at).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent orders */}
        <div className="card">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">Recent orders</h2>
          </div>
          {orders?.length === 0 ? (
            <p className="px-5 py-6 text-xs text-gray-400 text-center">No orders yet</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {orders?.map((o: any) => (
                <div key={o.id} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50">
                  <div className="flex items-center gap-2">
                    {o.order_type === 'inbound'
                      ? <ArrowDownCircle size={13} className="text-blue-400" />
                      : <ArrowUpCircle size={13} className="text-orange-400" />}
                    <Link href={`/orders/${o.order_type}/${o.id}`} className="text-sm font-medium text-blue-700 hover:underline font-mono text-xs">
                      {o.order_number}
                    </Link>
                  </div>
                  <span className={`status-${o.status} px-2 py-0.5 rounded text-xs font-medium`}>
                    {o.status.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Account details */}
      <div className="card p-5 mt-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Account details</h2>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-gray-500 text-xs">Created</dt><dd className="text-gray-800">{new Date(customer.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</dd></div>
          <div><dt className="text-gray-500 text-xs">Status</dt><dd className="text-gray-800 capitalize">{customer.status}</dd></div>
          {customer.trial_ends_at && (
            <div><dt className="text-gray-500 text-xs">Trial ends</dt><dd className="text-gray-800">{new Date(customer.trial_ends_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</dd></div>
          )}
          <div><dt className="text-gray-500 text-xs">Customer code</dt><dd className="font-mono text-xs text-gray-800">{customer.code}</dd></div>
        </dl>
      </div>
    </div>
  )
}
