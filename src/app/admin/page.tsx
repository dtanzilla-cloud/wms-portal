import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Users, Package, ArrowDownCircle, ArrowUpCircle, ShieldCheck } from 'lucide-react'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user!.id).single()
  if (profile?.role !== 'admin' && profile?.role !== 'warehouse_staff') redirect('/dashboard')

  const [customers, skus, inbound, outbound] = await Promise.all([
    supabase.from('customers').select('id', { count: 'exact', head: true }),
    supabase.from('skus').select('id', { count: 'exact', head: true }),
    supabase.from('orders').select('id', { count: 'exact', head: true }).eq('order_type', 'inbound').in('status', ['submitted', 'received']),
    supabase.from('orders').select('id', { count: 'exact', head: true }).eq('order_type', 'outbound').in('status', ['submitted', 'picked', 'packed']),
  ])

  const stats = [
    { label: 'Total customers', value: customers.count ?? 0, icon: Users, href: '/admin/customers', color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Total SKUs', value: skus.count ?? 0, icon: Package, href: '/inventory', color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Open inbound', value: inbound.count ?? 0, icon: ArrowDownCircle, href: '/orders/inbound', color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Open outbound', value: outbound.count ?? 0, icon: ArrowUpCircle, href: '/orders/outbound', color: 'text-orange-600', bg: 'bg-orange-50' },
  ]

  const { data: recentCustomers } = await supabase
    .from('customers')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5)

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <ShieldCheck size={20} className="text-blue-600" />
        <h1 className="text-2xl font-semibold text-gray-900">Admin</h1>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(({ label, value, icon: Icon, href, color, bg }) => (
          <Link key={label} href={href} className="card p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-500">{label}</p>
              <div className={`${bg} p-2 rounded-md`}>
                <Icon size={16} className={color} />
              </div>
            </div>
            <p className="text-3xl font-semibold text-gray-900">{value}</p>
          </Link>
        ))}
      </div>

      <div className="card">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Recent customers</h2>
          <Link href="/admin/customers" className="text-xs text-blue-600 hover:underline">View all</Link>
        </div>
        <div className="divide-y divide-gray-50">
          {recentCustomers?.map((c: any) => (
            <div key={c.id} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50">
              <div>
                <p className="text-sm font-medium text-gray-800">{c.name}</p>
                <p className="text-xs text-gray-400">{c.billing_email}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  c.status === 'active' ? 'bg-green-100 text-green-700' :
                  c.status === 'trial' ? 'bg-amber-100 text-amber-700' :
                  'bg-red-100 text-red-700'
                }`}>{c.status}</span>
                <span className="text-xs text-gray-400">{new Date(c.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
