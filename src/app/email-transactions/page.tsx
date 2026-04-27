import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import EmailTransactionsClient from './EmailTransactionsClient'

export default async function EmailTransactionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isStaff = profile?.role === 'warehouse_staff' || profile?.role === 'admin'
  if (!isStaff) redirect('/')

  const admin = createAdminClient()

  const { data: transactions } = await admin
    .from('email_transactions')
    .select('*')
    .order('created_at', { ascending: false })

  const { data: skus } = await admin
    .from('skus')
    .select('id, sku_code, description, customer_id')
    .order('sku_code')

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Email Transaction Log</h1>
        <p className="text-sm text-gray-500 mt-1">Inventory actions received via email</p>
      </div>
      <EmailTransactionsClient
        transactions={transactions ?? []}
        skus={skus ?? []}
      />
    </div>
  )
}
