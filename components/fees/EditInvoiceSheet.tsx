'use client'
import { useState } from 'react'
import BottomSheet from '@/components/BottomSheet'
import { FeeInvoice } from './types'

// Edit an invoice's amount + due date. Mounted only while open (key={invoice.id}),
// so useState seeds from the invoice. PATCHes /api/fees; the server recomputes
// status when the amount changes.
export default function EditInvoiceSheet({
  invoice, onClose, onSaved,
}: {
  invoice: FeeInvoice
  onClose: () => void
  onSaved: () => void
}) {
  const [amount, setAmount] = useState(String(invoice.amount))
  const [dueDate, setDueDate] = useState(invoice.due_date ? invoice.due_date.slice(0, 10) : '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function getToken() { return localStorage.getItem('token') || '' }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const res = await fetch('/api/fees', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ id: invoice.id, amount, due_date: dueDate }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) return setError(data.error)
    onSaved()
  }

  return (
    <BottomSheet open onClose={onClose} title="Edit Invoice">
      <form onSubmit={handleSubmit} className="space-y-3">
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div className="bg-gray-50 rounded-lg p-3 text-sm">
          <p className="font-medium text-gray-900">{invoice.students?.name}</p>
          <p className="text-gray-500">{invoice.period_label}{invoice.batches?.name ? ` · ${invoice.batches.name}` : ''}</p>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Amount (₹)</label>
          <input inputMode="numeric" className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Amount (₹)" required
            value={amount} onChange={e => setAmount(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Due date (optional)</label>
          <input type="date" className="w-full min-w-0 appearance-none border rounded-lg px-3 py-2 text-sm"
            value={dueDate} onChange={e => setDueDate(e.target.value)} />
        </div>
        <p className="text-xs text-gray-400">Changing the amount updates the status (e.g. Paid → Partial) automatically.</p>
        <button type="submit" disabled={loading}
          className="w-full bg-indigo-600 text-white py-3 rounded-xl text-sm font-semibold disabled:opacity-50 mt-2">
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </BottomSheet>
  )
}
