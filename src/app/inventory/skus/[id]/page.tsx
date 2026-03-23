'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Trash2 } from 'lucide-react'

const UOM_OPTIONS = ['each', 'case', 'bag', 'drum', 'tote']

export default function EditSKUPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [profile, setProfile] = useState<any>(null)
  const [originalQty, setOriginalQty] = useState<number>(0)

  const [skuCode, setSkuCode] = useState('')
  const [description, setDescription] = useState('')
  const [unit, setUnit] = useState('each')
  const [quantity, setQuantity] = useState('')
  const [storageUnit, setStorageUnit] = useState('')
  const [dimensionsCm, setDimensionsCm] = useState('')
  const [lotNumber, setLotNumber] = useState('')
  const [inboundDate, setInboundDate] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user!.id).single()
      setProfile(prof)

      const { data } = await supabase.from('skus').select('*').eq('id', params.id).single()
      if (data) {
        setSkuCode(data.sku_code)
        setDescription(data.description)
        setUnit(data.unit)
        setStorageUnit(data.storage_unit?.toString() ?? '')
        setDimensionsCm(data.dimensions_cm ?? '')
        setLotNumber(data.lot_number ?? '')
        setInboundDate(data.inbound_date ?? '')

        // Get movements-based on-hand as the authoritative quantity
        const { data: level } = await supabase
          .from('inventory_levels')
          .select('quantity_on_hand')
          .eq('sku_id', params.id)
          .maybeSingle()
        const onHand = (level as any)?.quantity_on_hand ?? data.quantity ?? 0
        setQuantity(onHand.toString())
        setOriginalQty(onHand)
      }
      setLoading(false)
    }
    load()
  }, [params.id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const newQty = quantity ? parseInt(quantity) : 0
      const { error: err } = await supabase.from('skus').update({
        sku_code: skuCode.toUpperCase(),
        description,
        unit,
        quantity: newQty || null,
        storage_unit: storageUnit ? parseInt(storageUnit) : null,
        dimensions_cm: dimensionsCm || null,
        lot_number: lotNumber || null,
        inbound_date: inboundDate || null,
      }).eq('id', params.id)
      if (err) throw err

      // If quantity changed, create an adjustment movement to keep On Hand in sync
      const diff = newQty - originalQty
      if (diff !== 0 && profile) {
        const { data: sku } = await supabase.from('skus').select('customer_id').eq('id', params.id).single()
        const { error: mvErr } = await supabase.from('inventory_movements').insert({
          sku_id: params.id,
          customer_id: (sku as any).customer_id,
          movement_type: 'adjustment',
          quantity: diff,
          created_by: profile.id,
        })
        if (mvErr) throw mvErr
      }

      router.refresh()
      router.push('/inventory')
    } catch (e: any) {
      setError(e.message)
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this SKU and all its inventory history? This cannot be undone.')) return
    setSaving(true)
    await supabase.from('inventory_movements').delete().eq('sku_id', params.id)
    await supabase.from('skus').delete().eq('id', params.id)
    router.push('/inventory')
  }

  if (loading) return <div className="p-8 text-sm text-gray-400">Loading…</div>

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <Link href="/inventory" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft size={14} /> Back to inventory
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900">Edit SKU</h1>
      </div>

      <form onSubmit={handleSubmit} className="card p-5 space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">SKU code <span className="text-red-500">*</span></label>
          <input type="text" required value={skuCode} onChange={e => setSkuCode(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Description <span className="text-red-500">*</span></label>
          <input type="text" required value={description} onChange={e => setDescription(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Unit of measure</label>
          <select value={unit} onChange={e => setUnit(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {UOM_OPTIONS.map(o => (
              <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">On hand (qty)</label>
            <input type="number" step="1" min="0" value={quantity} onChange={e => setQuantity(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0" />
            <p className="text-xs text-gray-400 mt-1">Changing this creates an adjustment</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Storage unit</label>
            <input type="number" step="1" min="0" value={storageUnit} onChange={e => setStorageUnit(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Dimensions (cm)</label>
          <input type="text" value={dimensionsCm} onChange={e => setDimensionsCm(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="30×20×10" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Lot number</label>
            <input type="text" value={lotNumber} onChange={e => setLotNumber(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="LOT-001" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Inbound date</label>
            <input type="date" value={inboundDate} onChange={e => setInboundDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <Link href="/inventory" className="text-sm text-gray-500 hover:text-gray-700">Cancel</Link>
          </div>
          <button type="button" onClick={handleDelete} disabled={saving}
            className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700">
            <Trash2 size={13} /> Delete SKU
          </button>
        </div>
      </form>
    </div>
  )
}
