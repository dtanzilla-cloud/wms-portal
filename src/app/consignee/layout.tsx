import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { LayoutDashboard, Package, ArrowUpCircle } from 'lucide-react'
import SignOutButton from '@/components/layout/SignOutButton'

export default async function ConsigneeLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, consignee_id, consignees(company_name)')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'consignee') redirect('/dashboard')

  const companyName = (profile.consignees as any)?.company_name ?? 'My Account'

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-56 min-h-screen bg-white border-r border-gray-200 flex flex-col">
        <div className="px-5 py-4 border-b border-gray-200">
          <span className="text-base font-semibold text-blue-700">CTS Portal</span>
          <p className="text-xs text-gray-500 mt-0.5 truncate">{companyName}</p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          <Link href="/consignee" className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 rounded-md hover:bg-gray-50 hover:text-gray-900 transition-colors">
            <LayoutDashboard size={15} className="text-gray-400" />
            Dashboard
          </Link>
          <Link href="/consignee/inventory" className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 rounded-md hover:bg-gray-50 hover:text-gray-900 transition-colors">
            <Package size={15} className="text-gray-400" />
            Inventory
          </Link>
          <Link href="/consignee/orders" className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 rounded-md hover:bg-gray-50 hover:text-gray-900 transition-colors">
            <ArrowUpCircle size={15} className="text-gray-400" />
            My Orders
          </Link>
        </nav>
        <div className="px-5 py-4 border-t border-gray-100">
          <p className="text-xs text-gray-500 mb-2 truncate">{profile.full_name}</p>
          <SignOutButton />
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-8 overflow-auto">
        {children}
      </main>
    </div>
  )
}
