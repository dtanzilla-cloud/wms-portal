'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Upload, CheckCircle, XCircle, Download } from 'lucide-react'

interface ParsedRow {
  company_name: string
  contact_name: string
  contact_phone: string
  contact_email: string
  address_line1: string
  address_line2: string
  city: string
  state: string
  postal_code: string
  country: string
  valid: boolean
  error?: string
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []
  // Skip header row
  return lines.slice(1).map(line => {
    const cols = line.split(',').map(c => c.replace(/^"|"$/g, '').trim())
    const [company_name, contact_name, contact_phone, contact_email, address_line1, address_line2, city, state, postal_code, country] = cols
    const valid = !!company_name && !!address_line1 && !!city && !!state && !!postal_code
    return {
      company_name: company_name ?? '',
      contact_name: contact_name ?? '',
      contact_phone: contact_phone ?? '',
      contact_email: contact_email ?? '',
      address_line1: address_line1 ?? '',
      address_line2: address_line2 ?? '',
      city: city ?? '',
      state: state ?? '',
      postal_code: postal_code ?? '',
      country: country || 'US',
      valid,
      error: !valid ? 'Missing required fields (company name, address, city, state, postal code)' : undefined,
    }
  }).filter(r => r.company_name)
}

export default function ImportConsigneesPage() {
  const router = useRouter()
  const supabase = createClient()
  const [profile, setProfile] = useState<any>(null)
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [importing, setImporting] = useState(false)
  const [imported, setImported] = useState(0)
  const [errors, setErrors] = useState<string[]>([])
  const [done, setDone] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user!.id).single()
      setProfile(prof)
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

    const validRows = rows.filter(r => r.valid)
    for (const row of validRows) {
      try {
        const { data: consignee, error: cErr } = await supabase.from('consignees').insert({
          customer_id: profile?.customer_id,
          company_name: row.company_name,
          contact_name: row.contact_name || null,
          contact_phone: row.contact_phone || null,
          contact_email: row.contact_email || null,
        }).select().single()

        if (cErr) throw cErr

        await supabase.from('consignee_addresses').insert({
          consignee_id: consignee.id,
          label: 'Default',
          address_line1: row.address_line1,
          address_line2: row.address_line2 || null,
          city: row.city,
          state: row.state,
          postal_code: row.postal_code,
          country: row.country || 'US',
          is_default: true,
        })
        count++
      } catch (e: any) {
        errs.push(`${row.company_name}: ${e.message}`)
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
        <Link href="/consignees" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft size={14} /> Back to consignees
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900">Import consignees</h1>
        <p className="text-sm text-gray-500 mt-1">Upload a CSV to bulk-import consignees and their addresses</p>
      </div>

      {/* Template download */}
      <div className="card p-5 mb-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-800">CSV template</p>
            <p className="text-xs text-gray-500 mt-0.5">Download the template, fill it in, then upload below</p>
          </div>
          <a
            href="data:text/csv;charset=utf-8,company_name,contact_name,contact_phone,contact_email,address_line1,address_line2,city,state,postal_code,country%0AExample Corp,John Smith,555-1234,john@example.com,123 Main St,,New York,NY,10001,US"
            download="consignees-template.csv"
            className="btn-secondary text-sm flex items-center gap-2"
          >
            <Download size={14} /> Download template
          </a>
        </div>
        <div className="mt-3 bg-gray-50 rounded-md p-3 overflow-x-auto">
          <p className="text-xs font-mono text-gray-500 whitespace-nowrap">
            company_name, contact_name, contact_phone, contact_email, address_line1, address_line2, city, state, postal_code, country
          </p>
        </div>
      </div>

      {!done ? (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Upload CSV</h2>
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-8 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
            <Upload size={24} className="text-gray-400 mb-2" />
            <p className="text-sm text-gray-600 font-medium">Click to upload CSV</p>
            <p className="text-xs text-gray-400 mt-1">CSV files only</p>
            <input type="file" accept=".csv" className="hidden" onChange={handleFile} />
          </label>

          {rows.length > 0 && (
            <div className="mt-5">
              <div className="flex items-center gap-4 mb-3">
                <span className="text-sm text-gray-700">{rows.length} rows found</span>
                {validCount > 0 && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">{validCount} valid</span>}
                {invalidCount > 0 && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">{invalidCount} invalid</span>}
              </div>

              <div className="border border-gray-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-500"></th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Company</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">City, State</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Contact</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.map((row, i) => (
                      <tr key={i} className={row.valid ? '' : 'bg-red-50'}>
                        <td className="px-3 py-2">
                          {row.valid
                            ? <CheckCircle size={13} className="text-green-500" />
                            : <XCircle size={13} className="text-red-500" />}
                        </td>
                        <td className="px-3 py-2 font-medium text-gray-800">{row.company_name}</td>
                        <td className="px-3 py-2 text-gray-600">{row.city}{row.state ? `, ${row.state}` : ''}</td>
                        <td className="px-3 py-2 text-gray-500">{row.contact_name || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center gap-3 mt-4">
                <button
                  onClick={handleImport}
                  disabled={importing || validCount === 0}
                  className="btn-primary flex items-center gap-2"
                >
                  {importing ? 'Importing…' : `Import ${validCount} consignee${validCount !== 1 ? 's' : ''}`}
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
            Successfully imported <strong>{imported}</strong> consignee{imported !== 1 ? 's' : ''}
            {errors.length > 0 && `, ${errors.length} failed`}
          </p>
          {errors.length > 0 && (
            <div className="text-left bg-red-50 rounded-lg p-3 mb-4">
              {errors.map((e, i) => <p key={i} className="text-xs text-red-600">{e}</p>)}
            </div>
          )}
          <Link href="/consignees" className="btn-primary inline-flex">View consignees</Link>
        </div>
      )}
    </div>
  )
}
