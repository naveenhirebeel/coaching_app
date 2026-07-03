'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import TeacherBottomNav from '@/components/TeacherBottomNav'
import BottomSheet from '@/components/BottomSheet'
import { formatINR, PAYMENT_MODES, type InvoiceStatus, type PaymentMode } from '@/lib/fees'

type Invoice = {
  id: string
  student_id: string
  batch_id: string | null
  period_label: string
  amount: number
  amount_paid: number
  due_date: string | null
  status: InvoiceStatus
  students?: { name: string }
  batches?: { name: string; subject: string }
}
type Batch = { id: string; name: string }

const STATUS_PILL: Record<InvoiceStatus, string> = {
  pending: 'bg-orange-100 text-orange-700',
  partial: 'bg-amber-100 text-amber-700',
  paid: 'bg-green-100 text-green-700',
  waived: 'bg-gray-100 text-gray-500',
}

export default function TeacherFeesPage() {
  const router = useRouter()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [pageLoading, setPageLoading] = useState(true)
  const [batchFilter, setBatchFilter] = useState('')
  const [onlyDue, setOnlyDue] = useState(true)

  const [payInvoice, setPayInvoice] = useState<Invoice | null>(null)
  const [payForm, setPayForm] = useState({ amount: '', mode: 'cash' as PaymentMode, reference: '', note: '' })
  const [payLoading, setPayLoading] = useState(false)
  const [payError, setPayError] = useState('')

  function getToken() { return localStorage.getItem('token') || '' }

  async function load() {
    const [iRes, bRes] = await Promise.all([
      fetch('/api/fees', { headers: { Authorization: `Bearer ${getToken()}` } }),
      fetch('/api/batches', { headers: { Authorization: `Bearer ${getToken()}` } }),
    ])
    if (iRes.status === 401) return router.push('/teacher/login')
    setInvoices(await iRes.json())
    setBatches((await bRes.json()).map((b: Batch) => ({ id: b.id, name: b.name })))
    setPageLoading(false)
  }

  // Load on mount. setState runs after awaits (not synchronously) — the
  // react-hooks/set-state-in-effect heuristic false-positives on this idiom.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [])

  const filtered = invoices.filter(i =>
    (!batchFilter || i.batch_id === batchFilter) &&
    (!onlyDue || (i.status === 'pending' || i.status === 'partial'))
  )

  function openPayment(inv: Invoice) {
    setPayInvoice(inv)
    const balance = Number(inv.amount) - Number(inv.amount_paid)
    setPayForm({ amount: balance > 0 ? String(balance) : '', mode: 'cash', reference: '', note: '' })
    setPayError('')
  }

  async function handlePayment(e: React.FormEvent) {
    e.preventDefault()
    if (!payInvoice) return
    setPayLoading(true); setPayError('')
    const res = await fetch('/api/fees/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ invoice_id: payInvoice.id, ...payForm }),
    })
    const data = await res.json()
    setPayLoading(false)
    if (!res.ok) return setPayError(data.error)
    setPayInvoice(null)
    load()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="Fees" backHref="/teacher/dashboard" homeHref="/teacher/dashboard" />

      <main className="p-4 max-w-xl mx-auto pb-28">
        <div className="flex gap-2 mb-4">
          <select className="flex-1 border rounded-lg px-3 py-2 text-sm bg-white"
            value={batchFilter} onChange={e => setBatchFilter(e.target.value)}>
            <option value="">All batches</option>
            {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <button onClick={() => setOnlyDue(!onlyDue)}
            className={`text-sm px-3 py-2 rounded-lg border ${onlyDue ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600'}`}>
            {onlyDue ? 'Due only' : 'All'}
          </button>
        </div>

        <div className="space-y-3">
          {filtered.map(inv => {
            const balance = Number(inv.amount) - Number(inv.amount_paid)
            return (
              <div key={inv.id} className="bg-white rounded-xl shadow-sm p-4">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{inv.students?.name || 'Unknown'}</p>
                    <p className="text-sm text-gray-500">{inv.period_label}{inv.batches?.name ? ` · ${inv.batches.name}` : ''}</p>
                    {inv.due_date && <p className="text-xs text-gray-400 mt-0.5">Due {new Date(inv.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ml-2 ${STATUS_PILL[inv.status]}`}>
                    {inv.status}
                  </span>
                </div>
                <div className="flex items-baseline justify-between mt-2 text-sm">
                  <span className="text-gray-500">
                    {formatINR(Number(inv.amount_paid))} <span className="text-gray-400">/ {formatINR(Number(inv.amount))}</span>
                  </span>
                  {inv.status !== 'waived' && balance > 0 && (
                    <span className="font-semibold text-orange-600">{formatINR(balance)} due</span>
                  )}
                </div>
                {inv.status !== 'waived' && inv.status !== 'paid' && (
                  <button onClick={() => openPayment(inv)}
                    className="mt-3 text-xs bg-green-50 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-100 font-medium">
                    Record Payment
                  </button>
                )}
              </div>
            )
          })}
          {filtered.length === 0 && (pageLoading
            ? <p className="text-center text-gray-400 py-12">Loading...</p>
            : <p className="text-center text-gray-400 py-12">No dues to show.</p>
          )}
        </div>
      </main>

      <BottomSheet open={payInvoice !== null} onClose={() => setPayInvoice(null)} title="Record Payment">
        {payInvoice && (
          <form onSubmit={handlePayment} className="space-y-3">
            {payError && <p className="text-red-600 text-sm">{payError}</p>}
            <div className="bg-gray-50 rounded-lg p-3 text-sm">
              <p className="font-medium text-gray-900">{payInvoice.students?.name}</p>
              <p className="text-gray-500">{payInvoice.period_label} · Balance {formatINR(Number(payInvoice.amount) - Number(payInvoice.amount_paid))}</p>
            </div>
            <input inputMode="numeric" className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Amount received (₹)" required
              value={payForm.amount} onChange={e => setPayForm({ ...payForm, amount: e.target.value })} />
            <select className="w-full border rounded-lg px-3 py-2 text-sm"
              value={payForm.mode} onChange={e => setPayForm({ ...payForm, mode: e.target.value as PaymentMode })}>
              {PAYMENT_MODES.map(m => <option key={m} value={m}>{m.toUpperCase()}</option>)}
            </select>
            <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Reference (UPI ref / cheque no.)"
              value={payForm.reference} onChange={e => setPayForm({ ...payForm, reference: e.target.value })} />
            <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Note (optional)"
              value={payForm.note} onChange={e => setPayForm({ ...payForm, note: e.target.value })} />
            <button type="submit" disabled={payLoading}
              className="w-full bg-green-600 text-white py-3 rounded-xl text-sm font-semibold disabled:opacity-50 mt-2">
              {payLoading ? 'Saving...' : 'Save Payment'}
            </button>
          </form>
        )}
      </BottomSheet>

      <TeacherBottomNav />
    </div>
  )
}
