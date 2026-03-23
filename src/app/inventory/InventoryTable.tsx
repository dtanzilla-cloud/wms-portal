'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Trash2, AlertCircle, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'

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
  const supabase = createClient()
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('sku_code')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

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

  const allChecked = rows.length > 0 && selected.size === rows.length
  const someChecked = selected.size > 0 && selected.size < rows.length

  function toggleAll() {
    setSelected(allChecked ? new Set() : new Set(rows.map(r => r.sku_id)))
  }

  function toggleOne(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function deleteSkus(ids: string[]) {
    setDeleting(true)
    setError('')
    try {
      const { error: mvErr } = await supabase.from('inventory_movements').delete().in('sku_id', ids)
      if (mvErr) throw mvErr
      const { error: skuErr } = await supabase.from('skus').delete().in('id', ids)
      if (skuErr) throw skuErr
      setSelected(new Set())
      router.refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setDeleting(false)
    }
  }

  async function handleDeleteSelected() {
    if (!confirm(`Delete ${selected.size} SKU${selected.size !== 1 ? 's' : ''} and all their inventory history? This cannot be undone.`)) return
    await deleteSkus(Array.from(selected))
  }

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
    <div>
      {selected.size > 0 && (
        <div className="px-5 py-2.5 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
          <span className="text-sm text-blue-700 font-medium">{selected.size} selected</span>
          <button
            onClick={handleDeleteSelected}
            disabled={deleting}
            className="flex items-center gap-1.5 text-sm text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
          >
            <Trash2 size={13} /> {deleting ? 'Deleting…' : 'Delete selected'}
          </button>
        </div>
      )}

      {error && (
        <div className="px-5 py-2 bg-red-50 border-b border-red-100 flex items-center gap-2 text-xs text-red-600">
          <AlertCircle size={12} /> {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="px-4 py-3 w-8">
                <input
                  type="checkbox"
                  checked={allChecked}
                  ref={el => { if (el) el.indeterminate = someChecked }}
                  onChange={toggleAll}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </th>
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
                <td colSpan={9} className="px-5 py-8 text-center text-gray-400 text-xs">No inventory yet</td>
              </tr>
            )}
            {sorted.map(row => (
              <tr key={row.sku_id} className={`hover:bg-gray-50 ${selected.has(row.sku_id) ? 'bg-blue-50' : ''}`}>
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.has(row.sku_id)}
                    onChange={() => toggleOne(row.sku_id)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </td>
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
    </div>
  )
}
