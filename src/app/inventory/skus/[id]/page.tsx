'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Trash2 } from 'lucide-react'

export default function EditSKUPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [skuCode, setSkuCode] = useState('')
  const [description, setDescription] = useState('')
  const [unit, setUnit] = useState('each')
  const [weightKg, setWeightKg] = useState('')
  const [dimensionsCm, setDimensionsCm] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase.from('skus').select('*').eq('id', params.id).single()
      if (data) {
        setSkuCode(data.sku_code)
        setDescription(data.description)
        setUnit(data.unit)
        setWeightKg(data.weight_kg?.toString() ?? '')
        setDimensionsCm(data.dimensions_cm ?? '')
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
      const { error: err } = await supabase.from('skus').update({
        sku_code: skuCode.toUpperCase(),
        description,
        unit,
        weight_kg: weightKg ? parseFloat(weightKg) : null,
        dimensions_cm: dimensionsCm || null,
      }).eq('id', params.id)
      if (err) throw err
      router.push('/inventory')
    } catch (e: any) {
      setError(e.message)
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this SKU? This cannot be undone.')) return
    setSaving(true)
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
            <input type="number" step="0.001" value={weightKg} onChange={e => setWeightKg(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Dimensions (cm)</label>
            <input type="text" value={dimensionsCm} onChange={e => setDimensionsCm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="30×20×10" />
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
