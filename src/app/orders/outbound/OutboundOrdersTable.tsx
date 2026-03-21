'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import { ArrowUpCircle, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'

type SortKey = 'order_number' | 'customer' | 'consignee' | 'ship_by' | 'pallets' | 'status' | 'created_at'
type SortDir = 'asc' | 'desc'

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown size={12} className="text-gray-300 ml-1 inline" />
  return sortDir === 'asc'
    ? <ChevronUp size={12} className="text-blue-500 ml-1 inline" />
    : <ChevronDown size={12} className="text-blue-500 ml-1 inline" />
}

interface Props {
  orders: any[]
  isStaff: boolean
}

export default function OutboundOrdersTable({ orders, isStaff }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const sorted = useMemo(() => {
    return [...orders].sort((a, b) => {
      let av: any, bv: any
      switch (sortKey) {
        case 'order_number': av = a.order_number; bv = b.order_number; break
        case 'customer':     av = a.customers?.name ?? ''; bv = b.customers?.name ?? ''; break
        case 'consignee':    av = a.consignees?.company_name ?? ''; bv = b.consignees?.company_name ?? ''; break
        case 'ship_by':      av = a.ship_by_date ?? ''; bv = b.ship_by_date ?? ''; break
        case 'pallets':      av = a.pallet_count ?? 0; bv = b.pallet_count ?? 0; break
        case 'status':       av = a.status; bv = b.status; break
        case 'created_at':   av = a.created_at; bv = b.created_at; break
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [orders, sortKey, sortDir])

  function Th({ col, label }: { col: SortKey; label: string }) {
    return (
      <th
        className="px-5 py-3 text-left text-xs font-medium text-gray-500 cursor-pointer select-none hover:text-gray-800"
        onClick={() => handleSort(col)}
      >
        {label}<SortIcon col={col} sortKey={sortKey} sortDir={sortDir} />
      </th>
    )
  }

  const colSpan = isStaff ? 7 : 6

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-100">
            <Th col="order_number" label="Order #" />
            {isStaff && <Th col="customer" label="Customer" />}
            <Th col="consignee" label="Consignee" />
            <Th col="ship_by" label="Ship by" />
            <Th col="pallets" label="Pallets" />
            <Th col="status" label="Status" />
            <Th col="created_at" label="Created" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {sorted.length === 0 && (
            <tr><td colSpan={colSpan} className="px-5 py-8 text-center text-gray-400 text-xs">No outbound orders yet</td></tr>
          )}
          {sorted.map((order: any) => (
            <tr key={order.id} className="hover:bg-gray-50 cursor-pointer">
              <td className="px-5 py-3">
                <Link href={`/orders/outbound/${order.id}`} className="font-medium text-blue-700 hover:underline flex items-center gap-1.5">
                  <ArrowUpCircle size={13} className="text-orange-400" />
                  {order.order_number}
                </Link>
              </td>
              {isStaff && <td className="px-5 py-3 text-gray-600">{order.customers?.name}</td>}
              <td className="px-5 py-3 text-gray-600">{order.consignees?.company_name ?? '—'}</td>
              <td className="px-5 py-3 text-gray-600">
                {order.ship_by_date
                  ? new Date(order.ship_by_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  : '—'}
              </td>
              <td className="px-5 py-3 text-gray-600">{order.pallet_count}</td>
              <td className="px-5 py-3">
                <span className={`status-${order.status} px-2 py-0.5 rounded text-xs font-medium`}>
                  {order.status.replace('_', ' ')}
                </span>
              </td>
              <td className="px-5 py-3 text-gray-400 text-xs">
                {new Date(order.created_at).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
