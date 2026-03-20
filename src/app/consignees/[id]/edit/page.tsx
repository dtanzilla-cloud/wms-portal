'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'

export default function EditConsigneePage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [companyName, setCompanyName] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [addresses, setAddresses] = useState<any[]>([])

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('consignees')
        .select('*, consignee_addresses(*)')
        .eq('id', params.id)
        .single()
      if (data) {
        setCompanyName(data.company_name)
        setContactName(data.contact_name ?? '')
        setContactPhone(data.contact_phone ?? '')
        setContactEmail(data.contact_email ?? '')
        setAddresses(data.consignee_addresses ?? [])
      }
      setLoading(false)
    }
    load()
  }, [params.id])

  function addAddress() {
    setAddresses([...addresses, {
      id: null, label: `Address ${addresses.length + 1}`,
      address_line1: '', address_line2: '', city: '', state: '', postal_code: '', country: 'US', is_default: false,
    }])
  }

  function updateAddress(i: number, field: string, value: any) {
    setAddresses(addresses.map((a, idx) => {
      if (field === 'is_default' && value === true) return idx === i ? { ...a, is_default: true } : { ...a, is_default: false }
      return idx === i ? { ...a, [field]: value } : a
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const { error: cErr } = await supabase.from('consignees').update({
        company_name: companyName,
        contact_name: contactName || null,
        contact_phone: contactPhone || null,
        contact_email: contactEmail || null,
      }).eq('id', params.id)
      if (cErr) throw cErr

      // Upsert addresses
      for (const addr of addresses.filter(a => a.address_line1)) {
        if (addr.id) {
          await supabase.from('consignee_addresses').update({
            label: addr.label, address_line1: addr.address_line1, address_line2: addr.address_line2 || null,
            city: addr.city, state: addr.state, postal_code: addr.postal_code, country: addr.country, is_default: addr.is_default,
          }).eq('id', addr.id)
        } else {
          await supabase.from('consignee_addresses').insert({
            consignee_id: params.id, label: addr.label, address_line1: addr.address_line1,
            address_line2: addr.address_line2 || null, city: addr.city, state: addr.state,
            postal_code: addr.postal_code, country: addr.country, is_default: addr.is_default,
          })
        }
      }

      router.push(`/consignees/${params.id}`)
    } catch (e: any) {
      setError(e.message)
      setSaving(false)
    }
  }

  async function deleteAddress(id: string) {
    if (!confirm('Delete this address?')) return
    await supabase.from('consignee_addresses').delete().eq('id', id)
    setAddresses(addresses.filter(a => a.id !== id))
  }

  if (loading) return <div className="p-8 text-sm text-gray-400">Loading…</div>

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link href={`/consignees/${params.id}`} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft size={14} /> Back to consignee
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900">Edit consignee</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Company details</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Company name <span className="text-red-500">*</span></label>
              <input type="text" required value={companyName} onChange={e => setCompanyName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
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
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                <input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">Addresses</h2>
            <button type="button" onClick={addAddress} className="btn-secondary text-xs py-1.5 flex items-center gap-1.5">
              <Plus size={13} /> Add address
            </button>
          </div>
          <div className="space-y-5">
            {addresses.map((addr, i) => (
              <div key={addr.id ?? i} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <input type="text" value={addr.label} onChange={e => updateAddress(i, 'label', e.target.value)}
                      className="px-2 py-1 border border-gray-300 rounded text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 w-28" />
                    <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                      <input type="radio" name="default_addr" checked={addr.is_default} onChange={() => updateAddress(i, 'is_default', true)} />
                      Default
                    </label>
                  </div>
                  {addr.id && (
                    <button type="button" onClick={() => deleteAddress(addr.id)} className="text-gray-400 hover:text-red-500">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Address line 1 *</label>
                    <input type="text" required value={addr.address_line1} onChange={e => updateAddress(i, 'address_line1', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Address line 2</label>
                    <input type="text" value={addr.address_line2 ?? ''} onChange={e => updateAddress(i, 'address_line2', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">City *</label>
                    <input type="text" required value={addr.city} onChange={e => updateAddress(i, 'city', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">State *</label>
                    <input type="text" required value={addr.state} onChange={e => updateAddress(i, 'state', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Postal code *</label>
                    <input type="text" required value={addr.postal_code} onChange={e => updateAddress(i, 'postal_code', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Country</label>
                    <input type="text" value={addr.country} onChange={e => updateAddress(i, 'country', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-md">{error}</p>}
        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save changes'}</button>
          <Link href={`/consignees/${params.id}`} className="text-sm text-gray-500 hover:text-gray-700">Cancel</Link>
        </div>
      </form>
    </div>
  )
}
