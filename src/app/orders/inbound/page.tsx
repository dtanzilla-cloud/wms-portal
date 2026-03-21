import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import InboundOrdersTable from './InboundOrdersTable'

export default async function InboundOrdersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user!.id).single()
  const isStaff = profile?.role === 'warehouse_staff' || profile?.role === 'admin'

  const { data: orders } = await supabase
    .from('orders')
    .select('*, customers(name)')
    .eq('order_type', 'inbound')
    .match(isStaff ? {} : { customer_id: profile?.customer_id })
    .order('created_at', { ascending: false })

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {isStaff ? 'Inbound Queue' : 'Inbound Orders'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{orders?.length ?? 0} orders</p>
        </div>
        <Link href="/orders/inbound/new" className="btn-primary flex items-center gap-2">
          <Plus size={15} /> New inbound
        </Link>
      </div>

      <div className="card">
        <InboundOrdersTable orders={orders ?? []} isStaff={isStaff} />
      </div>
    </div>
  )
}
