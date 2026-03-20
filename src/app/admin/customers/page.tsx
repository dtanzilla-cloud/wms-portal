import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Users } from 'lucide-react'
import CustomerStatusToggle from '@/components/admin/CustomerStatusToggle'

export default async function AdminCustomersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user!.id).single()
  if (profile?.role !== 'admin' && profile?.role !== 'warehouse_staff') redirect('/dashboard')

  const { data: customers } = await supabase
    .from('customers')
    .select('*, profiles(count)')
    .order('created_at', { ascending: false })

  const statusIcon = { active: CheckCircle, trial: Clock, suspended: Ban }
  const statusColor = { active: 'text-green-600', trial: 'text-amber-600', suspended: 'text-red-500' }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Customers</h1>
          <p className="text-sm text-gray-500 mt-1">{customers?.length ?? 0} accounts</p>
        </div>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Company</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Code</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Billing email</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Status</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Trial ends</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Created</th>
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
              {customers?.map((c: any) => {
                const Icon = statusIcon[c.status as keyof typeof statusIcon] ?? Clock
                const color = statusColor[c.status as keyof typeof statusColor] ?? 'text-gray-500'
                return (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-800">{c.name}</td>
                    <td className="px-5 py-3 font-mono text-xs text-gray-500">{c.code}</td>
                    <td className="px-5 py-3 text-gray-600">{c.billing_email}</td>
                    <td className="px-5 py-3">
                      <CustomerStatusToggle customer={c} />
                    </td>
                    <td className="px-5 py-3 text-gray-500 text-xs">
                      {c.trial_ends_at
                        ? new Date(c.trial_ends_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : '—'}
                    </td>
                    <td className="px-5 py-3 text-gray-400 text-xs">
                      {new Date(c.created_at).toLocaleDateString()}
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
