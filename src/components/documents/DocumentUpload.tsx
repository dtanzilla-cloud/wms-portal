'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, FileText, X, Download, Loader2 } from 'lucide-react'

interface Document {
  id: string
  filename: string
  document_type: string
  file_size_bytes: number | null
  created_at: string
  is_generated: boolean
}

interface Props {
  orderId: string
  documents: Document[]
}

const DOC_TYPES = [
  { value: 'packing_list', label: 'Packing list' },
  { value: 'bill_of_lading', label: 'Bill of lading' },
  { value: 'commercial_invoice', label: 'Commercial invoice' },
  { value: 'other', label: 'Other' },
]

function formatBytes(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function DocumentUpload({ orderId, documents: initialDocs }: Props) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [docs, setDocs] = useState<Document[]>(initialDocs)
  const [uploading, setUploading] = useState(false)
  const [docType, setDocType] = useState('other')
  const [error, setError] = useState('')
  const [downloading, setDownloading] = useState<string | null>(null)

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('order_id', orderId)
      formData.append('document_type', docType)

      const res = await fetch('/api/documents/upload', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error)
      setDocs(prev => [...prev, data.document])
      router.refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleDownload(doc: Document) {
    setDownloading(doc.id)
    try {
      const res = await fetch(`/api/documents/download?id=${doc.id}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      window.open(data.url, '_blank')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div className="card">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText size={15} className="text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-700">Documents</h2>
          <span className="text-xs text-gray-400">({docs.length})</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={docType}
            onChange={e => setDocType(e.target.value)}
            className="text-xs border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <label className={`btn-secondary text-xs py-1.5 flex items-center gap-1.5 cursor-pointer ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
            {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
            {uploading ? 'Uploading…' : 'Upload'}
            <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} accept=".pdf,.xlsx,.xls,.csv,.jpg,.jpeg,.png,.webp" />
          </label>
        </div>
      </div>

      {error && <p className="px-5 py-2 text-xs text-red-600 bg-red-50">{error}</p>}

      {docs.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <Upload size={20} className="mx-auto text-gray-300 mb-2" />
          <p className="text-xs text-gray-400">No documents yet — upload a packing list, BOL, or invoice</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {docs.map(doc => (
            <div key={doc.id} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50">
              <div className="flex items-center gap-2 min-w-0">
                <FileText size={14} className={doc.is_generated ? 'text-purple-500' : 'text-gray-400'} />
                <div className="min-w-0">
                  <p className="text-sm text-gray-800 truncate">{doc.filename}</p>
                  <p className="text-xs text-gray-400">
                    <span className="capitalize">{doc.document_type.replace('_', ' ')}</span>
                    {doc.file_size_bytes ? ` · ${formatBytes(doc.file_size_bytes)}` : ''}
                    {doc.is_generated && <span className="ml-1 text-purple-600">· Generated</span>}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleDownload(doc)}
                disabled={downloading === doc.id}
                className="ml-3 text-gray-400 hover:text-blue-600 transition-colors shrink-0"
                title="Download"
              >
                {downloading === doc.id
                  ? <Loader2 size={14} className="animate-spin" />
                  : <Download size={14} />}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
