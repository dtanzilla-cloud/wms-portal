'use client'

import React, { useState, useMemo } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

interface EmailTransaction {
  id: string
  created_at: string
  sender_email: string
  sender_role: string | null
  raw_subject: string | null
  raw_body: string | null
  parsed_action: 'IN' | 'OUT' | null
  parsed_quantity: number | null
  parsed_unit: string | null
  parsed_sku_id: string | null
  parsed_lot_number: string | null
  parsed_po_number: string | null
  parsed_confidence: 'high' | 'low' | 'failed' | null
  parsed_raw_intent: string | null
  status: 'pending' | 'applied' | 'rejected' | 'clarification_needed'
  rejection_reason: string | null
  inventory_movement_id: string | null
  postmark_message_id: string | null
  reply_sent_at: string | null
}

interface Sku {
  id: string
  sku_code: string
  description: string
  customer_id: string
}

interface Props {
  transactions: EmailTransaction[]
  skus: Sku[]
}

interface OverrideForm {
  action: 'IN' | 'OUT'
  quantity: string
  unit: string
  skuId: string
  lotNumber: string
  poNumber: string
}

const PAGE_SIZE = 25

const STATUS_LABELS: Record<string, string> = {
  applied: 'Applied',
  clarification_needed: 'Clarification needed',
  rejected: 'Rejected',
  pending: 'Pending',
}

const STATUS_STYLES: Record<string, string> = {
  applied: 'bg-green-100 text-green-800',
  clarification_needed: 'bg-yellow-100 text-yellow-800',
  rejected: 'bg-red-100 text-red-800',
  pending: 'bg-gray-100 text-gray-700',
}

const CONFIDENCE_STYLES: Record<string, string> = {
  high: 'bg-green-100 text-green-800',
  low: 'bg-yellow-100 text-yellow-800',
  failed: 'bg-red-100 text-red-800',
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-700'}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}

function ConfidenceBadge({ confidence }: { confidence: string | null }) {
  if (!confidence) return <span className="text-gray-300">—</span>
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${CONFIDENCE_STYLES[confidence] ?? 'bg-gray-100 text-gray-700'}`}>
      {confidence}
    </span>
  )
}

function ActionBadge({ action }: { action: string | null }) {
  if (!action) return <span className="text-gray-300">—</span>
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium font-mono ${
      action === 'IN' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'
    }`}>
      {action}
    </span>
  )
}

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'applied', label: 'Applied' },
  { value: 'clarification_needed', label: 'Clarification Needed' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'pending', label: 'Pending' },
]

