'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Upload, CheckCircle, XCircle, Download } from 'lucide-react'

interface ParsedRow {
  order_ref: string
  expected_date: string
  pallet_count: string
  carrier: string
  tracking_number: string
  notes: string
  reference_type: string
  reference_number: string
  sku_code: string
  quantity: string
  carton_count: string
  units_per_carton: string
  lot_number: string
  valid: boolean
  error?: string
}

interface OrderGroup {
  order_ref: string
  expected_date: string
  pallet_count: string
  carrier: string
  tracking_number: string
  notes: string
  reference_type: string
  reference_number: string
  items: ParsedRow[]
  valid: boolean
}

const VALID_REF_TYPES = ['', 'po_number', 'bl_number', 'other']

function parseCSV(text: string): ParsedRow[] {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []

  return lines.slice(1).map(line => {
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

    const [
      order_ref, expected_date, pallet_count, carrier, tracking_number,
      notes, reference_type, reference_number, sku_code, quantity,
      carton_count, units_per_carton, lot_number,
    ] = cols

    const refType = (reference_type ?? '').toLowerCase().trim()

    let error: string | undefined
    if (!order_ref) error = 'Missing order_ref'
    else if (!sku_code) error = 'Missing sku_code'
    else if (!quantity || isNaN(Number(quantity)) || Number(quantity) <= 0) error = 'quantity must be a positive number'
    else if (refType && !VALID_REF_TYPES.includes(refType)) error = `Invalid reference_type "${refType}"`

    return {
      order_ref: (order_ref ?? '').trim(),
      expected_date: (expected_date ?? '').trim(),
      pallet_count: (pallet_count ?? '').trim(),
      carrier: (carrier ?? '').trim(),
      tracking_number: (tracking_number ?? '').trim(),
      notes: (notes ?? '').trim(),
      reference_type: refType,
      reference_number: (reference_number ?? '').trim(),
      sku_code: (sku_code ?? '').toUpperCase().trim(),
      quantity: (quantity ?? '').trim(),
      carton_count: (carton_count ?? '').trim(),
      units_per_carton: (units_per_carton ?? '').trim(),
      lot_number: (lot_number ?? '').trim(),
      valid: !error,
      error,
    }
  }).filter(r => r.order_ref || r.sku_code)
}

function groupRows(rows: ParsedRow[]): OrderGroup[] {
  const map = new Map<string, OrderGroup>()
  for (const row of rows) {
    if (!map.has(row.order_ref)) {
      map.set(row.order_ref, {
        order_ref: row.order_ref,
        expected_date: row.expected_date,
        pallet_count: row.pallet_count,
        carrier: row.carrier,
        tracking_number: row.tracking_number,
        notes: row.notes,
        reference_type: row.reference_type,
        reference_number: row.reference_number,
        items: [],
        valid: true,
      })
    }
    const group = map.get(row.order_ref)!
    group.items.push(row)
    if (!row.valid) group.valid = false
  }
  return Array.from(map.values())
}

const TEMPLATE_CSV =
  `order_ref,expected_date,pallet_count,carrier,tracking_number,notes,reference_type,reference_number,sku_code,quantity,carton_count,units_per_carton,lot_number\n` +
  `PO-001,2024-02-01,3,FedEx Freight,PRO123456,,po_number,PO-001,ABC-001,100,10,10,LOT-2024-001\n` +
  `PO-001,,,,,,,,,ABC-002,50,5,10,LOT-2024-002\n` +
  `SHIP-002,2024-02-05,2,UPS Freight,1Z999,,bl_number,BL-9988,XYZ-001,200,,,`
const TEMPLATE_URL = `data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE_CSV)}`

