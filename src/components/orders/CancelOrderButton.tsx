'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { X } from 'lucide-react'

export default function CancelOrderButton({ orderId }: { orderId: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  async function handleCancel() {
    if (!confirm('Cancel this order? This cannot be undone.')) return
    setLoading(true)
    await supabase.from('orders').update({ status: 'cancelled' }).eq('id', orderId)
    router.refresh()
    setLoading(false)
  }

  return (
    <button
      onClick={handleCancel}
      disabled={loading}
      className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 border border-red-200 px-3 py-1.5 rounded-md hover:bg-red-50 transition-colors"
    >
      <X size={13} />
      {loading ? 'Cancelling…' : 'Cancel order'}
    </button>
  )
}
