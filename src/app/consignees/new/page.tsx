'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'

const emptyAddress = () => ({
  label: 'Default', address_line1: '', address_line2: '', city: '',
  state: '', postal_code: '', country: 'US', is_default: true,
})

export default function NewConsigneePage() {
  const router = useRouter()
  const supabase = createClient()
  const [profile, setProfile] = useState<any>(null)
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [addresses, setAddresses] = useState([emptyAddress()])

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

  function addAddress() {
    setAddresses([...addresses, { ...emptyAddress(), label: `Address ${addresses.length + 1}`, is_default: false }])
  }
  function removeAddress(i: number) {
    const updated = addresses.filter((_, idx) => idx !== i)
    if (!updated.some(a => a.is_default) && updated.length > 0) updated[0].is_default = true
    setAddresses(updated)
  }
  function updateAddress(i: number, field: string, value: any) {
    setAddresses(addresses.map((a, idx) => {
      if (field === 'is_default' && value === true) return idx === i ? { ...a, is_default: true } : { ...a, is_default: false }
      return idx === i ? { ...a, [field]: value } : a
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const customerId = isStaff ? selectedCustomerId : profile?.customer_id
      if (!customerId) { setError('Please select a customer'); setLoading(false); return }

      const { data: consignee, error: cErr } = await supabase.from('consignees').insert({
        customer_id: customerId, company_name: companyName,
        contact_name: contactName || null, contact_phone: contactPhone || null, contact_email: contactEmail || null,
      }).select().single()
      if (cErr) throw cErr

      const validAddresses = addresses.filter(a => a.address_line1)
      if (validAddresses.length > 0) {
        const { error: aErr } = await supabase.from('consignee_addresses').insert(
          validAddresses.map(a => ({ ...a, consignee_id: consignee.id }))
        )
        if (aErr) throw aErr
      }

      router.push(`/consignees/${consignee.id}`)
    } catch (e: any) { setError(e.message); setLoading(false) }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link href="/consignees" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft size={14} /> Back to consignees
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900">Add consignee</h1>
        <p className="text-sm text-gray-500 mt-1">A ship-to contact for outbound orders</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {isStaff && (
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Customer</h2>
            <select required value={selectedCustomerId} onChange={e => setSelectedCustomerId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Select customer…</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}

        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Company details</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Company name <span className="text-red-500">*</span></label>
              <input type="text" required value={companyName} onChange={e => setCompanyName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Acme Corp" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Contact name</label>
                <input type="text" value={contactName} onChange={e => setContactName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Contact phone</label>
                <input type="tel" value={contactPhone} onChange={e => setContactPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Contact email</label>
                <input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">Delivery addresses</h2>
            <button type="button" onClick={addAddress} className="btn-secondary flex items-center gap-1.5 text-xs py-1.5">
              <Plus size={13} /> Add address
            </button>
          </div>
          <div className="space-y-6">
            {addresses.map((addr, i) => (
              <div key={i} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <input type="text" value={addr.label} onChange={e => updateAddress(i, 'label', e.target.value)}
                      className="px-2 py-1 border border-gray-300 rounded text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 w-28" />
                    <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                      <input type="radio" name="default_addr" checked={addr.is_default} onChange={() => updateAddress(i, 'is_default', true)} />
                      Default
                    </label>
                  </div>
                  {addresses.length > 1 && (
                    <button type="button" onClick={() => removeAddress(i)} className="text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Address line 1 <span className="text-red-500">*</span></label>
                    <input type="text" required value={addr.address_line1} onChange={e => updateAddress(i, 'address_line1', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Address line 2</label>
                    <input type="text" value={addr.address_line2} onChange={e => updateAddress(i, 'address_line2', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">City <span className="text-red-500">*</span></label>
                    <input type="text" required value={addr.city} onChange={e => updateAddress(i, 'city', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">State <span className="text-red-500">*</span></label>
                    <input type="text" required value={addr.state} onChange={e => updateAddress(i, 'state', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="CA" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Postal code <span className="text-red-500">*</span></label>
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
          <button type="submit" disabled={loading} className="btn-primary">{loading ? 'Saving…' : 'Save consignee'}</button>
          <Link href="/consignees" className="text-sm text-gray-500 hover:text-gray-700">Cancel</Link>
        </div>
      </form>
    </div>
  )
}
