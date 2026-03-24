'use client'

import { useEffect, useState } from 'react'

interface Settings {
  warehouse_name?: string
  address_line1?: string
  address_line2?: string
  city?: string
  state?: string
  postal_code?: string
  country?: string
  phone?: string
  email?: string
}

export default function WarehouseSettings() {
  const [form, setForm] = useState<Settings>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/settings/warehouse')
      .then(r => r.json())
      .then(d => { setForm(d ?? {}); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  function set(field: keyof Settings, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
    setSaved(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/settings/warehouse', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Save failed')
      setForm(data)
      setSaved(true)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="card p-5 text-sm text-gray-400">Loading…</div>

  return (
    <div className="card p-5">
      <h2 className="text-sm font-semibold text-gray-700 mb-4">Warehouse address</h2>
      <form onSubmit={handleSave} className="space-y-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Warehouse name</label>
          <input
            className="input w-full"
            value={form.warehouse_name ?? ''}
            onChange={e => set('warehouse_name', e.target.value)}
            placeholder="e.g. Main Warehouse"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Address line 1</label>
          <input
            className="input w-full"
            value={form.address_line1 ?? ''}
            onChange={e => set('address_line1', e.target.value)}
            placeholder="Street address"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Address line 2</label>
          <input
            className="input w-full"
            value={form.address_line2 ?? ''}
            onChange={e => set('address_line2', e.target.value)}
            placeholder="Suite, unit, etc. (optional)"
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-1">
            <label className="block text-xs text-gray-500 mb-1">City</label>
            <input
              className="input w-full"
              value={form.city ?? ''}
              onChange={e => set('city', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">State</label>
            <input
              className="input w-full"
              value={form.state ?? ''}
              onChange={e => set('state', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Postal code</label>
            <input
              className="input w-full"
              value={form.postal_code ?? ''}
              onChange={e => set('postal_code', e.target.value)}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Country</label>
            <input
              className="input w-full"
              value={form.country ?? 'US'}
              onChange={e => set('country', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Phone</label>
            <input
              className="input w-full"
              value={form.phone ?? ''}
              onChange={e => set('phone', e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Contact email</label>
          <input
            type="email"
            className="input w-full"
            value={form.email ?? ''}
            onChange={e => set('email', e.target.value)}
            placeholder="warehouse@yourdomain.com"
          />
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex items-center gap-3 pt-1">
          <button type="submit" disabled={saving} className="btn-primary text-sm">
            {saving ? 'Saving…' : 'Save'}
          </button>
          {saved && <span className="text-xs text-green-600">Saved</span>}
        </div>
      </form>
    </div>
  )
}
