'use client'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'

interface SKUOption { id: string; sku_code: string; description: string; unit: string }
interface ItemRow { id?: string; sku_id: string; quantity: number; storage_unit: string; lot_number: string }

export default function EditInboundOrderPage() {
  const router = useRouter()
  const params = useParams()
  const orderId = params.id as string
  const supabase = createClient()

  const [profile, setProfile] = useState<any>(null)
  const [order, setOrder] = useState<any>(null)
  const [skus, setSkus] = useState<SKUOption[]>([])
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [error, setError] = useState('')

  // Order-level fields
  const [expectedDate, setExpectedDate] = useState('')
  const [palletCount, setPalletCount] = useState('1')
  const [carrier, setCarrier] = useState('')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [referenceType, setReferenceType] = useState('')
  const [referenceNumber, setReferenceNumber] = useState('')

  // Line items
  const [items, setItems] = useState<ItemRow[]>([{ sku_id: '', quantity: 1, storage_unit: '', lot_number: '' }])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(prof)

      const { data: ord } = await supabase
        .from('orders')
        .select('*, order_items(id, sku_id, quantity, storage_unit, lot_number)')
        .eq('id', orderId)
        .single()

      if (!ord) { router.push('/orders/inbound'); return }
      // Only allow editing submitted / draft / pending statuses
      if (!['draft', 'submitted', 'pending'].includes(ord.status)) {
        router.push(`/orders/inbound/${orderId}`)
        return
      }
      setOrder(ord)

      // Pre-fill
      setExpectedDate(ord.expected_date ?? '')
      setPalletCount(String(ord.pallet_count ?? 1))
      setCarrier(ord.carrier ?? '')
      setTrackingNumber(ord.tracking_number ?? '')
      setNotes(ord.notes ?? '')
      setReferenceType(ord.reference_type ?? '')
      setReferenceNumber(ord.reference_number ?? '')
      setItems(ord.order_items?.length > 0
        ? ord.order_items.map((i: any) => ({
            id: i.id,
            sku_id: i.sku_id,
            quantity: i.quantity,
            storage_unit: i.storage_unit ?? '',
            lot_number: i.lot_number ?? '',
          }))
        : [{ sku_id: '', quantity: 1, storage_unit: '', lot_number: '' }]
      )

      // Load SKUs for this customer
      const customerId = ord.customer_id
      const { data: skuRows } = await supabase
        .from('skus')
        .select('id, sku_code, description, unit')
        .eq('customer_id', customerId)
        .order('sku_code')
      setSkus(skuRows ?? [])

      setInitialLoading(false)
    }
    load()
  }, [orderId])

  function addItem() { setItems([...items, { sku_id: '', quantity: 1, storage_unit: '', lot_number: '' }]) }
  function removeItem(i: number) { setItems(items.filter((_, idx) => idx !== i)) }
  function updateItem(i: number, field: keyof ItemRow, value: string | number) {
    setItems(items.map((item, idx) => idx === i ? { ...item, [field]: value } : item))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const validItems = items.filter(it => it.sku_id && it.quantity > 0)
      if (validItems.length === 0) throw new Error('Add at least one item')

      // Update order
      const { error: updErr } = await supabase.from('orders').update({
        expected_date: expectedDate || null,
        pallet_count: parseInt(palletCount) || 1,
        carrier: carrier || null,
        tracking_number: trackingNumber || null,
        notes: notes || null,
        reference_type: referenceType || null,
        reference_number: referenceNumber || null,
      }).eq('id', orderId)
      if (updErr) throw updErr

      // Replace line items
      const { error: delErr } = await supabase.from('order_items').delete().eq('order_id', orderId)
      if (delErr) throw delErr

      const { error: insErr } = await supabase.from('order_items').insert(
        validItems.map(it => ({
          order_id: orderId,
          sku_id: it.sku_id,
          quantity: Number(it.quantity),
          storage_unit: it.storage_unit || null,
          lot_number: it.lot_number || null,
        }))
      )
      if (insErr) throw insErr

      // Notify
      fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'order_updated', order_id: orderId }),
      })

      router.push(`/orders/inbound/${orderId}`)
    } catch (e: any) {
      setError(e.message)
      setLoading(false)
    }
  }

  if (initialLoading) return <div className="p-8 text-sm text-gray-400">Loading…</div>

  const REF_TYPES = [
    { value: '', label: 'None' },
    { value: 'PO Number', label: 'PO Number' },
    { value: 'BL Number', label: 'BL Number' },
    { value: 'Other', label: 'Other' },
  ]

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <Link href={`/orders/inbound/${orderId}`} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft size={14} /> Back to order
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900">Edit order {order?.order_number}</h1>
        <p className="text-sm text-gray-500 mt-1">Update order details and items</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Shipment details */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Shipment details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Expected arrival date</label>
              <input type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Pallet count</label>
              <input type="number" min="1" value={palletCount} onChange={e => setPalletCount(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Carrier</label>
              <input type="text" value={carrier} onChange={e => setCarrier(e.target.value)}
                placeholder="e.g. FedEx, DHL"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tracking number</label>
              <input type="text" value={trackingNumber} onChange={e => setTrackingNumber(e.target.value)}
                placeholder="e.g. 1Z999AA10123456784"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Reference type</label>
              <select value={referenceType} onChange={e => { setReferenceType(e.target.value); setReferenceNumber('') }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {REF_TYPES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Reference number</label>
              <input type="text" value={referenceNumber} onChange={e => setReferenceNumber(e.target.value)}
                disabled={!referenceType}
                placeholder={referenceType ? `Enter ${referenceType}…` : 'Select type first'}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">Items</h2>
            <button type="button" onClick={addItem} className="btn-secondary flex items-center gap-1.5 text-xs py-1.5">
              <Plus size={13} /> Add item
            </button>
          </div>
          <div className="space-y-3">
            {items.map((item, i) => {
              const sku = skus.find(s => s.id === item.sku_id)
              return (
                <div key={i} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5">
                    {i === 0 && <label className="block text-xs font-medium text-gray-500 mb-1">SKU <span className="text-red-500">*</span></label>}
                    <select value={item.sku_id} onChange={e => updateItem(i, 'sku_id', e.target.value)} required
                      className="w-full px-2 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">Select SKU…</option>
                      {skus.map(s => <option key={s.id} value={s.id}>{s.sku_code} — {s.description}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    {i === 0 && <label className="block text-xs font-medium text-gray-500 mb-1">Qty {sku ? <span className="text-gray-400">({sku.unit})</span> : ''}</label>}
                    <input type="number" min="1" required value={item.quantity}
                      onChange={e => updateItem(i, 'quantity', e.target.value)}
                      className="w-full px-2 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="col-span-2">
                    {i === 0 && <label className="block text-xs font-medium text-gray-500 mb-1">Storage unit</label>}
                    <input type="text" value={item.storage_unit} onChange={e => updateItem(i, 'storage_unit', e.target.value)}
                      placeholder="e.g. Pallet"
                      className="w-full px-2 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="col-span-2">
                    {i === 0 && <label className="block text-xs font-medium text-gray-500 mb-1">Lot #</label>}
                    <input type="text" value={item.lot_number} onChange={e => updateItem(i, 'lot_number', e.target.value)}
                      placeholder="LOT-001"
                      className="w-full px-2 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="col-span-1 flex justify-end">
                    {items.length > 1 && (
                      <button type="button" onClick={() => removeItem(i)} className="text-gray-400 hover:text-red-500 p-2">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-md">{error}</p>}

        <div className="flex items-center gap-3">
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Saving…' : 'Save changes'}
          </button>
          <Link href={`/orders/inbound/${orderId}`} className="text-sm text-gray-500 hover:text-gray-700">Cancel</Link>
        </div>
      </form>
    </div>
  )
}
