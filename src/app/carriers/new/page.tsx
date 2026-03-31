'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft } from 'lucide-react'

export default function NewCarrierPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [name, setName] = useState('')
  const [scacCode, setScacCode] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [notes, setNotes] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { data, error: err } = await supabase.from('carriers').insert({
        name,
        scac_code: scacCode || null,
        contact_name: contactName || null,
        contact_phone: contactPhone || null,
        contact_email: contactEmail || null,
        notes: notes || null,
      }).select().single()
      if (err) throw err
      router.push(`/carriers/${data.id}`)
    } catch (e: any) {
      setError(e.message)
      setLoading(false)
    }
  }

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <Link href="/carriers" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft size={14} /> Back to carriers
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900">Add carrier</h1>
        <p className="text-sm text-gray-500 mt-1">A shipping carrier for outbound orders</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Carrier details</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Name <span className="text-red-500">*</span>
              </label>
              <input type="text" required value={name} onChange={e => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. FedEx, UPS, DHL" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">SCAC code</label>
              <input type="text" value={scacCode} onChange={e => setScacCode(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. FDXE" maxLength={4} />
            </div>
          </div>
        </div>

        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Contact</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Contact name</label>
                <input type="text" value={contactName} onChange={e => setContactName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                <input type="tel" value={contactPhone} onChange={e => setContactPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
              <input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        </div>

        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Notes</h2>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            placeholder="Account numbers, service codes, special instructions…" />
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-md">{error}</p>}
        <div className="flex items-center gap-3">
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Saving…' : 'Save carrier'}
          </button>
          <Link href="/carriers" className="text-sm text-gray-500 hover:text-gray-700">Cancel</Link>
        </div>
      </form>
    </div>
  )
}
