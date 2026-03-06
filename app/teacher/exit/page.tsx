'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import PageHeader from '@/components/PageHeader'

type AttendanceRow = {
  id: string
  student_id: string
  status: 'present' | 'late' | 'absent'
  exit_time: string | null
  students: { name: string }
}

function ExitContent() {
  const router = useRouter()
  const params = useSearchParams()
  const batchId = params.get('batch_id') || ''
  const batchName = params.get('batch_name') || 'Batch'

  const [rows, setRows] = useState<AttendanceRow[]>([])
  const [markingId, setMarkingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function getToken() { return localStorage.getItem('token') || '' }

  async function load() {
    const today = new Date().toISOString().split('T')[0]
    const res = await fetch(`/api/attendance?batch_id=${batchId}&date=${today}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
    if (res.status === 401) return router.push('/teacher/login')
    const data: AttendanceRow[] = await res.json()
    setRows(data.filter(r => r.status === 'present' || r.status === 'late'))
  }

  useEffect(() => { if (batchId) load() }, [batchId])

  async function markExit(attendanceId: string) {
    setMarkingId(attendanceId)
    setLoading(true)
    await fetch('/api/attendance', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ attendance_id: attendanceId }),
    })
    setLoading(false)
    setMarkingId(null)
    load()
  }

  const exited = rows.filter(r => r.exit_time)
  const pending = rows.filter(r => !r.exit_time)

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title={`Exit — ${batchName}`}
        subtitle={`${exited.length} exited · ${pending.length} still in class`}
        backHref="/teacher/dashboard"
        homeHref="/teacher/dashboard"
      />

      <main className="p-4 max-w-xl mx-auto space-y-3">
        {rows.length === 0 && (
          <p className="text-center text-gray-400 py-12">No attendance submitted for today yet.</p>
        )}

        {pending.length > 0 && (
          <>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">In Class</p>
            {pending.map(r => (
              <div key={r.id} className="bg-white rounded-xl shadow-sm p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{r.students?.name}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    r.status === 'late' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                  }`}>
                    {r.status === 'late' ? 'Late' : 'Present'}
                  </span>
                </div>
                <button
                  onClick={() => markExit(r.id)}
                  disabled={loading && markingId === r.id}
                  className="bg-orange-500 text-white text-sm px-4 py-2 rounded-lg hover:bg-orange-600 disabled:opacity-50"
                >
                  {loading && markingId === r.id ? 'Marking...' : 'Mark Exited'}
                </button>
              </div>
            ))}
          </>
        )}

        {exited.length > 0 && (
          <>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mt-4">Exited</p>
            {exited.map(r => {
              const exitIST = r.exit_time
                ? new Date(r.exit_time).toLocaleTimeString('en-IN', {
                    hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata'
                  })
                : ''
              return (
                <div key={r.id} className="bg-white rounded-xl shadow-sm p-4 flex items-center justify-between opacity-70">
                  <p className="font-semibold text-gray-700">{r.students?.name}</p>
                  <p className="text-sm text-gray-500">Left at {exitIST}</p>
                </div>
              )
            })}
          </>
        )}
      </main>
    </div>
  )
}

export default function ExitPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <ExitContent />
    </Suspense>
  )
}
