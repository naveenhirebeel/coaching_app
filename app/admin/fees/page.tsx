'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import AdminBottomNav from '@/components/AdminBottomNav'
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
  notes: string | null
  students?: { name: string }
  batches?: { name: string; subject: string }
}
type Batch = { id: string; name: string; subject: string; monthly_fee: number | null }
type Student = { id: string; name: string; batch_id: string }
type Payment = {
  id: string
  amount: number
  mode: string
  reference: string | null
  note: string | null
  paid_at: string
  recorded_by_role: string | null
  fee_invoices?: { period_label: string }
}

const STATUS_PILL: Record<InvoiceStatus, string> = {
  pending: 'bg-orange-100 text-orange-700',
  partial: 'bg-amber-100 text-amber-700',
  paid: 'bg-green-100 text-green-700',
  waived: 'bg-gray-100 text-gray-500',
}

function currentMonth() {
  return new Date().toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', timeZone: 'Asia/Kolkata' }).slice(0, 7)
}

export default function FeesPage() {
  const router = useRouter()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [pageLoading, setPageLoading] = useState(true)
  const [batchFilter, setBatchFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'' | InvoiceStatus>('')

  // Generate month sheet
  const [showGenerate, setShowGenerate] = useState(false)
  const [genForm, setGenForm] = useState({ batch_id: '', period_month: currentMonth(), amount: '', due_date: '' })
  const [genLoading, setGenLoading] = useState(false)
  const [genError, setGenError] = useState('')
  const [genMsg, setGenMsg] = useState('')

  // Add charge sheet
  const [showCharge, setShowCharge] = useState(false)
  const [chargeForm, setChargeForm] = useState({ student_id: '', period_label: '', amount: '', due_date: '', notes: '' })
  const [chargeLoading, setChargeLoading] = useState(false)
  const [chargeError, setChargeError] = useState('')

  // Record payment sheet
  const [payInvoice, setPayInvoice] = useState<Invoice | null>(null)
  const [payForm, setPayForm] = useState({ amount: '', mode: 'cash' as PaymentMode, reference: '', note: '' })
  const [payLoading, setPayLoading] = useState(false)
  const [payError, setPayError] = useState('')

  // Ledger sheet
  const [ledgerFor, setLedgerFor] = useState<Invoice | null>(null)
  const [ledger, setLedger] = useState<Payment[]>([])
  const [ledgerLoading, setLedgerLoading] = useState(false)

  const [waivingId, setWaivingId] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  function getToken() { return localStorage.getItem('token') || '' }

  async function load() {
    const [iRes, bRes, sRes] = await Promise.all([
      fetch('/api/fees', { headers: { Authorization: `Bearer ${getToken()}` } }),
      fetch('/api/batches', { headers: { Authorization: `Bearer ${getToken()}` } }),
      fetch('/api/students', { headers: { Authorization: `Bearer ${getToken()}` } }),
    ])
    if (iRes.status === 401) return router.push('/admin/login')
    setInvoices(await iRes.json())
    setBatches(await bRes.json())
    setStudents(await sRes.json())
    setPageLoading(false)
  }

  // Load on mount. setState runs after awaits (not synchronously) — the
  // react-hooks/set-state-in-effect heuristic false-positives on this idiom.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [])

  const filtered = invoices.filter(i =>
    (!batchFilter || i.batch_id === batchFilter) &&
    (!statusFilter || i.status === statusFilter)
  )

  // Outstanding excludes waived invoices; collected is the sum of all payments.
  const outstanding = invoices
    .filter(i => i.status !== 'waived')
    .reduce((sum, i) => sum + (Number(i.amount) - Number(i.amount_paid)), 0)
  const collected = invoices.reduce((sum, i) => sum + Number(i.amount_paid), 0)

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    setGenLoading(true); setGenError(''); setGenMsg('')
    const res = await fetch('/api/fees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ generate: true, ...genForm, amount: genForm.amount || undefined }),
    })
    const data = await res.json()
    setGenLoading(false)
    if (!res.ok) return setGenError(data.error)
    setGenMsg(`Created ${data.created} invoice(s)${data.skipped ? `, skipped ${data.skipped} already invoiced` : ''}.`)
    load()
  }

  async function handleCharge(e: React.FormEvent) {
    e.preventDefault()
    setChargeLoading(true); setChargeError('')
    const student = students.find(s => s.id === chargeForm.student_id)
    const res = await fetch('/api/fees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ ...chargeForm, batch_id: student?.batch_id || null }),
    })
    const data = await res.json()
    setChargeLoading(false)
    if (!res.ok) return setChargeError(data.error)
    setShowCharge(false)
    setChargeForm({ student_id: '', period_label: '', amount: '', due_date: '', notes: '' })
    load()
  }

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

  async function openLedger(inv: Invoice) {
    setLedgerFor(inv)
    setLedgerLoading(true)
    const res = await fetch(`/api/fees/payments?invoice_id=${inv.id}`, { headers: { Authorization: `Bearer ${getToken()}` } })
    setLedger(res.ok ? await res.json() : [])
    setLedgerLoading(false)
  }

  async function handleWaive(id: string) {
    setActionLoading(true)
    await fetch('/api/fees', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ id, action: 'waive' }),
    })
    setActionLoading(false)
    setWaivingId(null)
    load()
  }

  const selectedGenBatch = batches.find(b => b.id === genForm.batch_id)

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="Fees" backHref="/admin/dashboard" homeHref="/admin/dashboard" />

      <main className="p-4 max-w-2xl mx-auto pb-28">
        {/* Summary */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-xs text-gray-500">Outstanding</p>
            <p className="text-xl font-bold text-orange-600">{formatINR(outstanding)}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-xs text-gray-500">Collected</p>
            <p className="text-xl font-bold text-green-600">{formatINR(collected)}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 mb-4">
          <button onClick={() => { setShowGenerate(true); setGenError(''); setGenMsg('') }}
            className="flex-1 bg-blue-600 text-white text-sm px-3 py-2 rounded-lg hover:bg-blue-700">
            Generate Month
          </button>
          <button onClick={() => { setShowCharge(true); setChargeError('') }}
            className="flex-1 bg-green-600 text-white text-sm px-3 py-2 rounded-lg hover:bg-green-700">
            + Add Charge
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-4">
          <select className="flex-1 border rounded-lg px-3 py-2 text-sm bg-white"
            value={batchFilter} onChange={e => setBatchFilter(e.target.value)}>
            <option value="">All batches</option>
            {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <select className="flex-1 border rounded-lg px-3 py-2 text-sm bg-white"
            value={statusFilter} onChange={e => setStatusFilter(e.target.value as '' | InvoiceStatus)}>
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
            <option value="waived">Waived</option>
          </select>
        </div>

        {/* Invoice list */}
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

                <div className="flex flex-wrap gap-2 mt-3">
                  {inv.status !== 'waived' && inv.status !== 'paid' && (
                    <button onClick={() => openPayment(inv)}
                      className="text-xs bg-green-50 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-100 font-medium">
                      Record Payment
                    </button>
                  )}
                  {Number(inv.amount_paid) !== 0 && (
                    <button onClick={() => openLedger(inv)}
                      className="text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-100">
                      Ledger
                    </button>
                  )}
                  {inv.status !== 'waived' && inv.status !== 'paid' && (
                    <button onClick={() => setWaivingId(waivingId === inv.id ? null : inv.id)}
                      className="text-xs bg-gray-50 text-gray-500 px-3 py-1.5 rounded-lg hover:bg-gray-100">
                      Waive
                    </button>
                  )}
                </div>

                {waivingId === inv.id && (
                  <div className="mt-3 bg-gray-50 rounded-lg p-3 space-y-2">
                    <p className="text-xs text-gray-600">Waive this fee? It will be marked settled with no payment due.</p>
                    <div className="flex gap-2">
                      <button onClick={() => handleWaive(inv.id)} disabled={actionLoading}
                        className="flex-1 bg-gray-700 text-white py-1.5 rounded-lg text-xs font-medium disabled:opacity-50">
                        {actionLoading ? 'Waiving...' : 'Confirm Waive'}
                      </button>
                      <button onClick={() => setWaivingId(null)}
                        className="flex-1 border py-1.5 rounded-lg text-xs text-gray-600">Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          {filtered.length === 0 && (pageLoading
            ? <p className="text-center text-gray-400 py-12">Loading...</p>
            : <p className="text-center text-gray-400 py-12">No fees yet. Generate a month or add a charge.</p>
          )}
        </div>
      </main>

      {/* Generate Month Sheet */}
      <BottomSheet open={showGenerate} onClose={() => setShowGenerate(false)} title="Generate Monthly Fees">
        <form onSubmit={handleGenerate} className="space-y-3">
          {genError && <p className="text-red-600 text-sm">{genError}</p>}
          {genMsg && <p className="text-green-600 text-sm">{genMsg}</p>}
          <select className="w-full border rounded-lg px-3 py-2 text-sm" required
            value={genForm.batch_id} onChange={e => setGenForm({ ...genForm, batch_id: e.target.value })}>
            <option value="">Select Batch</option>
            {batches.map(b => <option key={b.id} value={b.id}>{b.name} - {b.subject}</option>)}
          </select>
          <input type="month" className="w-full border rounded-lg px-3 py-2 text-sm" required
            value={genForm.period_month} onChange={e => setGenForm({ ...genForm, period_month: e.target.value })} />
          <input inputMode="numeric" className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder={selectedGenBatch?.monthly_fee != null ? `Amount (batch default ₹${selectedGenBatch.monthly_fee})` : 'Amount per student (₹)'}
            value={genForm.amount} onChange={e => setGenForm({ ...genForm, amount: e.target.value })} />
          <div>
            <label className="block text-xs text-gray-500 mb-1">Due date (optional)</label>
            <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm"
              value={genForm.due_date} onChange={e => setGenForm({ ...genForm, due_date: e.target.value })} />
          </div>
          <p className="text-xs text-gray-400">Creates one invoice for every student in the batch. Students already invoiced for this month are skipped.</p>
          <button type="submit" disabled={genLoading}
            className="w-full bg-blue-600 text-white py-3 rounded-xl text-sm font-semibold disabled:opacity-50 mt-2">
            {genLoading ? 'Generating...' : 'Generate'}
          </button>
        </form>
      </BottomSheet>

      {/* Add Charge Sheet */}
      <BottomSheet open={showCharge} onClose={() => setShowCharge(false)} title="Add Charge">
        <form onSubmit={handleCharge} className="space-y-3">
          {chargeError && <p className="text-red-600 text-sm">{chargeError}</p>}
          <select className="w-full border rounded-lg px-3 py-2 text-sm" required
            value={chargeForm.student_id} onChange={e => setChargeForm({ ...chargeForm, student_id: e.target.value })}>
            <option value="">Select Student</option>
            {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Description (e.g. Admission Fee, Books)" required
            value={chargeForm.period_label} onChange={e => setChargeForm({ ...chargeForm, period_label: e.target.value })} />
          <input inputMode="numeric" className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Amount (₹)" required
            value={chargeForm.amount} onChange={e => setChargeForm({ ...chargeForm, amount: e.target.value })} />
          <div>
            <label className="block text-xs text-gray-500 mb-1">Due date (optional)</label>
            <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm"
              value={chargeForm.due_date} onChange={e => setChargeForm({ ...chargeForm, due_date: e.target.value })} />
          </div>
          <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Notes (optional)"
            value={chargeForm.notes} onChange={e => setChargeForm({ ...chargeForm, notes: e.target.value })} />
          <button type="submit" disabled={chargeLoading}
            className="w-full bg-green-600 text-white py-3 rounded-xl text-sm font-semibold disabled:opacity-50 mt-2">
            {chargeLoading ? 'Saving...' : 'Add Charge'}
          </button>
        </form>
      </BottomSheet>

      {/* Record Payment Sheet */}
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
            <p className="text-xs text-gray-400">Tip: enter a negative amount to reverse/correct an earlier payment.</p>
            <button type="submit" disabled={payLoading}
              className="w-full bg-green-600 text-white py-3 rounded-xl text-sm font-semibold disabled:opacity-50 mt-2">
              {payLoading ? 'Saving...' : 'Save Payment'}
            </button>
          </form>
        )}
      </BottomSheet>

      {/* Ledger Sheet */}
      <BottomSheet open={ledgerFor !== null} onClose={() => setLedgerFor(null)} title="Payment Ledger">
        {ledgerFor && (
          <div className="space-y-3">
            <div className="bg-gray-50 rounded-lg p-3 text-sm">
              <p className="font-medium text-gray-900">{ledgerFor.students?.name}</p>
              <p className="text-gray-500">{ledgerFor.period_label}</p>
            </div>
            {ledgerLoading ? (
              <p className="text-center text-gray-400 py-6 text-sm">Loading...</p>
            ) : ledger.length === 0 ? (
              <p className="text-center text-gray-400 py-6 text-sm">No payments recorded.</p>
            ) : (
              <ul className="space-y-2">
                {ledger.map(p => (
                  <li key={p.id} className="flex items-center justify-between border-b border-gray-100 pb-2">
                    <div>
                      <p className={`text-sm font-medium ${Number(p.amount) < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                        {formatINR(Number(p.amount))} <span className="text-xs text-gray-400 uppercase">{p.mode}</span>
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(p.paid_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {p.reference ? ` · ${p.reference}` : ''}
                        {p.recorded_by_role ? ` · by ${p.recorded_by_role}` : ''}
                      </p>
                      {p.note && <p className="text-xs text-gray-400">{p.note}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </BottomSheet>

      <AdminBottomNav />
    </div>
  )
}
