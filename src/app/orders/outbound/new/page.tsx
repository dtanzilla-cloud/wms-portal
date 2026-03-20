'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'

interface SKUOption { id: string; sku_code: string; description: string; unit: string; quantity_available: number }
interface ConsigneeOption { id: string; company_name: string; consignee_addresses: any[] }
interface ItemRow { sku_id: string; quantity: number }

export default function NewOutboundOrderPage() {
  const router = useRouter()
  const supabase = createClient()
  const [skus, setSkus] = useState<SKUOption[]>([])
  const [consignees, setConsignees] = useState<ConsigneeOption[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [profile, setProfile] = useState<any>(null)

  const [consigneeId, setConsigneeId] = useState('')
  const [consigneeAddressId, setConsigneeAddressId] = useState('')
  const [shipByDate, setShipByDate] = useState('')
  const [palletCount, setPalletCount] = useState('1')
  const [notes, setNotes] = useState('')
  const [deliveryInstructions, setDeliveryInstructions] = useState('')
  const [items, setItems] = useState<ItemRow[]>([{ sku_id: '', quantity: 1 }])

  const selectedConsignee = consignees.find(c => c.id === consigneeId)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user!.id).single()
      setProfile(prof)

      const [{ data: invData }, { data: consData }] = await Promise.all([
        supabase
          .from('inventory_levels')
          .select('sku_id, quantity_available, skus(sku_code, description, unit)')
          .match(prof?.role === 'warehouse_staff' || prof?.role === 'admin' ? {} : { customer_id: prof?.customer_id })
          .gt('quantity_available', 0),
        supabase
          .from('consignees')
          .select('id, company_name, consignee_addresses(*)')
          .match(prof?.role === 'warehouse_staff' || prof?.role === 'admin' ? {} : { customer_id: prof?.customer_id })
          .order('company_name'),
      ])

      setSkus((invData ?? []).map((row: any) => ({
        id: row.sku_id,
        sku_code: row.skus?.sku_code,
        description: row.skus?.description,
        unit: row.skus?.unit,
        quantity_available: row.quantity_available,
      })))
      setConsignees(consData ?? [])
    }
    load()
  }, [])

  function addItem() { setItems([...items, { sku_id: '', quantity: 1 }]) }
  function removeItem(i: number) { setItems(items.filter((_, idx) => idx !== i)) }
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
      if (!consigneeId) { setError('Select a consignee'); setLoading(false); return }

      // Check available stock
      for (const item of validItems) {
        const sku = skus.find(s => s.id === item.sku_id)
        if (sku && item.quantity > sku.quantity_available) {
          setError(`Insufficient stock for ${sku.sku_code} (available: ${sku.quantity_available})`)
          setLoading(false)
          return
        }
      }

      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .insert({
          customer_id: profile.customer_id,
          order_type: 'outbound',
          order_number: '',
          status: asDraft ? 'draft' : 'submitted',
          consignee_id: consigneeId,
          consignee_address_id: consigneeAddressId || null,
          ship_by_date: shipByDate || null,
          pallet_count: parseInt(palletCount) || 1,
          notes: notes || null,
          delivery_instructions: deliveryInstructions || null,
          created_by: profile.id,
        })
        .select().single()

      if (orderErr) throw orderErr

      const { error: itemsErr } = await supabase.from('order_items').insert(
        validItems.map(it => ({
          order_id: order.id,
          sku_id: it.sku_id,
          quantity: Number(it.quantity),
        }))
      )
      if (itemsErr) throw itemsErr

      router.push(`/orders/outbound/${order.id}`)
    } catch (e: any) {
      setError(e.message)
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <Link href="/orders/outbound" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft size={14} /> Back to outbound orders
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900">New outbound order</h1>
        <p className="text-sm text-gray-500 mt-1">Request a shipment from the warehouse</p>
      </div>

      <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-6">
        {/* Consignee */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Ship to</h2>
          {consignees.length === 0 && (
            <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded mb-3">
              No consignees found. <Link href="/consignees/new" className="underline">Add a consignee</Link> first.
            </p>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Consignee <span className="text-red-500">*</span></label>
              <select
                value={consigneeId} onChange={e => { setConsigneeId(e.target.value); setConsigneeAddressId('') }} required
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select consignee…</option>
                {consignees.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Delivery address</label>
              <select
                value={consigneeAddressId} onChange={e => setConsigneeAddressId(e.target.value)}
                disabled={!consigneeId}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
              >
                <option value="">Default address</option>
                {selectedConsignee?.consignee_addresses?.map((a: any) => (
                  <option key={a.id} value={a.id}>{a.label} — {a.address_line1}, {a.city}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Shipping details */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Shipping details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Ship by date</label>
              <input
                type="date" value={shipByDate} onChange={e => setShipByDate(e.target.value)}
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
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Delivery instructions</label>
              <textarea
                value={deliveryInstructions} onChange={e => setDeliveryInstructions(e.target.value)} rows={2}
                placeholder="Liftgate required, call before delivery..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <textarea
                value={notes} onChange={e => setNotes(e.target.value)} rows={2}
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
              No inventory available. Items will show once inbound orders are put away.
            </p>
          )}

          <div className="space-y-3">
            {items.map((item, i) => {
              const sku = skus.find(s => s.id === item.sku_id)
              return (
                <div key={i} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-8">
                    {i === 0 && <label className="block text-xs font-medium text-gray-500 mb-1">SKU <span className="text-red-500">*</span></label>}
                    <select
                      value={item.sku_id} onChange={e => updateItem(i, 'sku_id', e.target.value)} required
                      className="w-full px-2 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select SKU…</option>
                      {skus.map(s => (
                        <option key={s.id} value={s.id}>{s.sku_code} — {s.description} ({s.quantity_available} avail.)</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-3">
                    {i === 0 && (
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Qty {sku && <span className="text-gray-400">/ {sku.quantity_available}</span>}
                      </label>
                    )}
                    <input
                      type="number" min="1" max={sku?.quantity_available} required value={item.quantity}
                      onChange={e => updateItem(i, 'quantity', e.target.value)}
                      className={`w-full px-2 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        sku && item.quantity > sku.quantity_available ? 'border-red-400 bg-red-50' : 'border-gray-300'
                      }`}
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
              )
            })}
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
          <Link href="/orders/outbound" className="text-sm text-gray-500 hover:text-gray-700">Cancel</Link>
        </div>
      </form>
    </div>
  )
}
