'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'

interface SKUOption { id: string; sku_code: string; description: string; unit: string }
interface ItemRow { sku_id: string; quantity: number; carton_count: string; units_per_carton: string }

export default function NewInboundOrderPage() {
  const router = useRouter()
  const supabase = createClient()
  const [skus, setSkus] = useState<SKUOption[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [profile, setProfile] = useState<any>(null)

  const [expectedDate, setExpectedDate] = useState('')
  const [palletCount, setPalletCount] = useState('1')
  const [notes, setNotes] = useState('')
  const [carrier, setCarrier] = useState('')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [items, setItems] = useState<ItemRow[]>([{ sku_id: '', quantity: 1, carton_count: '', units_per_carton: '' }])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user!.id).single()
      setProfile(prof)
      const { data: skuData } = await supabase
        .from('skus')
        .select('id, sku_code, description, unit')
        .match(prof?.role === 'warehouse_staff' || prof?.role === 'admin' ? {} : { customer_id: prof?.customer_id })
        .order('sku_code')
      setSkus(skuData ?? [])
    }
    load()
  }, [])

  function addItem() {
    setItems([...items, { sku_id: '', quantity: 1, carton_count: '', units_per_carton: '' }])
  }

  function removeItem(i: number) {
    setItems(items.filter((_, idx) => idx !== i))
  }

  function updateItem(i: number, field: keyof ItemRow, value: string | number) {
    setItems(items.map((item, idx) => idx === i ? { ...item, [field]: value } : item))
  }

  async function handleSubmit(e: React.FormEvent, asDraft = false) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const validItems = items.filter(it => it.sku_id && it.quantity > 0)
      if (validItems.length === 0) { setError('Add at least one item'); setLoading(false); return }

      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .insert({
          customer_id: profile.customer_id,
          order_type: 'inbound',
          order_number: '',
          status: asDraft ? 'draft' : 'submitted',
          expected_date: expectedDate || null,
          pallet_count: parseInt(palletCount) || 1,
          notes: notes || null,
          carrier: carrier || null,
          tracking_number: trackingNumber || null,
          created_by: profile.id,
        })
        .select().single()

      if (orderErr) throw orderErr

      const { error: itemsErr } = await supabase.from('order_items').insert(
        validItems.map(it => ({
          order_id: order.id,
          sku_id: it.sku_id,
          quantity: Number(it.quantity),
          carton_count: it.carton_count ? Number(it.carton_count) : null,
          units_per_carton: it.units_per_carton ? Number(it.units_per_carton) : null,
        }))
      )
      if (itemsErr) throw itemsErr

      router.push(`/orders/inbound/${order.id}`)
    } catch (e: any) {
      setError(e.message)
      setLoading(false)
    }
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
        {/* Shipment details */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Shipment details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Expected arrival</label>
              <input
                type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Pallet count <span className="text-red-500">*</span></label>
              <input
                type="number" min="1" required value={palletCount} onChange={e => setPalletCount(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Carrier</label>
              <input
                type="text" value={carrier} onChange={e => setCarrier(e.target.value)} placeholder="e.g. FedEx Freight"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tracking / PRO number</label>
              <input
                type="text" value={trackingNumber} onChange={e => setTrackingNumber(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <textarea
                value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                placeholder="Special handling instructions, reference numbers..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>
        </div>

        {/* Line items */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">Items</h2>
            <button type="button" onClick={addItem} className="btn-secondary flex items-center gap-1.5 text-xs py-1.5">
              <Plus size={13} /> Add item
            </button>
          </div>

          {skus.length === 0 && (
            <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded mb-3">
              No SKUs found. <Link href="/inventory/skus/new" className="underline">Add SKUs</Link> before creating orders.
            </p>
          )}

          <div className="space-y-3">
            {items.map((item, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-5">
                  {i === 0 && <label className="block text-xs font-medium text-gray-500 mb-1">SKU <span className="text-red-500">*</span></label>}
                  <select
                    value={item.sku_id} onChange={e => updateItem(i, 'sku_id', e.target.value)} required
                    className="w-full px-2 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select SKU…</option>
                    {skus.map(s => (
                      <option key={s.id} value={s.id}>{s.sku_code} — {s.description}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  {i === 0 && <label className="block text-xs font-medium text-gray-500 mb-1">Qty <span className="text-red-500">*</span></label>}
                  <input
                    type="number" min="1" required value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)}
                    className="w-full px-2 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="col-span-2">
                  {i === 0 && <label className="block text-xs font-medium text-gray-500 mb-1">Cartons</label>}
                  <input
                    type="number" min="0" value={item.carton_count} onChange={e => updateItem(i, 'carton_count', e.target.value)}
                    placeholder="—"
                    className="w-full px-2 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="col-span-2">
                  {i === 0 && <label className="block text-xs font-medium text-gray-500 mb-1">Units/ctn</label>}
                  <input
                    type="number" min="0" value={item.units_per_carton} onChange={e => updateItem(i, 'units_per_carton', e.target.value)}
                    placeholder="—"
                    className="w-full px-2 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
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
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Submitting…' : 'Submit order'}
          </button>
          <button
            type="button" disabled={loading}
            onClick={(e) => handleSubmit(e as any, true)}
            className="btn-secondary"
          >
            Save as draft
          </button>
          <Link href="/orders/inbound" className="text-sm text-gray-500 hover:text-gray-700">Cancel</Link>
        </div>
      </form>
    </div>
  )
}
