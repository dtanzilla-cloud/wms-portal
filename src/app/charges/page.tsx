import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import RateEditor from './RateEditor'
import InvoiceSection from './InvoiceSection'

// ── Types ─────────────────────────────────────────────────────────────────────

type RawMovement = {
  id: string
  movement_type: string
  quantity: number
  handling_units: number | null
  moved_at: string
  skus: { sku_code: string; description: string } | null
}

type WeekRow = {
  weekNum: number
  startDate: Date
  endDate: Date
  unitsOnHand: number
  rate: number
  charge: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function fmtDateShort(d: Date) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/**
 * Returns weekly snapshot dates starting at day-1 of the month, then +7, +14…
 * while still within the month. Each date is the "billing snapshot" for that week.
 */
function weeklySnapshots(year: number, month: number): Date[] {
  const result: Date[] = []
  const last = new Date(year, month, 0) // last day of month
  let d = new Date(year, month - 1, 1)
  while (d <= last) {
    result.push(new Date(d))
    d = new Date(d)
    d.setDate(d.getDate() + 7)
  }
  return result
}

/**
 * Returns the total handling-units balance as of end-of-day on `date`.
 * Inbound adds, outbound subtracts. Never returns a negative.
 */
function balanceAt(movements: RawMovement[], date: Date): number {
  const cutoff = new Date(date)
  cutoff.setHours(23, 59, 59, 999)
  let balance = 0
  for (const m of movements) {
    if (new Date(m.moved_at) <= cutoff) {
      if (m.movement_type === 'inbound') balance += m.handling_units ?? 0
      else if (m.movement_type === 'outbound') balance -= m.handling_units ?? 0
    }
  }
  return Math.max(0, balance)
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  sub,
  accent,
  large,
}: {
  label: string
  value: string
  sub: string
  accent: 'blue' | 'green' | 'orange' | 'violet'
  large?: boolean
}) {
  const bg: Record<string, string> = {
    blue: 'bg-blue-50',
    green: 'bg-green-50',
    orange: 'bg-orange-50',
    violet: 'bg-violet-50',
  }
  const text: Record<string, string> = {
    blue: 'text-blue-700',
    green: 'text-green-700',
    orange: 'text-orange-700',
    violet: 'text-violet-700',
  }
  return (
    <div className={`rounded-xl p-5 ${bg[accent]}`}>
      <p className={`text-xs font-semibold uppercase tracking-widest mb-2 opacity-60 ${text[accent]}`}>{label}</p>
      <p className={`${large ? 'text-2xl font-bold' : 'text-xl font-semibold'} ${text[accent]}`}>{value}</p>
      <p className={`text-xs mt-1 opacity-50 ${text[accent]} truncate`}>{sub}</p>
    </div>
  )
}

