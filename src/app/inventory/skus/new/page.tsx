'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft } from 'lucide-react'

const UOM_OPTIONS = ['each', 'case', 'bag', 'drum', 'tote']

export default function NewSKUPage() {
  const router = useRouter()
  const supabase = createClient()
  const [profile, setProfile] = useState<any>(null)
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [skuCode, setSkuCode] = useState('')
  const [description, setDescription] = useState('')
  const [unit, setUnit] = useState('each')
  const [quantity, setQuantity] = useState('')
  const [storageUnit, setStorageUnit] = useState('')
  const [dimensionsCm, setDimensionsCm] = useState('')

  const isStaff = profile?.role === 'warehouse_staff' || profile?.role === 'admin'

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user!.id).single()
      setProfile(prof)
      if (prof?.role === 'warehouse_staff' || prof?.role === 'admin') {
        const { data: custs } = await supabase.from('customers').select('id, name').order('name')
        setCustomers(custs ?? [])
      }
    }
    load()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const customerId = isStaff ? selectedCustomerId : profile?.customer_id
      if (!customerId) throw new Error('Please select a customer')
      const qty = quantity ? parseInt(quantity) : 0
      const { data: sku, error: err } = await supabase.from('skus').insert({
        customer_id: customerId,
        sku_code: skuCode.toUpperCase(),
        description,
        unit,
        quantity: qty || null,
        storage_unit: storageUnit ? parseInt(storageUnit) : null,
        dimensions_cm: dimensionsCm || null,
      }).select('id').single()
      if (err) throw err
      const { error: lvlErr } = await supabase.from('inventory_levels').insert({
        sku_id: sku.id,
        customer_id: customerId,
        quantity_on_hand: qty,
        quantity_reserved: 0,
        quantity_available: qty,
      })
      if (lvlErr) throw lvlErr
      router.push('/inventory')
    } catch (e: any) {
      setError(e.message)
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <Link href="/inventory" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft size={14} /> Back to inventory
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900">Add SKU</h1>
        <p className="text-sm text-gray-500 mt-1">Register a new product for inventory tracking</p>
      </div>

      <form onSubmit={handleSubmit} className="card p-5 space-y-4">
        {isStaff && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Customer <span className="text-red-500">*</span></label>
            <select
              required value={selectedCustomerId} onChange={e => setSelectedCustomerId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select customer…</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">SKU code <span className="text-red-500">*</span></label>
          <input
            type="text" required value={skuCode} onChange={e => setSkuCode(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
            placeholder="ABC-001"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Description <span className="text-red-500">*</span></label>
          <input
            type="text" required value={description} onChange={e => setDescription(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Blue Widget 12oz"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Unit of measure</label>
          <select
            value={unit} onChange={e => setUnit(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {UOM_OPTIONS.map(o => (
              <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Quantity</label>
            <input
              type="number" step="1" min="0" value={quantity} onChange={e => setQuantity(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Storage unit</label>
            <input
              type="number" step="1" min="0" value={storageUnit} onChange={e => setStorageUnit(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Dimensions (cm)</label>
          <input
            type="text" value={dimensionsCm} onChange={e => setDimensionsCm(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="30×20×10"
          />
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>}
        <div className="flex items-center gap-3 pt-2">
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Saving…' : 'Save SKU'}
          </button>
          <Link href="/inventory" className="text-sm text-gray-500 hover:text-gray-700">Cancel</Link>
        </div>
      </form>
    </div>
  )
}
