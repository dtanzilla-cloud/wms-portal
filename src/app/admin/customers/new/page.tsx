'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function NewCustomerPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [company, setCompany] = useState('')
  const [billingEmail, setBillingEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState('trial')
  const [trialDays, setTrialDays] = useState('14')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company, billingEmail, fullName, userEmail, password, status, trialDays: parseInt(trialDays) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      router.push('/admin/customers')
    } catch (e: any) {
      setError(e.message)
      setLoading(false)
    }
  }

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <Link href="/admin/customers" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft size={14} /> Back to customers
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900">Add customer</h1>
        <p className="text-sm text-gray-500 mt-1">Create a new customer account and their first user login</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Company</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Company name <span className="text-red-500">*</span></label>
              <input type="text" required value={company} onChange={e => setCompany(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Acme Corp" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Billing email <span className="text-red-500">*</span></label>
              <input type="email" required value={billingEmail} onChange={e => setBillingEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="billing@acme.com" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Account status</label>
                <select value={status} onChange={e => setStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="trial">Trial</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
              {status === 'trial' && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Trial days</label>
                  <input type="number" min="1" max="365" value={trialDays} onChange={e => setTrialDays(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-1">First user login</h2>
          <p className="text-xs text-gray-500 mb-4">Creates their initial account so they can sign in immediately</p>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Full name <span className="text-red-500">*</span></label>
              <input type="text" required value={fullName} onChange={e => setFullName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Jane Smith" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email <span className="text-red-500">*</span></label>
              <input type="email" required value={userEmail} onChange={e => setUserEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="jane@acme.com" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Password <span className="text-red-500">*</span></label>
              <input type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Min. 8 characters" />
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-md">{error}</p>}

        <div className="flex items-center gap-3">
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Creating…' : 'Create customer'}
          </button>
          <Link href="/admin/customers" className="text-sm text-gray-500 hover:text-gray-700">Cancel</Link>
        </div>
      </form>
    </div>
  )
}
