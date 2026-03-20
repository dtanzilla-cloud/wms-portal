import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ChangePasswordForm from '@/components/settings/ChangePasswordForm'
import StaffManager from '@/components/settings/StaffManager'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const isStaff = profile?.role === 'warehouse_staff' || profile?.role === 'admin'
  const isAdmin = profile?.role === 'admin'

  // Fetch all staff for admin view
  let staffList: any[] = []
  if (isStaff) {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, created_at')
      .in('role', ['warehouse_staff', 'admin'])
      .order('created_at', { ascending: true })
    staffList = data ?? []
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your account and team</p>
      </div>

      <div className="space-y-6">
        {/* Account info */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Your account</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Name</dt>
              <dd className="text-gray-800 font-medium">{profile?.full_name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Email</dt>
              <dd className="text-gray-800">{profile?.email}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Role</dt>
              <dd className="text-gray-800 capitalize">{profile?.role?.replace('_', ' ')}</dd>
            </div>
          </dl>
        </div>

        {/* Change password */}
        <ChangePasswordForm />

        {/* Staff management — staff only */}
        {isStaff && (
          <StaffManager staffList={staffList} currentUserId={user.id} isAdmin={isAdmin} />
        )}
      </div>
    </div>
  )
}
