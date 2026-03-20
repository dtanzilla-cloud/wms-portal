'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Loader2 } from 'lucide-react'

interface Props {
  orderId: string
  onGenerated?: () => void
}

export default function GeneratePDFButtons({ orderId, onGenerated }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function generate(type: 'packing_list' | 'bill_of_lading') {
    setLoading(type)
    setError('')
    try {
      const res = await fetch('/api/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, type }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (data.url) window.open(data.url, '_blank')
      onGenerated?.()
      router.refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-xs text-red-600">{error}</span>}
      <button
        onClick={() => generate('packing_list')}
        disabled={!!loading}
        className="btn-secondary text-xs py-1.5 flex items-center gap-1.5"
      >
        {loading === 'packing_list' ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
        Packing list
      </button>
      <button
        onClick={() => generate('bill_of_lading')}
        disabled={!!loading}
        className="btn-secondary text-xs py-1.5 flex items-center gap-1.5"
      >
        {loading === 'bill_of_lading' ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
        Bill of lading
      </button>
    </div>
  )
}
