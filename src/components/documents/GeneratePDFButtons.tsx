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

  function generate(type: 'packing_list' | 'bill_of_lading') {
    setError('')
    setLoading(type)

    // Open the GET endpoint directly and synchronously (inside the click handler,
    // before any async work) so the browser does NOT treat it as a popup.
    // The GET handler streams HTML immediately — no signed-URL expiry, no forced download.
    const url = `/api/pdf?order_id=${encodeURIComponent(orderId)}&type=${type}`
    const win = window.open(url, '_blank')
    if (!win) {
      setError('Popup blocked — please allow popups for this site and try again.')
    }

    // Short delay then refresh so the documents list picks up the new record
    setTimeout(() => {
      onGenerated?.()
      router.refresh()
      setLoading(null)
    }, 1500)
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {error && (
        <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded w-full">{error}</span>
      )}
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