export default function EmailTransactionsClient({ transactions: initialTransactions, skus }: Props) {
  const [transactions, setTransactions] = useState<EmailTransaction[]>(initialTransactions)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [overrideId, setOverrideId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [overrideError, setOverrideError] = useState<string | null>(null)
  const [overrideForm, setOverrideForm] = useState<OverrideForm>({
    action: 'IN',
    quantity: '',
    unit: '',
    skuId: '',
    lotNumber: '',
    poNumber: '',
  })

  const [filterStatus, setFilterStatus] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [filterSender, setFilterSender] = useState('')
  const [page, setPage] = useState(0)

  const skuMap = useMemo(
    () => Object.fromEntries(skus.map(s => [s.id, s])),
    [skus],
  )

  const filtered = useMemo(() => {
    let result = transactions
    if (filterStatus) result = result.filter(t => t.status === filterStatus)
    if (filterSender) result = result.filter(t => t.sender_email.toLowerCase().includes(filterSender.toLowerCase()))
    if (filterFrom) result = result.filter(t => t.created_at >= filterFrom)
    if (filterTo) result = result.filter(t => t.created_at <= filterTo + 'T23:59:59Z')
    return result
  }, [transactions, filterStatus, filterSender, filterFrom, filterTo])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  function resetPage() { setPage(0) }

  function toggleRow(id: string) {
    if (expandedId === id) {
      setExpandedId(null)
      setOverrideId(null)
    } else {
      setExpandedId(id)
    }
  }

  function openOverride(t: EmailTransaction, e: React.MouseEvent) {
    e.stopPropagation()
    setOverrideError(null)
    setOverrideId(t.id)
    setExpandedId(t.id)
    setOverrideForm({
      action: t.parsed_action ?? 'IN',
      quantity: t.parsed_quantity?.toString() ?? '',
      unit: t.parsed_unit ?? '',
      skuId: t.parsed_sku_id ?? '',
      lotNumber: t.parsed_lot_number ?? '',
      poNumber: t.parsed_po_number ?? '',
    })
  }

  async function submitOverride(id: string) {
    setSubmitting(true)
    setOverrideError(null)
    try {
      const res = await fetch(`/api/email/inbound/${id}/override`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: overrideForm.action,
          quantity: Number(overrideForm.quantity),
          unit: overrideForm.unit || null,
          sku_id: overrideForm.skuId,
          lot_number: overrideForm.lotNumber || null,
          po_number: overrideForm.poNumber || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Override failed')
      setTransactions(prev => prev.map(t => (t.id === id ? { ...t, ...data } : t)))
      setOverrideId(null)
    } catch (err: any) {
      setOverrideError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      {/* Filter bar */}
      <div className="card p-4 mb-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            {STATUS_FILTERS.map(f => (
              <button
                key={f.value}
                onClick={() => { setFilterStatus(f.value); resetPage() }}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  filterStatus === f.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-gray-200" />

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">From</span>
            <input
              type="date"
              value={filterFrom}
              onChange={e => { setFilterFrom(e.target.value); resetPage() }}
              className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <span className="text-xs text-gray-500">to</span>
            <input
              type="date"
              value={filterTo}
              onChange={e => { setFilterTo(e.target.value); resetPage() }}
              className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="h-4 w-px bg-gray-200" />

          <input
            type="text"
            placeholder="Search sender…"
            value={filterSender}
            onChange={e => { setFilterSender(e.target.value); resetPage() }}
            className="text-xs border border-gray-300 rounded px-2 py-1 w-48 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />

          {(filterStatus || filterFrom || filterTo || filterSender) && (
            <button
              onClick={() => { setFilterStatus(''); setFilterFrom(''); setFilterTo(''); setFilterSender(''); resetPage() }}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Clear filters
            </button>
          )}

          <span className="ml-auto text-xs text-gray-400">{filtered.length} records</span>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-3 w-6" />
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 whitespace-nowrap">Date/Time</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Sender</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Action</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Qty</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Unit</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">SKU</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Lot #</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">PO #</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Confidence</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-5 py-12 text-center text-gray-400 text-xs">
                    No email transactions found
                  </td>
                </tr>
              )}

              {paginated.map(t => {
                const isExpanded = expandedId === t.id
                const isOverriding = overrideId === t.id
                const sku = t.parsed_sku_id ? skuMap[t.parsed_sku_id] : null
                const canOverride = t.status === 'clarification_needed' || t.status === 'rejected'

                return (
                  <React.Fragment key={t.id}>
                    <tr
                      onClick={() => toggleRow(t.id)}
                      className={`cursor-pointer transition-colors ${isExpanded ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                    >
                      <td className="px-4 py-3 text-gray-400">
                        {isExpanded
                          ? <ChevronDown size={14} />
                          : <ChevronRight size={14} />}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {new Date(t.created_at).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </td>
                      <td className="px-4 py-3 text-gray-700 text-xs max-w-[160px] truncate" title={t.sender_email}>
                        {t.sender_email}
                      </td>
                      <td className="px-4 py-3">
                        <ActionBadge action={t.parsed_action} />
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700 font-mono text-xs">
                        {t.parsed_quantity ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{t.parsed_unit ?? '—'}</td>
                      <td className="px-4 py-3 text-xs">
                        {sku
                          ? <span className="font-mono text-blue-700">{sku.sku_code}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs font-mono">{t.parsed_lot_number ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs font-mono">{t.parsed_po_number ?? '—'}</td>
                      <td className="px-4 py-3">
                        <ConfidenceBadge confidence={t.parsed_confidence} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={t.status} />
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        {canOverride && (
                          <button
                            onClick={e => openOverride(t, e)}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap"
                          >
                            Override & Apply
                          </button>
                        )}
                        {t.status === 'applied' && t.inventory_movement_id && (
                          <span className="text-xs text-green-700 font-mono">
                            #{t.inventory_movement_id.slice(0, 8)}
                          </span>
                        )}
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr className="bg-blue-50">
                        <td colSpan={12} className="px-6 py-5 border-b border-blue-100">
                          <div className="space-y-4 max-w-4xl">
                            {/* Metadata grid */}
                            <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                              <div>
                                <p className="text-xs font-medium text-gray-500 mb-0.5">Subject</p>
                                <p className="text-xs text-gray-700">{t.raw_subject || '—'}</p>
                              </div>
                              <div>
                                <p className="text-xs font-medium text-gray-500 mb-0.5">Claude's interpretation</p>
                                <p className="text-xs text-gray-700 italic">{t.parsed_raw_intent || '—'}</p>
                              </div>
                              <div>
                                <p className="text-xs font-medium text-gray-500 mb-0.5">Postmark Message ID</p>
                                <p className="text-xs font-mono text-gray-500">{t.postmark_message_id || '—'}</p>
                              </div>
                              {t.inventory_movement_id && (
                                <div>
                                  <p className="text-xs font-medium text-gray-500 mb-0.5">Inventory Movement ID</p>
                                  <p className="text-xs font-mono text-green-700">{t.inventory_movement_id}</p>
                                </div>
                              )}
                              {t.rejection_reason && (
                                <div>
                                  <p className="text-xs font-medium text-gray-500 mb-0.5">Rejection reason</p>
                                  <p className="text-xs text-red-600">{t.rejection_reason}</p>
                                </div>
                              )}
                            </div>

                            {/* Raw body */}
                            <div>
                              <p className="text-xs font-medium text-gray-500 mb-1">Raw email body</p>
                              <pre className="text-xs font-mono bg-gray-900 text-gray-100 rounded-md p-3 whitespace-pre-wrap overflow-x-auto max-h-48">
                                {t.raw_body || '(empty)'}
                              </pre>
                            </div>

                            {/* Override form */}
                            {isOverriding && (
                              <div className="border-t border-blue-200 pt-4">
                                <p className="text-xs font-semibold text-gray-700 mb-3">Override & Apply</p>
                                <div className="flex flex-wrap items-end gap-3">
                                  {/* IN / OUT toggle */}
                                  <div>
                                    <label className="block text-xs text-gray-500 mb-1">Action</label>
                                    <div className="flex rounded-md overflow-hidden border border-gray-300">
                                      {(['IN', 'OUT'] as const).map(a => (
                                        <button
                                          key={a}
                                          type="button"
                                          onClick={() => setOverrideForm(f => ({ ...f, action: a }))}
                                          className={`px-4 py-1.5 text-xs font-medium transition-colors ${
                                            overrideForm.action === a
                                              ? a === 'IN'
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-orange-500 text-white'
                                              : 'bg-white text-gray-600 hover:bg-gray-50'
                                          }`}
                                        >
                                          {a}
                                        </button>
                                      ))}
                                    </div>
                                  </div>

                                  {/* Quantity */}
                                  <div>
                                    <label className="block text-xs text-gray-500 mb-1">Quantity</label>
                                    <input
                                      type="number"
                                      min="1"
                                      value={overrideForm.quantity}
                                      onChange={e => setOverrideForm(f => ({ ...f, quantity: e.target.value }))}
                                      className="w-24 text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                      placeholder="0"
                                    />
                                  </div>

                                  {/* Unit */}
                                  <div>
                                    <label className="block text-xs text-gray-500 mb-1">Unit</label>
                                    <input
                                      type="text"
                                      value={overrideForm.unit}
                                      onChange={e => setOverrideForm(f => ({ ...f, unit: e.target.value }))}
                                      className="w-24 text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                      placeholder="cartons"
                                    />
                                  </div>

                                  {/* SKU dropdown */}
                                  <div>
                                    <label className="block text-xs text-gray-500 mb-1">SKU</label>
                                    <select
                                      value={overrideForm.skuId}
                                      onChange={e => setOverrideForm(f => ({ ...f, skuId: e.target.value }))}
                                      className="text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 max-w-[220px]"
                                    >
                                      <option value="">Select SKU…</option>
                                      {skus.map(s => (
                                        <option key={s.id} value={s.id}>
                                          {s.sku_code} — {s.description}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  {/* Lot # */}
                                  <div>
                                    <label className="block text-xs text-gray-500 mb-1">Lot # (optional)</label>
                                    <input
                                      type="text"
                                      value={overrideForm.lotNumber}
                                      onChange={e => setOverrideForm(f => ({ ...f, lotNumber: e.target.value }))}
                                      className="w-28 text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                      placeholder="LOT-001"
                                    />
                                  </div>

                                  {/* PO # */}
                                  <div>
                                    <label className="block text-xs text-gray-500 mb-1">PO # (optional)</label>
                                    <input
                                      type="text"
                                      value={overrideForm.poNumber}
                                      onChange={e => setOverrideForm(f => ({ ...f, poNumber: e.target.value }))}
                                      className="w-28 text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                      placeholder="PO-001"
                                    />
                                  </div>

                                  {/* Submit / cancel */}
                                  <div className="flex items-center gap-2 ml-1">
                                    <button
                                      type="button"
                                      onClick={() => submitOverride(t.id)}
                                      disabled={submitting || !overrideForm.skuId || !overrideForm.quantity}
                                      className="btn-primary text-xs py-1.5 disabled:opacity-50"
                                    >
                                      {submitting ? 'Applying…' : 'Apply'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => { setOverrideId(null); setOverrideError(null) }}
                                      className="btn-secondary text-xs py-1.5"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>

                                {overrideError && (
                                  <p className="mt-2 text-xs text-red-600">{overrideError}</p>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => p - 1)}
                disabled={page === 0}
                className="btn-secondary text-xs py-1 px-3 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page >= totalPages - 1}
                className="btn-secondary text-xs py-1 px-3 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
