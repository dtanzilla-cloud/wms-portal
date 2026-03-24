'use client'
import { useState } from 'react'
import { Mail, CheckCircle, Loader2 } from 'lucide-react'

interface Props {
  consigneeId: string
  contactEmail: string | null
  inviteSentAt: string | null
  inviteAcceptedAt: string | null
}

export default function InviteButton({ consigneeId, contactEmail, inviteSentAt, inviteAcceptedAt }: Props) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  if (inviteAcceptedAt) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-md font-medium">
        <CheckCircle size={13} /> Portal access active
      </span>
    )
  }

  if (status === 'sent') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-md font-medium">
        <CheckCircle size={13} /> Invite sent!
      </span>
    )
  }

  async function send() {
    if (!contactEmail) return
    setStatus('loading')
    setErrorMsg('')
    try {
      const res = await fetch('/api/invites/consignee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consignee_id: consigneeId }),
      })
      const data = await res.json()
      if (!res.ok) { setErrorMsg(data.error ?? 'Failed to send invite'); setStatus('error'); return }
      setStatus('sent')
    } catch (e: any) {
      setErrorMsg(e.message)
      setStatus('error')
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={send}
        disabled={status === 'loading' || !contactEmail}
        title={!contactEmail ? 'Add a contact email first' : inviteSentAt ? `Re-send invite (last sent ${new Date(inviteSentAt).toLocaleDateString()})` : 'Invite to portal'}
        className="flex items-center gap-1.5 text-sm btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {status === 'loading' ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} />}
        {inviteSentAt ? 'Re-send invite' : 'Invite to portal'}
      </button>
      {!contactEmail && <p className="text-xs text-gray-400">No contact email set</p>}
      {status === 'error' && <p className="text-xs text-red-600">{errorMsg}</p>}
    </div>
  )
}
