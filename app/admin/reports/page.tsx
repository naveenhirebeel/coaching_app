'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import AdminBottomNav from '@/components/AdminBottomNav'

type LogEntry = { id: string; date: string; status: string; created_at: string; exit_time: string | null }
type ReportRow = { student_id: string; name: string; parent_telegram_chat_id: string | null; present: number; late: number; absent: number; logs: LogEntry[] }
type Batch = { id: string; name: string; subject: string }

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })
}
function fmtTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })
}

const STATUS_STYLE: Record<string, string> = {
  present: 'bg-green-100 text-green-700',
  late: 'bg-yellow-100 text-yellow-700',
  absent: 'bg-red-100 text-red-700',
}

const PERIOD_OPTIONS = [
  { value: 'week', label: 'Last 7 Days' },
  { value: 'fortnight', label: 'Last 14 Days' },
  { value: 'month', label: 'Last 30 Days' },
]

export default function ReportsPage() {
  const router = useRouter()
  const [report, setReport] = useState<ReportRow[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [filters, setFilters] = useState({ batch_id: '', from: '', to: '' })
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [sendPeriod, setSendPeriod] = useState<Record<string, string>>({})
  const [sendStatus, setSendStatus] = useState<Record<string, 'ok' | 'err'>>({})

  function getToken() { return localStorage.getItem('token') || '' }

  useEffect(() => {
    fetch('/api/batches', { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(r => { if (r.status === 401) router.push('/admin/login'); return r.json() })
      .then(setBatches)
    loadReport()
  }, [])

  async function loadReport() {
    setLoading(true)
    setExpanded({})
    const params = new URLSearchParams()
    if (filters.batch_id) params.set('batch_id', filters.batch_id)
    if (filters.from) params.set('from', filters.from)
    if (filters.to) params.set('to', filters.to)
    const res = await fetch(`/api/reports?${params}`, { headers: { Authorization: `Bearer ${getToken()}` } })
    setReport(await res.json())
    setLoading(false)
  }

  function toggleExpand(i: number) {
    setExpanded(prev => ({ ...prev, [i]: !prev[i] }))
  }

  function downloadCSV() {
    const rows: string[] = ['Student Name,Date,Status,Entry Time,Exit Time']
    for (const row of report) {
      for (const log of row.logs) {
        const date = new Date(log.date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })
        const entry = fmtTime(log.created_at)
        const exit = log.exit_time ? fmtTime(log.exit_time) : ''
        rows.push(`"${row.name}","${date}","${log.status}","${entry}","${exit}"`)
      }
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `attendance-report-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function sendReport(studentId: string) {
    const period = sendPeriod[studentId] || 'week'
    setSendingId(studentId)
    const res = await fetch('/api/reports/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ student_id: studentId, period }),
    })
    setSendingId(null)
    setSendStatus(prev => ({ ...prev, [studentId]: res.ok ? 'ok' : 'err' }))
    setTimeout(() => setSendStatus(prev => { const n = { ...prev }; delete n[studentId]; return n }), 3000)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="Attendance Reports" backHref="/admin/dashboard" homeHref="/admin/dashboard" />

      <main className="p-4 max-w-2xl mx-auto space-y-4 pb-28">
        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
          <h2 className="font-semibold text-gray-800">Filter</h2>
          <select className="w-full border rounded-lg px-3 py-2 text-sm"
            value={filters.batch_id} onChange={e => setFilters({ ...filters, batch_id: e.target.value })}>
            <option value="">All Batches</option>
            {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <div className="flex gap-2">
            <input type="date" className="flex-1 border rounded-lg px-3 py-2 text-sm"
              value={filters.from} onChange={e => setFilters({ ...filters, from: e.target.value })} />
            <input type="date" className="flex-1 border rounded-lg px-3 py-2 text-sm"
              value={filters.to} onChange={e => setFilters({ ...filters, to: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <button onClick={loadReport} className="flex-1 bg-orange-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-orange-600">
              Apply Filter
            </button>
            {report.length > 0 && (
              <button onClick={downloadCSV} className="flex-1 flex items-center justify-center gap-1.5 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download CSV
              </button>
            )}
          </div>
        </div>

        {/* Report */}
        {loading ? (
          <p className="text-center text-gray-400 py-12">Loading...</p>
        ) : report.length === 0 ? (
          <p className="text-center text-gray-400 py-12">No attendance data found.</p>
        ) : (
          <div className="space-y-3">
            {report.map((row, i) => {
              const total = row.present + row.late + row.absent
              const attended = row.present + row.late
              const pct = total > 0 ? Math.round((attended / total) * 100) : 0
              const isOpen = !!expanded[i]
              const hasTelegram = !!row.parent_telegram_chat_id
              const isSending = sendingId === row.student_id
              const status = sendStatus[row.student_id]

              return (
                <div key={i} className="bg-white rounded-xl shadow-sm overflow-hidden">
                  {/* Summary row */}
                  <button
                    onClick={() => toggleExpand(i)}
                    className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition"
                  >
                    <div>
                      <p className="font-semibold text-gray-900">{row.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        <span className="text-green-600">{row.present} present</span>
                        {row.late > 0 && <span className="text-yellow-600 ml-2">{row.late} late</span>}
                        <span className="text-red-600 ml-2">{row.absent} absent</span>
                        <span className="ml-2">· {row.logs.length} entries</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`text-sm font-bold ${pct >= 75 ? 'text-green-600' : 'text-red-600'}`}>{pct}%</span>
                      <span className="text-gray-400 text-xs">{isOpen ? '▲' : '▼'}</span>
                    </div>
                  </button>

                  {/* Send report to parent */}
                  <div className="px-4 pb-3 border-t pt-3 flex items-center gap-2">
                    <select
                      value={sendPeriod[row.student_id] || 'week'}
                      onChange={e => setSendPeriod(prev => ({ ...prev, [row.student_id]: e.target.value }))}
                      className="border rounded-lg px-2 py-1.5 text-xs text-gray-700 bg-white"
                    >
                      {PERIOD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <button
                      onClick={() => sendReport(row.student_id)}
                      disabled={!hasTelegram || isSending}
                      title={hasTelegram ? 'Send report to parent on Telegram' : 'Parent has no Telegram configured'}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition disabled:opacity-50 ${
                        status === 'ok' ? 'bg-green-100 text-green-700' :
                        status === 'err' ? 'bg-red-100 text-red-700' :
                        'bg-blue-50 text-blue-700 hover:bg-blue-100'
                      }`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      {isSending ? 'Sending...' : status === 'ok' ? 'Sent!' : status === 'err' ? 'Failed' : 'Send to Parent'}
                    </button>
                    {!hasTelegram && (
                      <span className="text-xs text-gray-400">No Telegram</span>
                    )}
                  </div>

                  {/* Timeline log */}
                  {isOpen && (
                    <div className="border-t divide-y">
                      {row.logs.map(log => (
                        <div key={log.id} className="px-4 py-3 flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-gray-800">{fmt(log.date)}</p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              Entry: {fmtTime(log.created_at)}
                              {log.exit_time && <span className="ml-2">· Exit: {fmtTime(log.exit_time)}</span>}
                            </p>
                          </div>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${STATUS_STYLE[log.status] || 'bg-gray-100 text-gray-600'}`}>
                            {log.status.toUpperCase()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
      <AdminBottomNav />
    </div>
  )
}
