'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft } from 'lucide-react'

export default function EditCarrierPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [name, setName] = useState('')
  const [scacCode, setScacCode] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('carriers').select('*').eq('id', params.id).single()
      if (data) {
        setName(data.name)
        setScacCode(data.scac_code ?? '')
        setContactName(data.contact_name ?? '')
        setContactPhone(data.contact_phone ?? '')
        setContactEmail(data.contact_email ?? '')
        setNotes(data.notes ?? '')
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
      const { error: err } = await supabase.from('carriers').update({
        name,
        scac_code: scacCode || null,
        contact_name: contactName || null,
        contact_phone: contactPhone || null,
        contact_email: contactEmail || null,
        notes: notes || null,
      }).eq('id', params.id)
      if (err) throw err
      router.push(`/carriers/${params.id}`)
    } catch (e: any) {
      setError(e.message)
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this carrier? This cannot be undone.')) return
    await supabase.from('carriers').delete().eq('id', params.id)
    router.push('/carriers')
  }

  if (loading) return <div className="p-8 text-sm text-gray-400">Loading…</div>

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <Link href={`/carriers/${params.id}`} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft size={14} /> Back to carrier
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900">Edit carrier</h1>
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">SCAC code</label>
              <input type="text" value={scacCode} onChange={e => setScacCode(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                maxLength={4} />
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
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-md">{error}</p>}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <Link href={`/carriers/${params.id}`} className="text-sm text-gray-500 hover:text-gray-700">Cancel</Link>
          </div>
          <button type="button" onClick={handleDelete}
            className="text-sm text-red-500 hover:text-red-700 border border-red-200 px-3 py-1.5 rounded-md hover:bg-red-50 transition-colors">
            Delete carrier
          </button>
        </div>
      </form>
    </div>
  )
}
