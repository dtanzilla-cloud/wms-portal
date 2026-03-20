'use client'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function EditCustomerPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()

  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState('')

  const [name, setName] = useState('')
  const [billingEmail, setBillingEmail] = useState('')
  const [status, setStatus] = useState('trial')
  const [trialEndsAt, setTrialEndsAt] = useState('')

  useEffect(() => {
    fetch(`/api/admin/customers/${id}`)
      .then(r => r.json())
      .then(data => {
        if (data.customer) {
          setName(data.customer.name)
          setBillingEmail(data.customer.billing_email)
          setStatus(data.customer.status)
          setTrialEndsAt(data.customer.trial_ends_at
            ? new Date(data.customer.trial_ends_at).toISOString().slice(0, 10)
            : '')
        }
      })
      .finally(() => setFetching(false))
  }, [id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/customers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          billingEmail,
          status,
          trialEndsAt: status === 'trial' && trialEndsAt ? trialEndsAt : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      router.push(`/admin/customers/${id}`)
    } catch (e: any) {
      setError(e.message)
      setLoading(false)
    }
  }

  if (fetching) return <div className="text-sm text-gray-500 p-6">Loading…</div>

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <Link href={`/admin/customers/${id}`} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft size={14} /> Back to customer
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900">Edit customer</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="card p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Company name <span className="text-red-500">*</span></label>
            <input type="text" required value={name} onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Billing email <span className="text-red-500">*</span></label>
            <input type="email" required value={billingEmail} onChange={e => setBillingEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
              <select value={status} onChange={e => setStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="trial">Trial</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
            {status === 'trial' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Trial ends</label>
                <input type="date" value={trialEndsAt} onChange={e => setTrialEndsAt(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            )}
          </div>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-md">{error}</p>}

        <div className="flex items-center gap-3">
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Saving…' : 'Save changes'}
          </button>
          <Link href={`/admin/customers/${id}`} className="text-sm text-gray-500 hover:text-gray-700">Cancel</Link>
        </div>
      </form>
    </div>
  )
}