function MovementTable({
  title,
  movements,
  rate,
  totalUnits,
  totalCharge,
  accentClass,
}: {
  title: string
  movements: RawMovement[]
  rate: number
  totalUnits: number
  totalCharge: number
  accentClass: string
}) {
  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-sm font-medium text-gray-700">{title}</h2>
        <span className="text-xs text-gray-400">{movements.length} movement{movements.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <th className="px-4 py-2.5 text-left font-medium">Date</th>
              <th className="px-4 py-2.5 text-left font-medium">SKU</th>
              <th className="px-4 py-2.5 text-right font-medium">HU</th>
              <th className="px-4 py-2.5 text-right font-medium">Charge</th>
            </tr>
          </thead>
          <tbody>
            {movements.map(m => (
              <tr key={m.id} className="border-t border-gray-50 hover:bg-gray-50/50">
                <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">
                  {new Date(m.moved_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </td>
                <td className="px-4 py-2.5 max-w-[180px]">
                  <span className={`font-mono text-xs ${accentClass}`}>
                    {(m.skus as any)?.sku_code ?? '—'}
                  </span>
                  <span className="ml-2 text-xs text-gray-500 truncate">
                    {(m.skus as any)?.description}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right font-medium text-gray-800">
                  {m.handling_units ?? <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-2.5 text-right font-medium text-gray-800">
                  {m.handling_units != null ? fmt(m.handling_units * rate) : <span className="text-gray-300">—</span>}
                </td>
              </tr>
            ))}
            {movements.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-sm text-gray-400">
                  No movements this month
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-200 bg-gray-50">
              <td colSpan={2} className="px-4 py-2.5 text-xs font-medium text-gray-600">
                {totalUnits} handling unit{totalUnits !== 1 ? 's' : ''}
              </td>
              <td colSpan={2} className="px-4 py-2.5 text-right font-semibold text-gray-900">
                {fmt(totalCharge)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ChargesPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, customers(*)')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/auth/login')
  if (profile.role === 'consignee') redirect('/consignee')

  const isStaff = profile.role === 'warehouse_staff' || profile.role === 'admin'

  // ── Customer resolution ────────────────────────────────────────────────────
  let customerId: string | null = null
  let customer: { id: string; name: string } | null = null
  let allCustomers: { id: string; name: string }[] = []

  if (isStaff) {
    const { data: customers } = await supabase
      .from('customers')
      .select('id, name')
      .order('name')
    allCustomers = customers ?? []
    const selectedId = (searchParams?.customer_id as string | undefined) ?? allCustomers[0]?.id
    customerId = selectedId ?? null
    customer = allCustomers.find(c => c.id === selectedId) ?? allCustomers[0] ?? null
  } else {
    customerId = profile.customer_id
    customer = (profile as any).customers ?? null
  }

  if (!customerId) {
    return (
      <div className="p-8 text-sm text-gray-500">No customer account found.</div>
    )
  }

  // ── Month resolution ───────────────────────────────────────────────────────
  const now = new Date()
  const monthStr = searchParams?.month as string | undefined
  let year: number, month: number

  if (monthStr && /^\d{4}-\d{2}$/.test(monthStr)) {
    ;[year, month] = monthStr.split('-').map(Number)
  } else {
    year = now.getFullYear()
    month = now.getMonth() + 1
  }

  const monthStart = new Date(year, month - 1, 1)
  const monthEndExclusive = new Date(year, month, 1)
  const monthLabel = monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const billingMonthStr = `${year}-${String(month).padStart(2, '0')}-01`
  const currentMonthStr = `${year}-${String(month).padStart(2, '0')}`

  const prevMonth = new Date(year, month - 2, 1)
  const nextMonth = new Date(year, month, 1)
  const prevParam = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`
  const nextParam = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`

  // Build URL helper (preserves customer_id for staff)
  function href(params: Record<string, string>) {
    const p: Record<string, string> = {}
    if (isStaff && customerId) p.customer_id = customerId
    return `/charges?${new URLSearchParams({ ...p, ...params }).toString()}`
  }

  // ── Data fetching ──────────────────────────────────────────────────────────
  const [
    { data: historicalRaw },
    { data: monthRaw },
    { data: rates },
    { data: invoices },
  ] = await Promise.all([
    // All inbound/outbound movements BEFORE this month — needed for running balance
    supabase
      .from('inventory_movements')
      .select('id, movement_type, handling_units, moved_at, quantity, skus(sku_code, description)')
      .eq('customer_id', customerId)
      .in('movement_type', ['inbound', 'outbound'])
      .lt('moved_at', monthStart.toISOString()),

    // Movements within the billing month
    supabase
      .from('inventory_movements')
      .select('id, movement_type, handling_units, moved_at, quantity, skus(sku_code, description)')
      .eq('customer_id', customerId)
      .gte('moved_at', monthStart.toISOString())
      .lt('moved_at', monthEndExclusive.toISOString())
      .order('moved_at'),

    // Charge rates for this customer
    supabase
      .from('charge_rates')
      .select('*')
      .eq('customer_id', customerId)
      .maybeSingle(),

    // Invoices for this billing month
    supabase
      .from('charge_invoices')
      .select('*')
      .eq('customer_id', customerId)
      .eq('billing_month', billingMonthStr)
      .order('created_at', { ascending: false }),
  ])

  const historical = (historicalRaw ?? []) as RawMovement[]
  const monthMovements = (monthRaw ?? []) as RawMovement[]
  const allMovements = [...historical, ...monthMovements]

  const storageRate = Number(rates?.storage_rate_per_unit_per_week ?? 0)
  const inboundRate = Number(rates?.inbound_rate_per_unit ?? 0)
  const outboundRate = Number(rates?.outbound_rate_per_unit ?? 0)

  // ── Charge calculations ────────────────────────────────────────────────────

  const inboundMovements = monthMovements.filter(m => m.movement_type === 'inbound')
  const outboundMovements = monthMovements.filter(m => m.movement_type === 'outbound')

  const totalInboundHU = inboundMovements.reduce((s, m) => s + (m.handling_units ?? 0), 0)
  const totalOutboundHU = outboundMovements.reduce((s, m) => s + (m.handling_units ?? 0), 0)
  const inboundCharge = totalInboundHU * inboundRate
  const outboundCharge = totalOutboundHU * outboundRate

  // Weekly storage — one snapshot per 7-day period starting on the 1st.
  // Each snapshot's balance × rate = that week's storage charge.
  // Summing these avoids double-counting: we use point-in-time balances, not movement sums.
  const snapshots = weeklySnapshots(year, month)
  const lastDay = new Date(year, month, 0)

  const weekRows: WeekRow[] = snapshots.map((snapDate, i) => {
    const weekEndRaw = new Date(snapDate)
    weekEndRaw.setDate(weekEndRaw.getDate() + 6)
    const endDate = weekEndRaw <= lastDay ? weekEndRaw : lastDay
    const units = balanceAt(allMovements, snapDate)
    return {
      weekNum: i + 1,
      startDate: snapDate,
      endDate,
      unitsOnHand: units,
      rate: storageRate,
      charge: units * storageRate,
    }
  })

  const storageCharge = weekRows.reduce((s, w) => s + w.charge, 0)
  const totalCharge = inboundCharge + storageCharge + outboundCharge

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-6xl">

      {/* Page header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-xl font-semibold text-gray-900">Charges</h1>

        {/* Staff: customer tabs */}
        {isStaff && allCustomers.length > 1 && (
          <div className="flex items-center gap-2 flex-wrap">
            {allCustomers.map(c => (
              <Link
                key={c.id}
                href={href({ customer_id: c.id, month: currentMonthStr })}
                className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                  c.id === customerId
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {c.name}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Month navigator */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href={href({ month: prevParam })}
          className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500 transition-colors"
        >
          <ChevronLeft size={15} />
        </Link>
        <span className="text-sm font-semibold text-gray-800 w-36 text-center">{monthLabel}</span>
        <Link
          href={href({ month: nextParam })}
          className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500 transition-colors"
        >
          <ChevronRight size={15} />
        </Link>
        {customer && isStaff && (
          <span className="text-sm text-gray-400 ml-1">— {customer.name}</span>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <SummaryCard
          label="Storage"
          value={fmt(storageCharge)}
          sub={`${weekRows.length} week${weekRows.length !== 1 ? 's' : ''} · ${storageRate > 0 ? fmt(storageRate) + '/unit/wk' : 'rate not set'}`}
          accent="blue"
        />
        <SummaryCard
          label="Inbound"
          value={fmt(inboundCharge)}
          sub={`${totalInboundHU} handling unit${totalInboundHU !== 1 ? 's' : ''}`}
          accent="green"
        />
        <SummaryCard
          label="Outbound"
          value={fmt(outboundCharge)}
          sub={`${totalOutboundHU} handling unit${totalOutboundHU !== 1 ? 's' : ''}`}
          accent="orange"
        />
        <SummaryCard
          label="Total"
          value={fmt(totalCharge)}
          sub={monthLabel}
          accent="violet"
          large
        />
      </div>

      {/* Rates */}
      {isStaff ? (
        <RateEditor
          customerId={customerId}
          rates={{
            storage_rate_per_unit_per_week: storageRate,
            inbound_rate_per_unit: inboundRate,
            outbound_rate_per_unit: outboundRate,
          }}
        />
      ) : (
        <div className="card p-5 mb-6">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Billing Rates</p>
          <div className="grid grid-cols-3 gap-6 text-sm">
            <div>
              <p className="text-xs text-gray-400">Storage</p>
              <p className="font-medium text-gray-900">{fmt(storageRate)}<span className="text-xs font-normal text-gray-400"> / unit / wk</span></p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Inbound</p>
              <p className="font-medium text-gray-900">{fmt(inboundRate)}<span className="text-xs font-normal text-gray-400"> / HU</span></p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Outbound</p>
              <p className="font-medium text-gray-900">{fmt(outboundRate)}<span className="text-xs font-normal text-gray-400"> / HU</span></p>
            </div>
          </div>
        </div>
      )}

      {/* Storage breakdown + Invoices */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">

        {/* Weekly storage table */}
        <div className="lg:col-span-2 card overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h2 className="text-sm font-medium text-gray-700">Weekly Storage Breakdown</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Balance at the start of each week · no double-counting
            </p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-5 py-2.5 text-left font-medium w-14">Wk</th>
                <th className="px-5 py-2.5 text-left font-medium">Period</th>
                <th className="px-5 py-2.5 text-right font-medium">Units on Hand</th>
                <th className="px-5 py-2.5 text-right font-medium">Rate</th>
                <th className="px-5 py-2.5 text-right font-medium">Charge</th>
              </tr>
            </thead>
            <tbody>
              {weekRows.map(w => (
                <tr key={w.weekNum} className="border-t border-gray-50 hover:bg-gray-50/50">
                  <td className="px-5 py-2.5 text-gray-400 text-xs">{w.weekNum}</td>
                  <td className="px-5 py-2.5 text-gray-600 whitespace-nowrap">
                    {fmtDateShort(w.startDate)} – {fmtDateShort(w.endDate)}
                  </td>
                  <td className="px-5 py-2.5 text-right font-semibold text-gray-900">{w.unitsOnHand}</td>
                  <td className="px-5 py-2.5 text-right text-gray-400 text-xs">{fmt(w.rate)}</td>
                  <td className="px-5 py-2.5 text-right font-semibold text-gray-900">{fmt(w.charge)}</td>
                </tr>
              ))}
              {weekRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-sm text-gray-400">
                    No data for this period
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 bg-blue-50">
                <td colSpan={4} className="px-5 py-3 text-sm font-medium text-blue-700">
                  Storage subtotal
                </td>
                <td className="px-5 py-3 text-right font-bold text-blue-700">{fmt(storageCharge)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Invoices */}
        <InvoiceSection
          customerId={customerId}
          billingMonth={billingMonthStr}
          invoices={(invoices ?? []).map(inv => ({
            id: inv.id,
            filename: inv.filename,
            storage_path: inv.storage_path,
            file_size_bytes: inv.file_size_bytes,
            notes: inv.notes,
            created_at: inv.created_at,
          }))}
          isStaff={isStaff}
        />
      </div>

      {/* Movement detail tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MovementTable
          title="Inbound Movements"
          movements={inboundMovements}
          rate={inboundRate}
          totalUnits={totalInboundHU}
          totalCharge={inboundCharge}
          accentClass="text-green-700"
        />
        <MovementTable
          title="Outbound Movements"
          movements={outboundMovements}
          rate={outboundRate}
          totalUnits={totalOutboundHU}
          totalCharge={outboundCharge}
          accentClass="text-orange-700"
        />
      </div>

      {/* Month total footer */}
      <div className="mt-6 rounded-xl bg-violet-600 text-white px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest opacity-70">Total charges</p>
          <p className="text-sm opacity-80 mt-0.5">{monthLabel} · {customer?.name}</p>
        </div>
        <p className="text-3xl font-bold">{fmt(totalCharge)}</p>
      </div>

    </div>
  )
}
