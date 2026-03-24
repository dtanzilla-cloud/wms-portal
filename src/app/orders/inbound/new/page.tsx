'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'

interface SKUOption { id: string; sku_code: string; description: string; unit: string }
interface ItemRow { sku_id: string; quantity: number; storage_unit: string; lot_number: string }

export default function NewInboundOrderPage() {
  const router = useRouter()
  const supabase = createClient()
  const [skus, setSkus] = useState<SKUOption[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [profile, setProfile] = useState<any>(null)

  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [expectedDate, setExpectedDate] = useState('')
  const [palletCount, setPalletCount] = useState('1')
  const [notes, setNotes] = useState('')
  const [carrier, setCarrier] = useState('')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [items, setItems] = useState<ItemRow[]>([{ sku_id: '', quantity: 1, storage_unit: '', lot_number: '' }])

  const isStaff = profile?.role === 'warehouse_staff' || profile?.role === 'admin'
  const effectiveCustomerId = isStaff ? selectedCustomerId : profile?.customer_id

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user!.id).single()
      setProfile(prof)
      if (prof?.role === 'warehouse_staff' || prof?.role === 'admin') {
        const { data: custs } = await supabase.from('customers').select('id, name').eq('status', 'active').order('name')
        setCustomers(custs ?? [])
      }
    }
    load()
  }, [])

  useEffect(() => {
    if (!effectiveCustomerId) { setSkus([]); return }
    supabase.from('skus').select('id, sku_code, description, unit')
      .eq('customer_id', effectiveCustomerId).order('sku_code')
      .then(({ data }) => setSkus(data ?? []))
  }, [effectiveCustomerId])

  function addItem() { setItems([...items, { sku_id: '', quantity: 1, storage_unit: '', lot_number: '' }]) }
  function removeItem(i: number) { setItems(items.filter((_, idx) => idx !== i)) }
  function updateItem(i: number, field: keyof ItemRow, value: string | number) {
    setItems(items.map((item, idx) => idx === i ? { ...item, [field]: value } : item))
  }

  async function handleSubmit(e: React.FormEvent, asDraft = false) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      if (isStaff && !selectedCustomerId) { setError('Please select a customer'); setLoading(false); return }
      const validItems = items.filter(it => it.sku_id && it.quantity > 0)
      if (validItems.length === 0) { setError('Add at least one item'); setLoading(false); return }

      const { data: order, error: orderErr } = await supabase.from('orders').insert({
        customer_id: effectiveCustomerId,
        order_type: 'inbound', order_number: '',
        status: asDraft ? 'draft' : 'submitted',
        expected_date: expectedDate || null,
        pallet_count: parseInt(palletCount) || 1,
        notes: notes || null,
        carrier: carrier || null,
        tracking_number: trackingNumber || null,
        created_by: profile.id,
      }).select().single()
      if (orderErr) throw orderErr

      const { error: itemsErr } = await supabase.from('order_items').insert(
        validItems.map(it => ({
          order_id: order.id, sku_id: it.sku_id, quantity: Number(it.quantity),
          storage_unit: it.storage_unit || null,
          lot_number: it.lot_number || null,
        }))
      )
      if (itemsErr) throw itemsErr

      if (!asDraft) {
        fetch('/api/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'inbound_submitted', order_id: order.id }) })
      }

      router.push(`/orders/inbound/${order.id}`)
    } catch (e: any) { setError(e.message); setLoading(false) }
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <Link href="/orders/inbound" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft size={14} /> Back to inbound orders
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900">New inbound order</h1>
        <p className="text-sm text-gray-500 mt-1">Notify the warehouse of an incoming shipment</p>
      </div>

      <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-6">
        {isStaff && (
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Customer</h2>
            <select required value={selectedCustomerId} onChange={e => setSelectedCustomerId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Select customer…</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}

        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Shipment details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Expected arrival</label>
              <input type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Pallet count <span className="text-red-500">*</span></label>
              <input type="number" min="1" required value={palletCount} onChange={e => setPalletCount(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Carrier</label>
              <input type="text" value={carrier} onChange={e => setCarrier(e.target.value)} placeholder="e.g. FedEx Freight"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tracking / PRO number</label>
              <input type="text" value={trackingNumber} onChange={e => setTrackingNumber(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                placeholder="Special handling instructions, reference numbers..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">Items</h2>
            <button type="button" onClick={addItem} className="btn-secondary flex items-center gap-1.5 text-xs py-1.5">
              <Plus size={13} /> Add item
            </button>
          </div>
          {isStaff && !selectedCustomerId && (
            <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded mb-3">Select a customer above to load their SKUs</p>
          )}
          {effectiveCustomerId && skus.length === 0 && (
            <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded mb-3">
              No SKUs found. <Link href="/inventory/skus/new" className="underline">Add SKUs</Link> first.
            </p>
          )}
          <div className="space-y-3">
            {items.map((item, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-end">
                {/* SKU */}
                <div className="col-span-4">
                  {i === 0 && <label className="block text-xs font-medium text-gray-500 mb-1">SKU <span className="text-red-500">*</span></label>}
                  <select value={item.sku_id} onChange={e => updateItem(i, 'sku_id', e.target.value)} required
                    className="w-full px-2 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Select SKU…</option>
                    {skus.map(s => <option key={s.id} value={s.id}>{s.sku_code} — {s.description}</option>)}
                  </select>
                </div>
                {/* Qty */}
                <div className="col-span-2">
                  {i === 0 && <label className="block text-xs font-medium text-gray-500 mb-1">Qty <span className="text-red-500">*</span></label>}
                  <input type="number" min="1" required value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)}
                    className="w-full px-2 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                {/* UOM — read-only, derived from selected SKU */}
                <div className="col-span-1">
                  {i === 0 && <label className="block text-xs font-medium text-gray-500 mb-1">UOM</label>}
                  <div className="w-full px-2 py-2 border border-gray-200 rounded-md text-sm bg-gray-50 text-gray-500 truncate">
                    {skus.find(s => s.id === item.sku_id)?.unit || '—'}
                  </div>
                </div>
                {/* Storage unit */}
                <div className="col-span-2">
                  {i === 0 && <label className="block text-xs font-medium text-gray-500 mb-1">Storage unit</label>}
                  <input type="text" value={item.storage_unit} onChange={e => updateItem(i, 'storage_unit', e.target.value)}
                    placeholder="Pallet / Box…" className="w-full px-2 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                {/* Lot # */}
                <div className="col-span-2">
                  {i === 0 && <label className="block text-xs font-medium text-gray-500 mb-1">Lot #</label>}
                  <input type="text" value={item.lot_number} onChange={e => updateItem(i, 'lot_number', e.target.value)}
                    placeholder="e.g. LOT-001" className="w-full px-2 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                {/* Remove */}
                <div className="col-span-1 flex justify-end">
                  {items.length > 1 && (
                    <button type="button" onClick={() => removeItem(i)} className="text-gray-400 hover:text-red-500 transition-colors p-2">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-md">{error}</p>}
        <div className="flex items-center gap-3">
          <button type="submit" disabled={loading} className="btn-primary">{loading ? 'Submitting…' : 'Submit order'}</button>
          <button type="button" disabled={loading} onClick={(e) => handleSubmit(e as any, true)} className="btn-secondary">Save as draft</button>
          <Link href="/orders/inbound" className="text-sm text-gray-500 hover:text-gray-700">Cancel</Link>
        </div>
      </form>
    </div>
  )
}
