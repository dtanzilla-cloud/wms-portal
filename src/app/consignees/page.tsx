import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, Building2, MapPin } from 'lucide-react'

export default async function ConsigneesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user!.id).single()
  const isStaff = profile?.role === 'warehouse_staff' || profile?.role === 'admin'

  const { data: consignees } = await supabase
    .from('consignees')
    .select('*, consignee_addresses(*), customers(name)')
    .match(isStaff ? {} : { customer_id: profile?.customer_id })
    .order('company_name')

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Consignees</h1>
          <p className="text-sm text-gray-500 mt-1">Your customers' ship-to addresses</p>
        </div>
        <Link href="/consignees/new" className="btn-primary flex items-center gap-2">
          <Plus size={15} /> Add consignee
        </Link>
      </div>

      {consignees?.length === 0 && (
        <div className="card p-12 text-center">
          <Building2 size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">No consignees yet</p>
          <p className="text-xs text-gray-400 mt-1">Add your first consignee to start creating outbound orders</p>
          <Link href="/consignees/new" className="btn-primary inline-flex items-center gap-2 mt-4">
            <Plus size={14} /> Add consignee
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {consignees?.map((c: any) => {
          const defaultAddr = c.consignee_addresses?.find((a: any) => a.is_default) ?? c.consignee_addresses?.[0]
          return (
            <Link key={c.id} href={`/consignees/${c.id}`} className="card p-5 hover:shadow-md transition-shadow block">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="bg-blue-50 p-2 rounded-md">
                    <Building2 size={15} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{c.company_name}</p>
                    {isStaff && <p className="text-xs text-gray-400">{c.customers?.name}</p>}
                  </div>
                </div>
                <span className="text-xs text-gray-400">
                  {c.consignee_addresses?.length ?? 0} addr.
                </span>
              </div>
              {defaultAddr && (
                <div className="flex items-start gap-1.5 text-xs text-gray-500">
                  <MapPin size={11} className="mt-0.5 shrink-0 text-gray-400" />
                  <span>{defaultAddr.address_line1}, {defaultAddr.city}, {defaultAddr.state}</span>
                </div>
              )}
              {c.contact_name && (
                <p className="text-xs text-gray-400 mt-1">{c.contact_name}</p>
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
