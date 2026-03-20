'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft } from 'lucide-react'

export default function NewSKUPage() {
  const router = useRouter()
  const supabase = createClient()
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [skuCode, setSkuCode] = useState('')
  const [description, setDescription] = useState('')
  const [unit, setUnit] = useState('each')
  const [weightKg, setWeightKg] = useState('')
  const [dimensionsCm, setDimensionsCm] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user!.id).single()
      setProfile(prof)
    }
    load()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { error: err } = await supabase.from('skus').insert({
        customer_id: profile?.customer_id,
        sku_code: skuCode.toUpperCase(),
        description,
        unit,
        weight_kg: weightKg ? parseFloat(weightKg) : null,
        dimensions_cm: dimensionsCm || null,
      })
      if (err) throw err
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
            <option value="each">Each</option>
            <option value="case">Case</option>
            <option value="pallet">Pallet</option>
            <option value="kg">Kg</option>
            <option value="lb">Lb</option>
            <option value="box">Box</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Weight (kg)</label>
            <input
              type="number" step="0.001" value={weightKg} onChange={e => setWeightKg(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0.000"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Dimensions (cm)</label>
            <input
              type="text" value={dimensionsCm} onChange={e => setDimensionsCm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="30×20×10"
            />
          </div>
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