export default function ImportInboundOrdersPage() {
  const router = useRouter()
  const supabase = createClient()
  const [profile, setProfile] = useState<any>(null)
  const [customers, setCustomers] = useState<any[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [importing, setImporting] = useState(false)
  const [importedCount, setImportedCount] = useState(0)
  const [errors, setErrors] = useState<string[]>([])
  const [done, setDone] = useState(false)

  const isStaff = profile?.role === 'warehouse_staff' || profile?.role === 'admin'

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user!.id).single()
      setProfile(prof)
      if (prof?.role === 'warehouse_staff' || prof?.role === 'admin') {
        const { data: custs } = await supabase.from('customers').select('id, name').eq('status', 'active').order('name')
        setCustomers(custs ?? [])
      }
    }
    load()
  }, [])

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setRows(parseCSV(ev.target?.result as string))
    reader.readAsText(file)
  }

  async function handleImport() {
    setImporting(true)
    setErrors([])
    const errs: string[] = []
    let count = 0

    const customerId = isStaff ? selectedCustomerId : profile?.customer_id
    if (!customerId) { setErrors(['Please select a customer']); setImporting(false); return }

    // Pre-load all SKUs for this customer so we don't hit the DB per row
    const { data: skuData } = await supabase
      .from('skus').select('id, sku_code').eq('customer_id', customerId)
    const skuMap = Object.fromEntries((skuData ?? []).map(s => [s.sku_code.toUpperCase(), s.id]))

    const groups = groupRows(rows.filter(r => r.valid))

    for (const group of groups) {
      try {
        // Validate all SKUs exist before creating order
        const missingSkus = group.items
          .map(it => it.sku_code)
          .filter(code => !skuMap[code])
        if (missingSkus.length > 0) {
          throw new Error(`SKU(s) not found: ${missingSkus.join(', ')}`)
        }

        const { data: order, error: orderErr } = await supabase.from('orders').insert({
          customer_id: customerId,
          order_type: 'inbound',
          order_number: '',
          status: 'submitted',
          expected_date: group.expected_date || null,
          pallet_count: group.pallet_count ? parseInt(group.pallet_count) : 1,
          carrier: group.carrier || null,
          tracking_number: group.tracking_number || null,
          notes: group.notes || null,
          reference_type: group.reference_type || null,
          reference_number: group.reference_number || null,
          created_by: profile.id,
        }).select().single()
        if (orderErr) throw orderErr

        const { error: itemsErr } = await supabase.from('order_items').insert(
          group.items.map(it => ({
            order_id: order.id,
            sku_id: skuMap[it.sku_code],
            quantity: Number(it.quantity),
            carton_count: it.carton_count ? Number(it.carton_count) : null,
            units_per_carton: it.units_per_carton ? Number(it.units_per_carton) : null,
            lot_number: it.lot_number || null,
          }))
        )
        if (itemsErr) throw itemsErr

        // Send notification
        fetch('/api/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'inbound_submitted', order_id: order.id }),
        })

        count++
      } catch (e: any) {
        errs.push(`Order "${group.order_ref}": ${e.message}`)
      }
    }

    setImportedCount(count)
    setErrors(errs)
    setImporting(false)
    setDone(true)
  }

  const groups = groupRows(rows)
  const validGroups = groups.filter(g => g.valid)
  const invalidRows = rows.filter(r => !r.valid)

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <Link href="/orders/inbound" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft size={14} /> Back to inbound orders
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900">Import inbound orders</h1>
        <p className="text-sm text-gray-500 mt-1">Upload a CSV to bulk-create inbound orders. Each unique <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">order_ref</code> becomes one order.</p>
      </div>

      {/* Template */}
      <div className="card p-5 mb-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-800">CSV template</p>
            <p className="text-xs text-gray-500 mt-0.5">Rows with the same order_ref are grouped into one order</p>
          </div>
          <a href={TEMPLATE_URL} download="inbound-orders-template.csv" className="btn-secondary text-sm flex items-center gap-2">
            <Download size={14} /> Download template
          </a>
        </div>
        <div className="mt-3 bg-gray-50 rounded-md p-3 overflow-x-auto">
          <p className="text-xs font-mono text-gray-500 whitespace-nowrap">
            order_ref*, expected_date (YYYY-MM-DD), pallet_count, carrier, tracking_number, notes, reference_type (po_number/bl_number/other), reference_number, sku_code*, quantity*, carton_count, units_per_carton, lot_number
          </p>
        </div>
      </div>

      {!done ? (
        <div className="card p-5 space-y-5">
          {isStaff && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Customer <span className="text-red-500">*</span></label>
              <select
                value={selectedCustomerId} onChange={e => setSelectedCustomerId(e.target.value)}
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
                <span className="text-sm text-gray-700">{rows.length} rows → <strong>{groups.length}</strong> order{groups.length !== 1 ? 's' : ''}</span>
                {validGroups.length > 0 && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">{validGroups.length} valid</span>}
                {invalidRows.length > 0 && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">{invalidRows.length} row errors</span>}
              </div>

              <div className="border border-gray-200 rounded-lg overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-500 w-6"></th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Order Ref</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Expected</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">SKU Code</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500">Qty</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Lot #</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Carrier</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Ref #</th>
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
                        <td className="px-3 py-2 font-medium text-gray-800">{row.order_ref}</td>
                        <td className="px-3 py-2 text-gray-500">{row.expected_date || '—'}</td>
                        <td className="px-3 py-2 font-mono text-gray-700">{row.sku_code}</td>
                        <td className="px-3 py-2 text-right text-gray-500">{row.quantity}</td>
                        <td className="px-3 py-2 font-mono text-gray-500 text-xs">{row.lot_number || '—'}</td>
                        <td className="px-3 py-2 text-gray-500">{row.carrier || '—'}</td>
                        <td className="px-3 py-2 text-gray-500">{row.reference_number || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {invalidRows.length > 0 && (
                <div className="mt-2 space-y-1">
                  {invalidRows.map((r, i) => (
                    <p key={i} className="text-xs text-red-600">{r.order_ref || r.sku_code || `Row ${i + 1}`}: {r.error}</p>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-3 mt-4">
                <button
                  onClick={handleImport}
                  disabled={importing || validGroups.length === 0 || (isStaff && !selectedCustomerId)}
                  className="btn-primary flex items-center gap-2"
                >
                  {importing ? 'Importing…' : `Import ${validGroups.length} order${validGroups.length !== 1 ? 's' : ''}`}
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
            Successfully imported <strong>{importedCount}</strong> order{importedCount !== 1 ? 's' : ''}
            {errors.length > 0 && `, ${errors.length} failed`}
          </p>
          {errors.length > 0 && (
            <div className="text-left bg-red-50 rounded-lg p-3 mb-4">
              {errors.map((e, i) => <p key={i} className="text-xs text-red-600">{e}</p>)}
            </div>
          )}
          <div className="flex items-center justify-center gap-3">
            <Link href="/orders/inbound" className="btn-primary inline-flex">View inbound orders</Link>
            <button onClick={() => { setDone(false); setRows([]) }} className="btn-secondary">Import more</button>
          </div>
        </div>
      )}
    </div>
  )
}
