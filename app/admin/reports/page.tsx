'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/PageHeader'

type LogEntry = { id: string; date: string; status: string; created_at: string; exit_time: string | null }
type ReportRow = { name: string; present: number; late: number; absent: number; logs: LogEntry[] }
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

export default function ReportsPage() {
  const router = useRouter()
  const [report, setReport] = useState<ReportRow[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [filters, setFilters] = useState({ batch_id: '', from: '', to: '' })
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})

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

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="Attendance Reports" backHref="/admin/dashboard" homeHref="/admin/dashboard" />

      <main className="p-4 max-w-2xl mx-auto space-y-4">
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
          <button onClick={loadReport} className="w-full bg-orange-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-orange-600">
            Apply Filter
          </button>
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

              return (
                <div key={i} className="bg-white rounded-xl shadow-sm overflow-hidden">
                  {/* Summary row — tap to expand */}
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
    </div>
  )
}
