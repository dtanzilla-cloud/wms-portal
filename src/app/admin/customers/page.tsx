import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Users, Plus, CheckCircle, Clock, Ban, Pencil } from 'lucide-react'

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    trial: 'bg-amber-50 text-amber-600',
    active: 'bg-green-50 text-green-600',
    suspended: 'bg-red-50 text-red-500',
  }
  const icons: Record<string, React.ReactNode> = {
    trial: <Clock size={11} />,
    active: <CheckCircle size={11} />,
    suspended: <Ban size={11} />,
  }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${styles[status] ?? styles.trial}`}>
      {icons[status]}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

export default async function AdminCustomersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user!.id).single()
  if (profile?.role !== 'admin' && profile?.role !== 'warehouse_staff') redirect('/dashboard')

  const { data: customers } = await supabase
    .from('customers')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Customers</h1>
          <p className="text-sm text-gray-500 mt-1">{customers?.length ?? 0} accounts</p>
        </div>
        <Link href="/admin/customers/new" className="btn-primary flex items-center gap-2">
          <Plus size={15} /> Add customer
        </Link>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Company</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Billing email</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Status</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Trial ends</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Created</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {customers?.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-gray-400 text-xs">
                    <Users size={24} className="mx-auto mb-2 text-gray-300" />
                    No customers yet
                  </td>
                </tr>
              )}
              {customers?.map((c: any) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <Link href={`/admin/customers/${c.id}`} className="font-medium text-blue-700 hover:underline">
                      {c.name}
                    </Link>
                    <p className="text-xs text-gray-400 font-mono">{c.code}</p>
                  </td>
                  <td className="px-5 py-3 text-gray-600">{c.billing_email}</td>
                  <td className="px-5 py-3"><StatusBadge status={c.status} /></td>
                  <td className="px-5 py-3 text-gray-500 text-xs">
                    {c.trial_ends_at
                      ? new Date(c.trial_ends_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : '—'}
                  </td>
                  <td className="px-5 py-3 text-gray-400 text-xs">{new Date(c.created_at).toLocaleDateString()}</td>
                  <td className="px-5 py-3 text-right">
                    <Link href={`/admin/customers/${c.id}/edit`} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800">
                      <Pencil size={12} /> Edit
                    </Link>
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
