import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, Truck } from 'lucide-react'

export default async function CarriersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  const isStaff = profile?.role === 'warehouse_staff' || profile?.role === 'admin'
  if (!isStaff) redirect('/dashboard')

  const { data: carriers } = await supabase
    .from('carriers')
    .select('*')
    .order('name')

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Carriers</h1>
          <p className="text-sm text-gray-500 mt-1">Shipping carriers used on outbound orders</p>
        </div>
        <Link href="/carriers/new" className="btn-primary flex items-center gap-2">
          <Plus size={15} /> Add carrier
        </Link>
      </div>

      {carriers?.length === 0 && (
        <div className="card p-12 text-center">
          <Truck size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">No carriers yet</p>
          <p className="text-xs text-gray-400 mt-1">Add carriers to quickly select them on outbound orders</p>
          <Link href="/carriers/new" className="btn-primary inline-flex items-center gap-2 mt-4">
            <Plus size={14} /> Add carrier
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {carriers?.map((c: any) => (
          <Link key={c.id} href={`/carriers/${c.id}`} className="card p-5 hover:shadow-md transition-shadow block">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-orange-50 p-2 rounded-md">
                <Truck size={15} className="text-orange-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{c.name}</p>
                {c.scac_code && <p className="text-xs text-gray-400 font-mono">{c.scac_code}</p>}
              </div>
            </div>
            {c.contact_name && <p className="text-xs text-gray-500">{c.contact_name}</p>}
            {c.contact_email && <p className="text-xs text-gray-400">{c.contact_email}</p>}
          </Link>
        ))}
      </div>
    </div>
  )
}
