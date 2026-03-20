'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, ShieldCheck, Shield, Trash2, CheckCircle, Loader2 } from 'lucide-react'

interface StaffMember {
  id: string
  full_name: string
  email: string
  role: string
  created_at: string
}

interface Props {
  staffList: StaffMember[]
  currentUserId: string
  isAdmin: boolean
}

export default function StaffManager({ staffList: initial, currentUserId, isAdmin }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [staff, setStaff] = useState<StaffMember[]>(initial)
  const [showAdd, setShowAdd] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Add staff form state
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'warehouse_staff' | 'admin'>('warehouse_staff')
  const [adding, setAdding] = useState(false)

  async function handleAddStaff(e: React.FormEvent) {
    e.preventDefault()
    setAdding(true)
    setError('')
    try {
      const res = await fetch('/api/admin/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, password, role }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setStaff(prev => [...prev, data.profile])
      setShowAdd(false)
      setFullName(''); setEmail(''); setPassword(''); setRole('warehouse_staff')
      setSuccess(`${fullName} has been added as ${role.replace('_', ' ')}`)
      setTimeout(() => setSuccess(''), 4000)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setAdding(false)
    }
  }

  async function changeRole(memberId: string, newRole: 'warehouse_staff' | 'admin') {
    setLoading(memberId)
    setError('')
    try {
      const res = await fetch('/api/admin/staff', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: memberId, role: newRole }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setStaff(prev => prev.map(s => s.id === memberId ? { ...s, role: newRole } : s))
      router.refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(null)
    }
  }

  async function removeStaff(memberId: string, name: string) {
    if (!confirm(`Remove ${name} from the team? They will lose access immediately.`)) return
    setLoading(memberId)
    setError('')
    try {
      const res = await fetch('/api/admin/staff', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: memberId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setStaff(prev => prev.filter(s => s.id !== memberId))
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-700">Warehouse staff</h2>
          <p className="text-xs text-gray-500 mt-0.5">{staff.length} team member{staff.length !== 1 ? 's' : ''}</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowAdd(!showAdd)} className="btn-secondary text-xs py-1.5 flex items-center gap-1.5">
            <Plus size={13} /> Add staff member
          </button>
        )}
      </div>

      {success && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 px-3 py-2 rounded-md mb-4">
          <CheckCircle size={15} /> {success}
        </div>
      )}
      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded mb-4">{error}</p>}

      {/* Add staff form */}
      {showAdd && (
        <form onSubmit={handleAddStaff} className="bg-gray-50 rounded-lg p-4 mb-4 space-y-3 border border-gray-200">
          <p className="text-xs font-semibold text-gray-700">New staff member</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Full name *</label>
              <input type="text" required value={fullName} onChange={e => setFullName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Jane Smith" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email *</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Password *</label>
              <input type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Min. 8 characters" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Role *</label>
              <select value={role} onChange={e => setRole(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="warehouse_staff">Warehouse staff</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="submit" disabled={adding} className="btn-primary text-sm py-1.5">
              {adding ? 'Adding…' : 'Add member'}
            </button>
            <button type="button" onClick={() => setShowAdd(false)} className="btn-secondary text-sm py-1.5">Cancel</button>
          </div>
        </form>
      )}

      {/* Staff list */}
      <div className="divide-y divide-gray-100">
        {staff.map(member => (
          <div key={member.id} className="py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                member.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
              }`}>
                {member.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">
                  {member.full_name}
                  {member.id === currentUserId && <span className="ml-1.5 text-xs text-gray-400">(you)</span>}
                </p>
                <p className="text-xs text-gray-500">{member.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {loading === member.id
                ? <Loader2 size={14} className="animate-spin text-gray-400" />
                : isAdmin && member.id !== currentUserId ? (
                  <>
                    {/* Role toggle */}
                    <button
                      onClick={() => changeRole(member.id, member.role === 'admin' ? 'warehouse_staff' : 'admin')}
                      className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
                        member.role === 'admin'
                          ? 'border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100'
                          : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                      }`}
                      title={`Click to change to ${member.role === 'admin' ? 'warehouse staff' : 'admin'}`}
                    >
                      {member.role === 'admin' ? <ShieldCheck size={11} /> : <Shield size={11} />}
                      {member.role === 'admin' ? 'Admin' : 'Staff'}
                    </button>
                    {/* Remove */}
                    <button
                      onClick={() => removeStaff(member.id, member.full_name)}
                      className="text-gray-400 hover:text-red-500 transition-colors p-1"
                      title="Remove staff member"
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                ) : (
                  <span className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full ${
                    member.role === 'admin' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'
                  }`}>
                    {member.role === 'admin' ? <ShieldCheck size={11} /> : <Shield size={11} />}
                    {member.role === 'admin' ? 'Admin' : 'Staff'}
                  </span>
                )
              }
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
