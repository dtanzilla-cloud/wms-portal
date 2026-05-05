'use client'
import { useState } from 'react'
import { Edit2, Save, X, DollarSign } from 'lucide-react'

interface Rates {
  storage_rate_per_unit_per_week: number
  inbound_rate_per_unit: number
  outbound_rate_per_unit: number
}

interface Props {
  customerId: string
  rates: Rates
}

function RateInput({
  label,
  sublabel,
  value,
  onChange,
}: {
  label: string
  sublabel: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
        <input
          type="number"
          min="0"
          step="0.01"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <p className="text-xs text-gray-400 mt-1">{sublabel}</p>
    </div>
  )
}

export default function RateEditor({ customerId, rates }: Props) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [vals, setVals] = useState({
    storage: String(rates.storage_rate_per_unit_per_week),
    inbound: String(rates.inbound_rate_per_unit),
    outbound: String(rates.outbound_rate_per_unit),
  })

  function set(field: keyof typeof vals) {
    return (v: string) => setVals(prev => ({ ...prev, [field]: v }))
  }

  function cancel() {
    setVals({
      storage: String(rates.storage_rate_per_unit_per_week),
      inbound: String(rates.inbound_rate_per_unit),
      outbound: String(rates.outbound_rate_per_unit),
    })
    setError('')
    setEditing(false)
  }

  async function save() {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/charges/rates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: customerId,
          storage_rate_per_unit_per_week: parseFloat(vals.storage) || 0,
          inbound_rate_per_unit: parseFloat(vals.inbound) || 0,
          outbound_rate_per_unit: parseFloat(vals.outbound) || 0,
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error || 'Failed to save rates')
        return
      }
      setEditing(false)
      window.location.reload()
    } finally {
      setSaving(false)
    }
  }

  const fmt = (n: number) =>
    n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })

  return (
    <div className="card p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <DollarSign size={15} className="text-gray-400" />
          <h2 className="text-sm font-medium text-gray-700">Billing Rates</h2>
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 px-2.5 py-1.5 rounded-md hover:bg-blue-50 transition-colors"
          >
            <Edit2 size={12} />
            Edit rates
          </button>
        )}
      </div>

      {editing ? (
        <div>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <RateInput
              label="Storage rate"
              sublabel="per storage unit / week"
              value={vals.storage}
              onChange={set('storage')}
            />
            <RateInput
              label="Inbound rate"
              sublabel="per handling unit received"
              value={vals.inbound}
              onChange={set('inbound')}
            />
            <RateInput
              label="Outbound rate"
              sublabel="per handling unit shipped"
              value={vals.outbound}
              onChange={set('outbound')}
            />
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded mb-3">{error}</p>}
          <div className="flex items-center gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-1.5 btn-primary text-xs px-3 py-1.5"
            >
              <Save size={12} />
              {saving ? 'Saving…' : 'Save rates'}
            </button>
            <button
              onClick={cancel}
              disabled={saving}
              className="flex items-center gap-1.5 text-xs text-gray-600 px-3 py-1.5 rounded-md hover:bg-gray-100 transition-colors"
            >
              <X size={12} />
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-6">
          <div>
            <p className="text-xs text-gray-500">Storage</p>
            <p className="text-sm font-semibold text-gray-900 mt-0.5">{fmt(rates.storage_rate_per_unit_per_week)}</p>
            <p className="text-xs text-gray-400">per storage unit / week</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Inbound</p>
            <p className="text-sm font-semibold text-gray-900 mt-0.5">{fmt(rates.inbound_rate_per_unit)}</p>
            <p className="text-xs text-gray-400">per handling unit received</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Outbound</p>
            <p className="text-sm font-semibold text-gray-900 mt-0.5">{fmt(rates.outbound_rate_per_unit)}</p>
            <p className="text-xs text-gray-400">per handling unit shipped</p>
          </div>
        </div>
      )}
    </div>
  )
}
