import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/Sidebar'
import TrialBanner from '@/components/layout/TrialBanner'
import type { Profile, Customer } from '@/types'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/auth/login')

  let customer: Customer | null = null
  if (profile.customer_id) {
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('id', profile.customer_id)
      .single()
    customer = data
  }

  const isStaff = profile.role === 'warehouse_staff' || profile.role === 'admin'
  const trialExpired = !isStaff && customer?.status === 'trial' && customer?.trial_ends_at
    ? new Date(customer.trial_ends_at) < new Date()
    : false

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar profile={profile as Profile} customer={customer} />
      <main className="flex-1 overflow-auto flex flex-col">
        {customer?.status === 'trial' && customer?.trial_ends_at && (
          <TrialBanner trialEndsAt={customer.trial_ends_at} expired={trialExpired} />
        )}
        {trialExpired ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md px-6">
              <div className="bg-red-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🔒</span>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Trial expired</h2>
              <p className="text-gray-500 text-sm mb-4">
                Your 14-day trial has ended. Contact us to activate your account and regain full access.
              </p>
              <a href="mailto:hello@mondayseed.com" className="btn-primary inline-flex">
                Contact us to activate
              </a>
            </div>
          </div>
        ) : (
          <div className="max-w-7xl mx-auto px-6 py-6 w-full">
            {children}
          </div>
        )}
      </main>
    </div>
  )
}
