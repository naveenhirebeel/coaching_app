'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import AdminBottomNav from '@/components/AdminBottomNav'
import BottomSheet from '@/components/BottomSheet'
import InvoiceCard from '@/components/fees/InvoiceCard'
import RecordPaymentSheet from '@/components/fees/RecordPaymentSheet'
import EditInvoiceSheet from '@/components/fees/EditInvoiceSheet'
import LedgerSheet from '@/components/fees/LedgerSheet'
import { FeeInvoice } from '@/components/fees/types'
import { formatINR, periodLabelFromMonth, type InvoiceStatus } from '@/lib/fees'

type Batch = { id: string; name: string; subject: string; monthly_fee: number | null; teacher_id?: string | null; teachers?: { name: string } | null }
type Student = { id: string; name: string; batch_id: string; batches?: { name: string } }

const ALL = '__all__'
const NONE = '__none__'

function currentMonth() {
  return new Date().toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', timeZone: 'Asia/Kolkata' }).slice(0, 7)
}
function ymOf(dateStr: string | null): string | null {
  return dateStr ? dateStr.slice(0, 7) : null
}

export default function FeesPage() {
  const router = useRouter()
  const [invoices, setInvoices] = useState<FeeInvoice[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [pageLoading, setPageLoading] = useState(true)

  // Filters
  const [monthFilter, setMonthFilter] = useState<string>(currentMonth())
  const [batchFilter, setBatchFilter] = useState('')
  const [teacherFilter, setTeacherFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'' | InvoiceStatus>('')

  // Generate month sheet
  const [showGenerate, setShowGenerate] = useState(false)
  const [genForm, setGenForm] = useState({ all: false, batch_ids: [] as string[], student_ids: [] as string[], period_month: currentMonth(), amount: '', due_date: '' })
  const [studentSearch, setStudentSearch] = useState('')
  const [genLoading, setGenLoading] = useState(false)
  const [genError, setGenError] = useState('')
  const [genMsg, setGenMsg] = useState('')

  // Add charge sheet
  const [showCharge, setShowCharge] = useState(false)
  const [chargeForm, setChargeForm] = useState({ student_id: '', period_label: '', amount: '', due_date: '', notes: '' })
  const [chargeLoading, setChargeLoading] = useState(false)
  const [chargeError, setChargeError] = useState('')

  // Shared sheets
  const [payInvoice, setPayInvoice] = useState<FeeInvoice | null>(null)
  const [editInvoice, setEditInvoice] = useState<FeeInvoice | null>(null)
  const [ledgerInvoice, setLedgerInvoice] = useState<FeeInvoice | null>(null)
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

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [])

  // Teacher options derived from batches (each batch carries teacher_id + teachers.name).
  const teacherOptions = Array.from(
    new Map(batches.filter(b => b.teacher_id).map(b => [b.teacher_id as string, b.teachers?.name || 'Teacher'])).entries()
  )

  // Month options: months present in invoices ∪ current month, newest first.
  const monthSet = new Set<string>([currentMonth()])
  invoices.forEach(i => { const ym = ymOf(i.period_month); if (ym) monthSet.add(ym) })
  const monthOptions = Array.from(monthSet).sort().reverse()

  function matchesMonth(i: FeeInvoice) {
    if (monthFilter === ALL) return true
    if (monthFilter === NONE) return !i.period_month
    return ymOf(i.period_month) === monthFilter
  }

  // Scope filters (month + batch + teacher) drive both the summary and the list;
  // the status filter refines only the list.
  const scopeFiltered = invoices.filter(i =>
    matchesMonth(i) &&
    (!batchFilter || i.batch_id === batchFilter) &&
    (!teacherFilter || i.batches?.teacher_id === teacherFilter)
  )
  const filtered = scopeFiltered.filter(i => !statusFilter || i.status === statusFilter)

  const outstanding = scopeFiltered
    .filter(i => i.status !== 'waived')
    .reduce((sum, i) => sum + (Number(i.amount) - Number(i.amount_paid)), 0)
  const collected = scopeFiltered.reduce((sum, i) => sum + Number(i.amount_paid), 0)

  function openGenerate() {
    setGenForm({ all: false, batch_ids: [], student_ids: [], period_month: currentMonth(), amount: '', due_date: '' })
    setStudentSearch(''); setGenError(''); setGenMsg('')
    setShowGenerate(true)
  }

  function toggleGenBatch(id: string) {
    setGenForm(prev => ({ ...prev, batch_ids: prev.batch_ids.includes(id) ? prev.batch_ids.filter(b => b !== id) : [...prev.batch_ids, id] }))
  }
  function toggleGenStudent(id: string) {
    setGenForm(prev => ({ ...prev, student_ids: prev.student_ids.includes(id) ? prev.student_ids.filter(s => s !== id) : [...prev.student_ids, id] }))
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    if (!genForm.all && genForm.batch_ids.length === 0 && genForm.student_ids.length === 0) {
      return setGenError('Select all batches, some batches, or individual students')
    }
    setGenLoading(true); setGenError(''); setGenMsg('')
    const res = await fetch('/api/fees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({
        generate: true,
        all: genForm.all,
        batch_ids: genForm.batch_ids,
        student_ids: genForm.student_ids,
        period_month: genForm.period_month,
        due_date: genForm.due_date,
        amount: genForm.amount || undefined,
      }),
    })
    const data = await res.json()
    setGenLoading(false)
    if (!res.ok) return setGenError(data.error)
    setGenMsg(
      `Created ${data.created} invoice(s)` +
      (data.skipped ? `, skipped ${data.skipped} already invoiced` : '') +
      (data.skippedNoAmount ? `, ${data.skippedNoAmount} skipped (no amount/monthly fee)` : '') + '.'
    )
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

  const genStudentList = students.filter(s => !studentSearch || s.name.toLowerCase().includes(studentSearch.toLowerCase()))

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="Fees" backHref="/admin/dashboard" homeHref="/admin/dashboard" />

      <main className="p-4 max-w-2xl mx-auto pb-28">
        {/* Summary (reflects Month + Batch + Teacher filters) */}
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
          <button onClick={openGenerate}
            className="flex-1 bg-blue-600 text-white text-sm px-3 py-2 rounded-lg hover:bg-blue-700">
            Generate Month
          </button>
          <button onClick={() => { setShowCharge(true); setChargeError('') }}
            className="flex-1 bg-green-600 text-white text-sm px-3 py-2 rounded-lg hover:bg-green-700">
            + Add Charge
          </button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <select className="border rounded-lg px-3 py-2 text-sm bg-white"
            value={monthFilter} onChange={e => setMonthFilter(e.target.value)}>
            <option value={ALL}>All months</option>
            {monthOptions.map(ym => <option key={ym} value={ym}>{periodLabelFromMonth(ym)}</option>)}
            <option value={NONE}>One-off charges</option>
          </select>
          <select className="border rounded-lg px-3 py-2 text-sm bg-white"
            value={teacherFilter} onChange={e => setTeacherFilter(e.target.value)}>
            <option value="">All teachers</option>
            {teacherOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
          <select className="border rounded-lg px-3 py-2 text-sm bg-white"
            value={batchFilter} onChange={e => setBatchFilter(e.target.value)}>
            <option value="">All batches</option>
            {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <select className="border rounded-lg px-3 py-2 text-sm bg-white"
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
          {filtered.map(inv => (
            <InvoiceCard key={inv.id} invoice={inv}
              onRecordPayment={setPayInvoice}
              onEdit={setEditInvoice}
              onLedger={setLedgerInvoice}
              onWaiveClick={setWaivingId}
              waivingId={waivingId}
              actionLoading={actionLoading}
              onConfirmWaive={handleWaive}
              onCancelWaive={() => setWaivingId(null)}
            />
          ))}
          {filtered.length === 0 && (pageLoading
            ? <p className="text-center text-gray-400 py-12">Loading...</p>
            : <p className="text-center text-gray-400 py-12">No fees for this filter. Generate a month or add a charge.</p>
          )}
        </div>
      </main>

      {/* Generate Month Sheet */}
      <BottomSheet open={showGenerate} onClose={() => setShowGenerate(false)} title="Generate Monthly Fees">
        <form onSubmit={handleGenerate} className="space-y-3">
          {genError && <p className="text-red-600 text-sm">{genError}</p>}
          {genMsg && <p className="text-green-600 text-sm">{genMsg}</p>}

          {/* Batch selection */}
          <div className="border rounded-lg divide-y">
            <label className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 cursor-pointer">
              <input type="checkbox" checked={genForm.all}
                onChange={e => setGenForm({ ...genForm, all: e.target.checked })} />
              All batches
            </label>
            {!genForm.all && (
              <div className="max-h-40 overflow-y-auto">
                {batches.map(b => (
                  <label key={b.id} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={genForm.batch_ids.includes(b.id)}
                      onChange={() => toggleGenBatch(b.id)} />
                    <span className="flex-1">{b.name} - {b.subject}</span>
                    {b.monthly_fee != null && <span className="text-xs text-gray-400">₹{b.monthly_fee}</span>}
                  </label>
                ))}
                {batches.length === 0 && <p className="px-3 py-2 text-xs text-gray-400">No batches yet.</p>}
              </div>
            )}
          </div>

          {/* Individual students (optional) */}
          <div className="border rounded-lg">
            <p className="px-3 py-2 text-sm font-medium text-gray-700 border-b">
              Individual students <span className="text-xs text-gray-400 font-normal">(optional{genForm.student_ids.length ? `, ${genForm.student_ids.length} selected` : ''})</span>
            </p>
            <div className="p-2">
              <input className="w-full border rounded-lg px-3 py-1.5 text-sm mb-2" placeholder="Search students…"
                value={studentSearch} onChange={e => setStudentSearch(e.target.value)} />
              <div className="max-h-40 overflow-y-auto">
                {genStudentList.map(s => (
                  <label key={s.id} className="flex items-center gap-2 px-1 py-1.5 text-sm text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={genForm.student_ids.includes(s.id)}
                      onChange={() => toggleGenStudent(s.id)} />
                    <span className="flex-1">{s.name}</span>
                    {s.batches?.name && <span className="text-xs text-gray-400">{s.batches.name}</span>}
                  </label>
                ))}
                {genStudentList.length === 0 && <p className="px-1 py-1.5 text-xs text-gray-400">No matching students.</p>}
              </div>
            </div>
          </div>

          <input type="month" className="w-full border rounded-lg px-3 py-2 text-sm" required
            value={genForm.period_month} onChange={e => setGenForm({ ...genForm, period_month: e.target.value })} />
          <input inputMode="numeric" className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder="Amount per student (₹) — blank uses each batch's monthly fee"
            value={genForm.amount} onChange={e => setGenForm({ ...genForm, amount: e.target.value })} />
          <div>
            <label className="block text-xs text-gray-500 mb-1">Due date (optional)</label>
            <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm"
              value={genForm.due_date} onChange={e => setGenForm({ ...genForm, due_date: e.target.value })} />
          </div>
          <p className="text-xs text-gray-400">Creates one invoice per student across the selected batch(es) and/or students. Students already invoiced for this month are skipped.</p>
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

      {payInvoice && (
        <RecordPaymentSheet key={payInvoice.id} invoice={payInvoice}
          onClose={() => setPayInvoice(null)}
          onSaved={() => { setPayInvoice(null); load() }} />
      )}
      {editInvoice && (
        <EditInvoiceSheet key={editInvoice.id} invoice={editInvoice}
          onClose={() => setEditInvoice(null)}
          onSaved={() => { setEditInvoice(null); load() }} />
      )}
      {ledgerInvoice && (
        <LedgerSheet key={ledgerInvoice.id} invoice={ledgerInvoice}
          onClose={() => setLedgerInvoice(null)} />
      )}

      <AdminBottomNav />
    </div>
  )
}
