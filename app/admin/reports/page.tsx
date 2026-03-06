'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/PageHeader'

type ReportRow = { name: string; present: number; absent: number }
type Batch = { id: string; name: string; subject: string }

export default function ReportsPage() {
  const router = useRouter()
  const [report, setReport] = useState<ReportRow[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [filters, setFilters] = useState({ batch_id: '', from: '', to: '' })
  const [loading, setLoading] = useState(false)

  function getToken() { return localStorage.getItem('token') || '' }

  useEffect(() => {
    fetch('/api/batches', { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(r => { if (r.status === 401) router.push('/admin/login'); return r.json() })
      .then(setBatches)
    loadReport()
  }, [])

  async function loadReport() {
    setLoading(true)
    const params = new URLSearchParams()
    if (filters.batch_id) params.set('batch_id', filters.batch_id)
    if (filters.from) params.set('from', filters.from)
    if (filters.to) params.set('to', filters.to)
    const res = await fetch(`/api/reports?${params}`, { headers: { Authorization: `Bearer ${getToken()}` } })
    setReport(await res.json())
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="Attendance Reports" backHref="/admin/dashboard" homeHref="/admin/dashboard" />

      <main className="p-4 max-w-2xl mx-auto">
        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-4 space-y-3">
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

        {/* Report Table */}
        {loading ? (
          <p className="text-center text-gray-400 py-12">Loading...</p>
        ) : report.length === 0 ? (
          <p className="text-center text-gray-400 py-12">No attendance data found.</p>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Student</th>
                  <th className="text-center px-4 py-3 font-medium text-green-600">Present</th>
                  <th className="text-center px-4 py-3 font-medium text-red-600">Absent</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">%</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {report.map((row, i) => {
                  const total = row.present + row.absent
                  const pct = total > 0 ? Math.round((row.present / total) * 100) : 0
                  return (
                    <tr key={i}>
                      <td className="px-4 py-3 font-medium text-gray-900">{row.name}</td>
                      <td className="px-4 py-3 text-center text-green-700">{row.present}</td>
                      <td className="px-4 py-3 text-center text-red-700">{row.absent}</td>
                      <td className={`px-4 py-3 text-center font-medium ${pct >= 75 ? 'text-green-600' : 'text-red-600'}`}>
                        {pct}%
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
