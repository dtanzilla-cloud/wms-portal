'use client'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function AcceptInvitePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [form, setForm] = useState({ full_name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [tokenValid, setTokenValid] = useState<boolean | null>(null)
  const [consigneeName, setConsigneeName] = useState('')

  useEffect(() => {
    if (!token) { setTokenValid(false); return }
    // Validate token by fetching consignee info from a lightweight check endpoint
    fetch(`/api/invites/consignee/check?token=${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.valid) {
          setTokenValid(true)
          setConsigneeName(d.company_name ?? '')
          if (d.contact_email) setForm(f => ({ ...f, email: d.contact_email }))
        } else {
          setTokenValid(false)
          setError(d.error ?? 'Invalid or expired invitation link')
        }
      })
      .catch(() => setTokenValid(false))
  }, [token])

  function set(field: string) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [field]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/auth/accept-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, token }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Failed to create account'); setLoading(false); return }
    router.push(data.redirect ?? '/consignee')
  }

  if (tokenValid === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-500">Validating invitation…</p>
      </div>
    )
  }

  if (tokenValid === false) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <h1 className="text-2xl font-semibold text-blue-700 mb-4">CTS Portal</h1>
          <div className="card p-6">
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded mb-4">
              {error || 'This invitation link is invalid or has expired.'}
            </p>
            <Link href="/auth/login" className="text-sm text-blue-600 hover:underline">
              Go to login
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-blue-700">CTS Portal</h1>
          <p className="text-sm text-gray-500 mt-1">
            Set up your account{consigneeName ? ` for ${consigneeName}` : ''}
          </p>
        </div>
        <div className="card p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Your name</label>
              <input type="text" required value={form.full_name} onChange={set('full_name')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Jane Smith" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" required value={form.email} onChange={set('email')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="jane@company.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input type="password" required minLength={8} value={form.password} onChange={set('password')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Min. 8 characters" />
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Creating account…' : 'Create account & sign in'}
            </button>
          </form>
          <div className="mt-4 text-center text-xs text-gray-500">
            Already have an account? <Link href="/auth/login" className="text-blue-600 hover:underline">Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
