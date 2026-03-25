'use client'
import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface InventoryRow {
  sku_id: string
  customer_id: string
  quantity_on_hand: number
  quantity_reserved: number
  quantity_available: number
  skus?: {
    sku_code: string
    description: string
    unit: string
    storage_unit?: number | null
    quantity?: number | null
    lot_number?: string | null
    inbound_date?: string | null
  }
}

type SortKey = 'sku_code' | 'description' | 'on_hand' | 'reserved' | 'available' | 'storage_unit' | 'lot_number' | 'inbound_date'
type SortDir = 'asc' | 'desc'

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown size={12} className="text-gray-300 ml-1 inline" />
  return sortDir === 'asc'
    ? <ChevronUp size={12} className="text-blue-500 ml-1 inline" />
    : <ChevronDown size={12} className="text-blue-500 ml-1 inline" />
}

export default function InventoryTable({ rows }: { rows: InventoryRow[] }) {
  const router = useRouter()
  const [sortKey, setSortKey] = useState<SortKey>('sku_code')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  // Automatically refresh when inventory_levels or skus change in Supabase
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('inventory-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_levels' }, () => {
        router.refresh()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'skus' }, () => {
        router.refresh()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [router])

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      let av: any, bv: any
      switch (sortKey) {
        case 'sku_code':     av = a.skus?.sku_code ?? ''; bv = b.skus?.sku_code ?? ''; break
        case 'description':  av = a.skus?.description ?? ''; bv = b.skus?.description ?? ''; break
        case 'on_hand':      av = a.quantity_on_hand; bv = b.quantity_on_hand; break
        case 'reserved':     av = a.quantity_reserved; bv = b.quantity_reserved; break
        case 'available':    av = a.quantity_available; bv = b.quantity_available; break
        case 'storage_unit': av = a.skus?.storage_unit ?? -1; bv = b.skus?.storage_unit ?? -1; break
        case 'lot_number':   av = a.skus?.lot_number ?? ''; bv = b.skus?.lot_number ?? ''; break
        case 'inbound_date': av = a.skus?.inbound_date ?? ''; bv = b.skus?.inbound_date ?? ''; break
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [rows, sortKey, sortDir])

  function Th({ col, label, right }: { col: SortKey; label: string; right?: boolean }) {
    return (
      <th
        className={`px-5 py-3 text-xs font-medium text-gray-500 cursor-pointer select-none hover:text-gray-800 ${right ? 'text-right' : 'text-left'}`}
        onClick={() => handleSort(col)}
      >
        {label}<SortIcon col={col} sortKey={sortKey} sortDir={sortDir} />
      </th>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-100">
            <Th col="sku_code" label="SKU" />
            <Th col="description" label="Description" />
            <Th col="lot_number" label="Lot #" />
            <Th col="inbound_date" label="Inbound date" />
            <Th col="on_hand" label="On hand" right />
            <Th col="reserved" label="Reserved" right />
            <Th col="available" label="Available" right />
            <Th col="storage_unit" label="Storage unit" right />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {sorted.length === 0 && (
            <tr>
              <td colSpan={8} className="px-5 py-8 text-center text-gray-400 text-xs">No inventory yet</td>
            </tr>
          )}
          {sorted.map(row => (
            <tr key={row.sku_id} className="hover:bg-gray-50">
              <td className="px-5 py-3 font-mono text-xs">
                <Link href={`/inventory/skus/${row.sku_id}`} className="text-blue-700 hover:underline">
                  {row.skus?.sku_code}
                </Link>
              </td>
              <td className="px-5 py-3 text-gray-700">{row.skus?.description}</td>
              <td className="px-5 py-3 text-gray-500 font-mono text-xs">{row.skus?.lot_number ?? '—'}</td>
              <td className="px-5 py-3 text-gray-500 text-xs">
                {row.skus?.inbound_date
                  ? new Date(row.skus.inbound_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  : '—'}
              </td>
              <td className="px-5 py-3 text-right text-gray-700">{row.quantity_on_hand}</td>
              <td className="px-5 py-3 text-right text-amber-600">{row.quantity_reserved}</td>
              <td className={`px-5 py-3 text-right font-medium ${row.quantity_available <= 0 ? 'text-red-600' : 'text-green-700'}`}>
                {row.quantity_available}
              </td>
              <td className="px-5 py-3 text-right text-gray-500">
                {row.skus?.storage_unit ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
