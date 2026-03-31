'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Package, ArrowDownCircle, ArrowUpCircle,
  FileText, Users, History, Settings, Building2, Truck
} from 'lucide-react'
import type { Profile, Customer } from '@/types'
import SignOutButton from './SignOutButton'

interface SidebarProps {
  profile: Profile
  customer?: Customer | null
}

const customerNav = [
  { href: '/dashboard',           label: 'Dashboard',       icon: LayoutDashboard },
  { href: '/inventory',           label: 'Inventory',        icon: Package },
  { href: '/orders/inbound',      label: 'Inbound Orders',   icon: ArrowDownCircle },
  { href: '/orders/outbound',     label: 'Outbound Orders',  icon: ArrowUpCircle },
  { href: '/consignees',          label: 'Consignees',       icon: Building2 },
  { href: '/carriers',            label: 'Carriers',         icon: Truck },
  { href: '/documents',           label: 'Documents',        icon: FileText },
  { href: '/settings',            label: 'Settings',         icon: Settings },
]

const staffNav = [
  { href: '/dashboard',           label: 'Dashboard',        icon: LayoutDashboard },
  { href: '/admin/customers',     label: 'Customers',         icon: Users },
  { href: '/inventory',           label: 'Inventory',         icon: Package },
  { href: '/orders/inbound',      label: 'Inbound Queue',     icon: ArrowDownCircle },
  { href: '/orders/outbound',     label: 'Outbound Queue',    icon: ArrowUpCircle },
  { href: '/inventory/history',   label: 'Stock History',     icon: History },
  { href: '/consignees',          label: 'Consignees',        icon: Building2 },
  { href: '/carriers',            label: 'Carriers',          icon: Truck },
  { href: '/documents',           label: 'Documents',         icon: FileText },
  { href: '/settings',            label: 'Settings',          icon: Settings },
]

export default function Sidebar({ profile, customer }: SidebarProps) {
  const pathname = usePathname()
  const isStaff = profile.role === 'warehouse_staff' || profile.role === 'admin'
  const nav = isStaff ? staffNav : customerNav

  const isTrial = customer?.status === 'trial'
  const trialEnds = customer?.trial_ends_at
    ? new Date(customer.trial_ends_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null

  return (
    <aside className="w-60 min-h-screen bg-white border-r border-gray-200 flex flex-col shadow-lg md:shadow-none">
      {/* Logo */}
      <div className="px-5 py-4 border-b border-gray-200">
        <span className="text-lg font-semibold text-blue-700 tracking-tight">CTS Portal</span>
      </div>

      {/* Customer context (staff view) */}
      {isStaff && (
        <div className="px-4 py-3 border-b border-gray-100 bg-blue-50">
          <p className="text-xs text-blue-600 font-medium">Staff view</p>
        </div>
      )}

      {/* Trial banner */}
      {isTrial && trialEnds && (
        <div className="mx-3 mt-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-md">
          <p className="text-xs font-medium text-amber-700">Trial account</p>
          <p className="text-xs text-amber-600">Expires {trialEnds}</p>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {nav.map(({ href, label, icon: Icon }) => {
          // A link is active if it matches exactly, or is a prefix — BUT only if no
          // other nav item is a longer (more specific) match for the current path.
          const isPrefix = pathname === href || pathname.startsWith(href + '/')
          const moreSpecificExists = nav.some(
            other => other.href !== href && other.href.startsWith(href) && (pathname === other.href || pathname.startsWith(other.href + '/'))
          )
          const active = isPrefix && !moreSpecificExists
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                active
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Icon size={16} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* User footer */}
      <div className="px-4 py-3 border-t border-gray-200">
        <p className="text-xs font-medium text-gray-800 truncate">{profile.full_name}</p>
        <p className="text-xs text-gray-500 truncate">{profile.email}</p>
        <SignOutButton />
      </div>
    </aside>
  )
}
