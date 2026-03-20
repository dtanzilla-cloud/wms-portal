'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ChevronRight, X } from 'lucide-react'

interface Props {
  order: any
  type: 'inbound' | 'outbound'
}

const inboundFlow = ['draft', 'submitted', 'received', 'put_away']
const outboundFlow = ['draft', 'submitted', 'picked', 'packed', 'shipped']

const nextLabel: Record<string, string> = {
  draft: 'Mark submitted',
  submitted: 'Mark received',
  received: 'Mark put away',
  put_away: '',
  picked: 'Mark packed',
  packed: 'Mark shipped',
  shipped: '',
}

const nextStatus: Record<string, string> = {
  draft: 'submitted',
  submitted: 'received',
  received: 'put_away',
  picked: 'packed',
  packed: 'shipped',
}

export default function OrderStatusActions({ order, type }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [showInternal, setShowInternal] = useState(false)
  const [internalNote, setInternalNote] = useState(order.internal_notes ?? '')
  const [carrier, setCarrier] = useState(order.carrier ?? '')
  const [tracking, setTracking] = useState(order.tracking_number ?? '')

  const next = nextStatus[order.status]
  const nextLbl = nextLabel[order.status]
  const canCancel = !['shipped', 'put_away', 'cancelled'].includes(order.status)

  async function advance() {
    if (!next) return
    setLoading(true)
    const updates: any = { status: next }
    if (next === 'shipped') {
      if (carrier) updates.carrier = carrier
      if (tracking) updates.tracking_number = tracking
    }
    await supabase.from('orders').update(updates).eq('id', order.id)

    // If put_away for inbound, add inventory movement
    if (next === 'put_away' && type === 'inbound') {
      const { data: items } = await supabase.from('order_items').select('*').eq('order_id', order.id)
      if (items) {
        await supabase.from('inventory_movements').insert(
          items.map((item: any) => ({
            sku_id: item.sku_id,
            customer_id: order.customer_id,
            order_id: order.id,
            movement_type: 'inbound',
            quantity: item.quantity,
          }))
        )
      }
    }

    // If shipped for outbound, add inventory deduction
    if (next === 'shipped' && type === 'outbound') {
      const { data: items } = await supabase.from('order_items').select('*').eq('order_id', order.id)
      if (items) {
        await supabase.from('inventory_movements').insert(
          items.map((item: any) => ({
            sku_id: item.sku_id,
            customer_id: order.customer_id,
            order_id: order.id,
            movement_type: 'outbound',
            quantity: item.quantity,
          }))
        )
      }
    }

    router.refresh()
    setLoading(false)
  }

  async function cancel() {
    if (!confirm('Cancel this order?')) return
    setLoading(true)
    await supabase.from('orders').update({ status: 'cancelled' }).eq('id', order.id)
    router.refresh()
    setLoading(false)
  }

  async function saveInternal() {
    setLoading(true)
    await supabase.from('orders').update({ internal_notes: internalNote }).eq('id', order.id)
    setShowInternal(false)
    router.refresh()
    setLoading(false)
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setShowInternal(!showInternal)}
        className="btn-secondary text-xs py-1.5"
      >
        {showInternal ? 'Close notes' : 'Internal notes'}
      </button>

      {canCancel && (
        <button onClick={cancel} disabled={loading} className="text-sm text-red-500 hover:text-red-700 border border-red-200 px-3 py-1.5 rounded-md hover:bg-red-50 transition-colors">
          <X size={13} className="inline mr-1" />Cancel
        </button>
      )}

      {nextLbl && (
        <>
          {next === 'shipped' ? (
            <div className="flex items-center gap-2">
              <input
                type="text" placeholder="Carrier" value={carrier} onChange={e => setCarrier(e.target.value)}
                className="px-2 py-1.5 border border-gray-300 rounded-md text-xs w-28 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <input
                type="text" placeholder="Tracking #" value={tracking} onChange={e => setTracking(e.target.value)}
                className="px-2 py-1.5 border border-gray-300 rounded-md text-xs w-32 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button onClick={advance} disabled={loading} className="btn-primary text-xs py-1.5 flex items-center gap-1">
                {loading ? 'Saving…' : nextLbl} <ChevronRight size={13} />
              </button>
            </div>
          ) : (
            <button onClick={advance} disabled={loading} className="btn-primary text-xs py-1.5 flex items-center gap-1">
              {loading ? 'Saving…' : nextLbl} <ChevronRight size={13} />
            </button>
          )}
        </>
      )}

      {showInternal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowInternal(false)}>
          <div className="bg-white rounded-lg shadow-xl p-6 w-96" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Internal notes</h3>
            <p className="text-xs text-gray-500 mb-3">Only visible to warehouse staff</p>
            <textarea
              value={internalNote} onChange={e => setInternalNote(e.target.value)} rows={5}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Staff notes, location details, issues..."
            />
            <div className="flex gap-2 mt-3">
              <button onClick={saveInternal} disabled={loading} className="btn-primary text-sm">
                {loading ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => setShowInternal(false)} className="btn-secondary text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
