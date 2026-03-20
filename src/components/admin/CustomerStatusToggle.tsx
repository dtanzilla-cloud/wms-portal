'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle, Clock, Ban, ChevronDown } from 'lucide-react'

interface Props {
  customer: {
    id: string
    name: string
    status: string
    trial_ends_at: string | null
  }
}

const STATUS_OPTIONS = [
  { value: 'trial', label: 'Trial', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
  { value: 'active', label: 'Active', icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
  { value: 'suspended', label: 'Suspended', icon: Ban, color: 'text-red-500', bg: 'bg-red-50' },
]

export default function CustomerStatusToggle({ customer }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const current = STATUS_OPTIONS.find(s => s.value === customer.status) ?? STATUS_OPTIONS[0]

  async function setStatus(status: string) {
    setLoading(true)
    setOpen(false)
    await supabase.from('customers').update({ status }).eq('id', customer.id)
    router.refresh()
    setLoading(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={loading}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${current.bg} ${current.color} border border-current border-opacity-20`}
      >
        <current.icon size={11} />
        {current.label}
        <ChevronDown size={11} />
      </button>
      {open && (
        <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1 w-36">
          {STATUS_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setStatus(opt.value)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50 ${opt.color} ${opt.value === customer.status ? 'font-semibold' : ''}`}
            >
              <opt.icon size={12} />
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
