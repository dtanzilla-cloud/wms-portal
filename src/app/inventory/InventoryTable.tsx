'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Pencil, Trash2, AlertCircle } from 'lucide-react'

interface InventoryRow {
  sku_id: string
  customer_id: string
  quantity_on_hand: number
  quantity_reserved: number
  quantity_available: number
  skus?: { sku_code: string; description: string; unit: string }
}

export default function InventoryTable({ rows }: { rows: InventoryRow[] }) {
  const supabase = createClient()
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const allChecked = rows.length > 0 && selected.size === rows.length
  const someChecked = selected.size > 0 && selected.size < rows.length

  function toggleAll() {
    if (allChecked) {
      setSelected(new Set())
    } else {
      setSelected(new Set(rows.map(r => r.sku_id)))
    }
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
      // Delete movements first (no cascade on FK)
      const { error: mvErr } = await supabase
        .from('inventory_movements')
        .delete()
        .in('sku_id', ids)
      if (mvErr) throw mvErr

      const { error: skuErr } = await supabase
        .from('skus')
        .delete()
        .in('id', ids)
      if (skuErr) throw skuErr

      setSelected(new Set())
      router.refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setDeleting(false)
    }
  }

  async function handleDeleteOne(id: string) {
    if (!confirm('Delete this SKU and all its inventory history? This cannot be undone.')) return
    await deleteSkus([id])
  }

  async function handleDeleteSelected() {
    if (!confirm(`Delete ${selected.size} SKU${selected.size !== 1 ? 's' : ''} and all their inventory history? This cannot be undone.`)) return
    await deleteSkus(Array.from(selected))
  }

  return (
    <div>
      {/* Bulk action bar */}
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
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">SKU</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Description</th>
              <th className="px-5 py-3 text-right text-xs font-medium text-gray-500">On hand</th>
              <th className="px-5 py-3 text-right text-xs font-medium text-gray-500">Reserved</th>
              <th className="px-5 py-3 text-right text-xs font-medium text-gray-500">Available</th>
              <th className="px-5 py-3 w-16"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-gray-400 text-xs">No inventory yet</td>
              </tr>
            )}
            {rows.map(row => (
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
                <td className="px-5 py-3 text-right text-gray-700">{row.quantity_on_hand}</td>
                <td className="px-5 py-3 text-right text-amber-600">{row.quantity_reserved}</td>
                <td className={`px-5 py-3 text-right font-medium ${row.quantity_available <= 0 ? 'text-red-600' : 'text-green-700'}`}>
                  {row.quantity_available}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 justify-end">
                    <Link href={`/inventory/skus/${row.sku_id}`} className="text-gray-400 hover:text-blue-600" title="Edit">
                      <Pencil size={13} />
                    </Link>
                    <button
                      onClick={() => handleDeleteOne(row.sku_id)}
                      disabled={deleting}
                      className="text-gray-400 hover:text-red-600 disabled:opacity-40"
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
