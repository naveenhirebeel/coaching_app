'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import TeacherBottomNav from '@/components/TeacherBottomNav'
import InvoiceCard from '@/components/fees/InvoiceCard'
import RecordPaymentSheet from '@/components/fees/RecordPaymentSheet'
import EditInvoiceSheet from '@/components/fees/EditInvoiceSheet'
import LedgerSheet from '@/components/fees/LedgerSheet'
import { FeeInvoice } from '@/components/fees/types'
import { formatINR, periodLabelFromMonth, type InvoiceStatus } from '@/lib/fees'

const ALL = '__all__'
const NONE = '__none__'

function currentMonth() {
  return new Date().toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', timeZone: 'Asia/Kolkata' }).slice(0, 7)
}
function ymOf(dateStr: string | null): string | null {
  return dateStr ? dateStr.slice(0, 7) : null
}

export default function TeacherFeesPage() {
  const router = useRouter()
  const [invoices, setInvoices] = useState<FeeInvoice[]>([])
  const [pageLoading, setPageLoading] = useState(true)

  const [monthFilter, setMonthFilter] = useState<string>(currentMonth())
  const [batchFilter, setBatchFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'' | InvoiceStatus>('')

  const [payInvoice, setPayInvoice] = useState<FeeInvoice | null>(null)
  const [editInvoice, setEditInvoice] = useState<FeeInvoice | null>(null)
  const [ledgerInvoice, setLedgerInvoice] = useState<FeeInvoice | null>(null)
  const [waivingId, setWaivingId] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  function getToken() { return localStorage.getItem('token') || '' }

  async function load() {
    const res = await fetch('/api/fees', { headers: { Authorization: `Bearer ${getToken()}` } })
    if (res.status === 401) return router.push('/teacher/login')
    setInvoices(await res.json())
    setPageLoading(false)
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [])

  // Batch + month options derived from the teacher's own (server-scoped) invoices.
  const batchMap = new Map<string, string>()
  invoices.forEach(i => { if (i.batch_id && i.batches?.name) batchMap.set(i.batch_id, i.batches.name) })
  const batchOptions = Array.from(batchMap.entries())

  const monthSet = new Set<string>([currentMonth()])
  invoices.forEach(i => { const ym = ymOf(i.period_month); if (ym) monthSet.add(ym) })
  const monthOptions = Array.from(monthSet).sort().reverse()

  function matchesMonth(i: FeeInvoice) {
    if (monthFilter === ALL) return true
    if (monthFilter === NONE) return !i.period_month
    return ymOf(i.period_month) === monthFilter
  }

  const scopeFiltered = invoices.filter(i => matchesMonth(i) && (!batchFilter || i.batch_id === batchFilter))
  const filtered = scopeFiltered.filter(i => !statusFilter || i.status === statusFilter)

  const outstanding = scopeFiltered
    .filter(i => i.status !== 'waived')
    .reduce((sum, i) => sum + (Number(i.amount) - Number(i.amount_paid)), 0)
  const collected = scopeFiltered.reduce((sum, i) => sum + Number(i.amount_paid), 0)

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

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="Fees" backHref="/teacher/dashboard" homeHref="/teacher/dashboard" />

      <main className="p-4 max-w-xl mx-auto pb-28">
        {/* Summary (reflects Month + Batch filters) */}
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

        {/* Filters */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <select className="border rounded-lg px-3 py-2 text-sm bg-white"
            value={monthFilter} onChange={e => setMonthFilter(e.target.value)}>
            <option value={ALL}>All months</option>
            {monthOptions.map(ym => <option key={ym} value={ym}>{periodLabelFromMonth(ym)}</option>)}
            <option value={NONE}>One-off charges</option>
          </select>
          <select className="border rounded-lg px-3 py-2 text-sm bg-white"
            value={batchFilter} onChange={e => setBatchFilter(e.target.value)}>
            <option value="">All batches</option>
            {batchOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
          <select className="col-span-2 border rounded-lg px-3 py-2 text-sm bg-white"
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
            : <p className="text-center text-gray-400 py-12">No fees to show.</p>
          )}
        </div>
      </main>

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

      <TeacherBottomNav />
    </div>
  )
}
