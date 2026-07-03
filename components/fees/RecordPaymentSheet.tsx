'use client'
import { useState } from 'react'
import BottomSheet from '@/components/BottomSheet'
import { formatINR, PAYMENT_MODES, type PaymentMode } from '@/lib/fees'
import { FeeInvoice } from './types'

// Local "YYYY-MM-DDTHH:MM" for a <input type="datetime-local"> default of now.
function nowLocal() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Mounted only while open (parent renders it conditionally with key={invoice.id}),
// so useState initializers seed fresh defaults from the invoice each time.
export default function RecordPaymentSheet({
  invoice, onClose, onSaved,
}: {
  invoice: FeeInvoice
  onClose: () => void
  onSaved: () => void
}) {
  const balance = Number(invoice.amount) - Number(invoice.amount_paid)
  const [amount, setAmount] = useState(balance > 0 ? String(balance) : '')
  const [mode, setMode] = useState<PaymentMode>('cash')
  const [paidAt, setPaidAt] = useState(nowLocal())
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function getToken() { return localStorage.getItem('token') || '' }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const res = await fetch('/api/fees/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({
        invoice_id: invoice.id,
        amount,
        mode,
        reference,
        note,
        paid_at: paidAt ? new Date(paidAt).toISOString() : undefined,
      }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) return setError(data.error)
    onSaved()
  }

  return (
    <BottomSheet open onClose={onClose} title="Record Payment">
      <form onSubmit={handleSubmit} className="space-y-3">
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div className="bg-gray-50 rounded-lg p-3 text-sm">
          <p className="font-medium text-gray-900">{invoice.students?.name}</p>
          <p className="text-gray-500">{invoice.period_label} · Balance {formatINR(balance)}</p>
        </div>
        <input inputMode="numeric" className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Amount received (₹)" required
          value={amount} onChange={e => setAmount(e.target.value)} />
        <select className="w-full border rounded-lg px-3 py-2 text-sm"
          value={mode} onChange={e => setMode(e.target.value as PaymentMode)}>
          {PAYMENT_MODES.map(m => <option key={m} value={m}>{m.toUpperCase()}</option>)}
        </select>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Received on</label>
          <input type="datetime-local" className="w-full min-w-0 appearance-none border rounded-lg px-3 py-2 text-sm"
            value={paidAt} onChange={e => setPaidAt(e.target.value)} />
        </div>
        <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Reference (UPI ref / cheque no.)"
          value={reference} onChange={e => setReference(e.target.value)} />
        <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Note (optional)"
          value={note} onChange={e => setNote(e.target.value)} />
        <p className="text-xs text-gray-400">Tip: enter a negative amount to reverse/correct an earlier payment.</p>
        <button type="submit" disabled={loading}
          className="w-full bg-green-600 text-white py-3 rounded-xl text-sm font-semibold disabled:opacity-50 mt-2">
          {loading ? 'Saving...' : 'Save Payment'}
        </button>
      </form>
    </BottomSheet>
  )
}
