'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Upload, CheckCircle, XCircle, Download } from 'lucide-react'

interface ParsedRow {
  sku_code: string
  description: string
  unit: string
  quantity: string
  storage_unit: string
  dimensions_cm: string
  valid: boolean
  error?: string
}

const VALID_UNITS = ['each', 'case', 'bag', 'drum', 'tote']

function parseCSV(text: string): ParsedRow[] {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []
  return lines.slice(1).map(line => {
    // Handle quoted fields
    const cols: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') { inQuotes = !inQuotes }
      else if (ch === ',' && !inQuotes) { cols.push(current.trim()); current = '' }
      else { current += ch }
    }
    cols.push(current.trim())

    const [sku_code, description, unit, quantity, storage_unit, dimensions_cm] = cols
    const normalizedUnit = (unit || 'each').toLowerCase().trim()
    const unitValid = !unit || VALID_UNITS.includes(normalizedUnit)

    const valid = !!sku_code && !!description
    let error: string | undefined
    if (!sku_code) error = 'Missing SKU code'
    else if (!description) error = 'Missing description'
    else if (!unitValid) error = `Invalid unit "${unit}" — must be one of: ${VALID_UNITS.join(', ')}`

    return {
      sku_code: (sku_code ?? '').toUpperCase().trim(),
      description: description ?? '',
      unit: VALID_UNITS.includes(normalizedUnit) ? normalizedUnit : 'each',
      quantity: quantity ?? '',
      storage_unit: storage_unit ?? '',
      dimensions_cm: dimensions_cm ?? '',
      valid: valid && unitValid,
      error,
    }
  }).filter(r => r.sku_code)
}

const TEMPLATE_CSV = `sku_code,description,unit,quantity,storage_unit,dimensions_cm\nABC-001,Blue Widget 12oz,each,100,5,30x20x10\nABC-002,Red Drum 55gal,drum,50,10,`
const TEMPLATE_URL = `data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE_CSV)}`

export default function ImportSKUsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [profile, setProfile] = useState<any>(null)
  const [customers, setCustomers] = useState<any[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [importing, setImporting] = useState(false)
  const [imported, setImported] = useState(0)
  const [errors, setErrors] = useState<string[]>([])
  const [done, setDone] = useState(false)

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

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      setRows(parseCSV(text))
    }
    reader.readAsText(file)
  }

  async function handleImport() {
    setImporting(true)
    setErrors([])
    let count = 0
    const errs: string[] = []

    const customerId = isStaff ? selectedCustomerId : profile?.customer_id
    if (!customerId) {
      setErrors(['Please select a customer'])
      setImporting(false)
      return
    }

    const validRows = rows.filter(r => r.valid)
    for (const row of validRows) {
      try {
        const qty = row.quantity ? parseInt(row.quantity) : 0
        const { data: sku, error: err } = await supabase.from('skus').insert({
          customer_id: customerId,
          sku_code: row.sku_code,
          description: row.description,
          unit: row.unit,
          quantity: qty || null,
          storage_unit: row.storage_unit ? parseInt(row.storage_unit) : null,
          dimensions_cm: row.dimensions_cm || null,
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
        count++
      } catch (e: any) {
        errs.push(`${row.sku_code}: ${e.message}`)
      }
    }

    setImported(count)
    setErrors(errs)
    setImporting(false)
    setDone(true)
  }

  const validCount = rows.filter(r => r.valid).length
  const invalidCount = rows.filter(r => !r.valid).length

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <Link href="/inventory" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft size={14} /> Back to inventory
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900">Import SKUs</h1>
        <p className="text-sm text-gray-500 mt-1">Upload a CSV to bulk-import SKUs into inventory</p>
      </div>

      {/* Template download */}
      <div className="card p-5 mb-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-800">CSV template</p>
            <p className="text-xs text-gray-500 mt-0.5">Download the template, fill it in, then upload below</p>
          </div>
          <a
            href={TEMPLATE_URL}
            download="skus-template.csv"
            className="btn-secondary text-sm flex items-center gap-2"
          >
            <Download size={14} /> Download template
          </a>
        </div>
        <div className="mt-3 bg-gray-50 rounded-md p-3 overflow-x-auto">
          <p className="text-xs font-mono text-gray-500 whitespace-nowrap">
            sku_code*, description*, unit (each/case/bag/drum/tote), quantity, storage_unit, dimensions_cm
          </p>
        </div>
      </div>

      {!done ? (
        <div className="card p-5 space-y-5">
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
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Upload CSV</h2>
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-8 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
              <Upload size={24} className="text-gray-400 mb-2" />
              <p className="text-sm text-gray-600 font-medium">Click to upload CSV</p>
              <p className="text-xs text-gray-400 mt-1">CSV files only</p>
              <input type="file" accept=".csv" className="hidden" onChange={handleFile} />
            </label>
          </div>

          {rows.length > 0 && (
            <div>
              <div className="flex items-center gap-4 mb-3">
                <span className="text-sm text-gray-700">{rows.length} rows found</span>
                {validCount > 0 && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">{validCount} valid</span>}
                {invalidCount > 0 && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">{invalidCount} invalid</span>}
              </div>

              <div className="border border-gray-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-500 w-6"></th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">SKU Code</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Description</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Unit</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500">Qty</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500">Storage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.map((row, i) => (
                      <tr key={i} className={row.valid ? '' : 'bg-red-50'}>
                        <td className="px-3 py-2">
                          {row.valid
                            ? <CheckCircle size={13} className="text-green-500" />
                            : <span title={row.error}><XCircle size={13} className="text-red-500" /></span>}
                        </td>
                        <td className="px-3 py-2 font-mono font-medium text-gray-800">{row.sku_code}</td>
                        <td className="px-3 py-2 text-gray-600">{row.description}</td>
                        <td className="px-3 py-2 text-gray-500">{row.unit || 'each'}</td>
                        <td className="px-3 py-2 text-right text-gray-500">{row.quantity || '—'}</td>
                        <td className="px-3 py-2 text-right text-gray-500">{row.storage_unit || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {rows.some(r => !r.valid) && (
                <div className="mt-2 space-y-1">
                  {rows.filter(r => !r.valid).map((r, i) => (
                    <p key={i} className="text-xs text-red-600">{r.sku_code || 'Row'}: {r.error}</p>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-3 mt-4">
                <button
                  onClick={handleImport}
                  disabled={importing || validCount === 0 || (isStaff && !selectedCustomerId)}
                  className="btn-primary flex items-center gap-2"
                >
                  {importing ? 'Importing…' : `Import ${validCount} SKU${validCount !== 1 ? 's' : ''}`}
                </button>
                <button onClick={() => setRows([])} className="btn-secondary">Clear</button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="card p-8 text-center">
          <CheckCircle size={32} className="mx-auto text-green-500 mb-3" />
          <p className="text-lg font-semibold text-gray-900 mb-1">Import complete</p>
          <p className="text-sm text-gray-500 mb-4">
            Successfully imported <strong>{imported}</strong> SKU{imported !== 1 ? 's' : ''}
            {errors.length > 0 && `, ${errors.length} failed`}
          </p>
          {errors.length > 0 && (
            <div className="text-left bg-red-50 rounded-lg p-3 mb-4">
              {errors.map((e, i) => <p key={i} className="text-xs text-red-600">{e}</p>)}
            </div>
          )}
          <Link href="/inventory" className="btn-primary inline-flex">View inventory</Link>
        </div>
      )}
    </div>
  )
}
