'use client'

import { useRef, useState } from 'react'
import { Paperclip, Send, CheckCircle, X } from 'lucide-react'

interface Props {
  orderNumber: string
}

export default function ConsigneeUploadForm({ orderNumber }: Props) {
  const [senderName, setSenderName] = useState('')
  const [message, setMessage] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? [])
    setFiles(prev => {
      const existing = new Set(prev.map(f => f.name + f.size))
      return [...prev, ...picked.filter(f => !existing.has(f.name + f.size))]
    })
    if (fileRef.current) fileRef.current.value = ''
  }

  function removeFile(idx: number) {
    setFiles(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!files.length && !message.trim()) {
      setError('Please add a message or attach at least one file.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('orderNumber', orderNumber)
      fd.append('senderName', senderName || 'Consignee')
      fd.append('message', message)
      files.forEach(f => fd.append('files', f))

      const res = await fetch('/api/track/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Upload failed')
      setDone(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div style={{
        background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px',
        padding: '24px', marginTop: '16px', textAlign: 'center',
      }}>
        <CheckCircle size={32} color="#16a34a" style={{ margin: '0 auto 12px' }} />
        <p style={{ fontSize: '15px', fontWeight: 600, color: '#1e293b', margin: '0 0 4px' }}>Sent!</p>
        <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>Your message and files have been forwarded to the warehouse team.</p>
      </div>
    )
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', marginTop: '16px', overflow: 'hidden' }}>
      <div style={{ padding: '16px 24px', borderBottom: '1px solid #f1f5f9' }}>
        <h2 style={{ fontSize: '13px', fontWeight: 600, color: '#374151', margin: 0 }}>Reply to warehouse / add attachments</h2>
      </div>
      <form onSubmit={handleSubmit} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Your name (optional)</label>
          <input
            type="text"
            value={senderName}
            onChange={e => setSenderName(e.target.value)}
            placeholder="e.g. John Smith"
            style={{
              width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '6px',
              fontSize: '13px', outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Message (optional)</label>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Any notes, questions, or instructions for the warehouse…"
            rows={3}
            style={{
              width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '6px',
              fontSize: '13px', outline: 'none', resize: 'vertical', boxSizing: 'border-box',
              fontFamily: 'inherit',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '6px' }}>Attachments</label>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px',
              background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px',
              fontSize: '13px', color: '#374151', cursor: 'pointer',
            }}
          >
            <Paperclip size={13} /> Attach files
          </button>
          <input
            ref={fileRef}
            type="file"
            multiple
            onChange={handleFiles}
            style={{ display: 'none' }}
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
          />
          {files.length > 0 && (
            <ul style={{ margin: '8px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {files.map((f, i) => (
                <li key={i} style={{
                  display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px',
                  color: '#374151', background: '#f8fafc', padding: '5px 10px', borderRadius: '4px',
                }}>
                  <Paperclip size={11} color="#94a3b8" />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                  <span style={{ color: '#94a3b8', whiteSpace: 'nowrap' }}>{(f.size / 1024).toFixed(0)} KB</span>
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', color: '#94a3b8' }}
                  >
                    <X size={12} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && (
          <p style={{ fontSize: '13px', color: '#dc2626', background: '#fef2f2', padding: '8px 12px', borderRadius: '6px', margin: 0 }}>
            {error}
          </p>
        )}

        <div>
          <button
            type="submit"
            disabled={submitting}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '9px 20px',
              background: submitting ? '#93c5fd' : '#2563eb', color: '#fff', borderRadius: '6px',
              border: 'none', fontSize: '14px', fontWeight: 500, cursor: submitting ? 'not-allowed' : 'pointer',
            }}
          >
            <Send size={14} />
            {submitting ? 'Sending…' : 'Send to warehouse'}
          </button>
        </div>
      </form>
    </div>
  )
}
