'use client'
import { useState, useRef } from 'react'
import { Upload, FileText, Trash2, Download, Loader2, Paperclip } from 'lucide-react'

interface Invoice {
  id: string
  filename: string
  storage_path: string
  file_size_bytes: number | null
  notes: string | null
  created_at: string
}

interface Props {
  customerId: string
  billingMonth: string   // 'YYYY-MM-01'
  invoices: Invoice[]
  isStaff: boolean
}

function fmtBytes(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function InvoiceSection({ customerId, billingMonth, invoices: initial, isStaff }: Props) {
  const [invoices, setInvoices] = useState<Invoice[]>(initial)
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notes, setNotes] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Only PDF files are accepted')
      return
    }
    setUploading(true)
    setError('')
    const fd = new FormData()
    fd.append('customer_id', customerId)
    fd.append('billing_month', billingMonth)
    fd.append('notes', notes)
    fd.append('file', file)
    try {
      const res = await fetch('/api/charges/invoices', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Upload failed'); return }
      setInvoices(prev => [data, ...prev])
      setNotes('')
      if (fileRef.current) fileRef.current.value = ''
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this invoice?')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/charges/invoices?id=${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error || 'Delete failed')
        return
      }
      setInvoices(prev => prev.filter(inv => inv.id !== id))
    } finally {
      setDeletingId(null)
    }
  }

  async function handleDownload(id: string, filename: string) {
    setDownloadingId(id)
    try {
      const res = await fetch(`/api/charges/invoices?id=${id}`)
      const data = await res.json()
      if (!res.ok || !data.url) { setError(data.error || 'Download failed'); return }
      const a = document.createElement('a')
      a.href = data.url
      a.download = filename
      a.target = '_blank'
      a.click()
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <div className="card overflow-hidden flex flex-col">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
        <Paperclip size={14} className="text-gray-400" />
        <h2 className="text-sm font-medium text-gray-700">Invoices</h2>
        {invoices.length > 0 && (
          <span className="ml-auto text-xs text-gray-400">{invoices.length}</span>
        )}
      </div>

      {/* Invoice list */}
      <div className="flex-1 divide-y divide-gray-50">
        {invoices.length === 0 && (
          <p className="px-5 py-8 text-sm text-gray-400 text-center">No invoices attached</p>
        )}
        {invoices.map(inv => (
          <div key={inv.id} className="px-5 py-3 flex items-start gap-3">
            <FileText size={15} className="text-blue-400 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{inv.filename}</p>
              <p className="text-xs text-gray-400">
                {fmtBytes(inv.file_size_bytes)}
                {inv.file_size_bytes ? ' · ' : ''}
                {new Date(inv.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
              {inv.notes && <p className="text-xs text-gray-500 mt-0.5 truncate">{inv.notes}</p>}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => handleDownload(inv.id, inv.filename)}
                disabled={downloadingId === inv.id}
                className="p-1.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                title="Download"
              >
                {downloadingId === inv.id
                  ? <Loader2 size={13} className="animate-spin" />
                  : <Download size={13} />}
              </button>
              {isStaff && (
                <button
                  onClick={() => handleDelete(inv.id)}
                  disabled={deletingId === inv.id}
                  className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  title="Remove"
                >
                  {deletingId === inv.id
                    ? <Loader2 size={13} className="animate-spin" />
                    : <Trash2 size={13} />}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Upload section (staff only) */}
      {isStaff && (
        <div className="px-5 py-4 border-t border-gray-100 bg-gray-50">
          {error && (
            <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded mb-3">{error}</p>
          )}
          <input
            type="text"
            placeholder="Notes (optional)"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
          <label className={`flex items-center justify-center gap-2 w-full px-3 py-2 rounded-md border-2 border-dashed text-xs font-medium cursor-pointer transition-colors ${
            uploading
              ? 'border-blue-300 text-blue-400 bg-blue-50 cursor-not-allowed'
              : 'border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50'
          }`}>
            {uploading
              ? <><Loader2 size={13} className="animate-spin" /> Uploading…</>
              : <><Upload size={13} /> Attach PDF invoice</>}
            <input
              ref={fileRef}
              type="file"
              accept=".pdf"
              className="hidden"
              disabled={uploading}
              onChange={handleUpload}
            />
          </label>
        </div>
      )}
    </div>
  )
}
