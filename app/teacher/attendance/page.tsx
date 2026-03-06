'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'

type Student = { id: string; name: string; parent_name: string }
type AttendanceRecord = { student_id: string; status: 'present' | 'late' | 'absent' }

const STATUS_CYCLE: AttendanceRecord['status'][] = ['present', 'late', 'absent']

const STATUS_STYLE = {
  present: { border: 'border-green-300', bg: 'bg-white', badge: 'bg-green-200 text-green-800', label: 'PRESENT' },
  late:    { border: 'border-yellow-300', bg: 'bg-yellow-50', badge: 'bg-yellow-200 text-yellow-800', label: 'LATE' },
  absent:  { border: 'border-red-300', bg: 'bg-red-50', badge: 'bg-red-200 text-red-800', label: 'ABSENT' },
}

function AttendanceContent() {
  const router = useRouter()
  const params = useSearchParams()
  const batchId = params.get('batch_id') || ''
  const batchName = params.get('batch_name') || 'Batch'

  const [students, setStudents] = useState<Student[]>([])
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [notifyPresent, setNotifyPresent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [result, setResult] = useState('')
  const [error, setError] = useState('')

  function getToken() { return localStorage.getItem('token') || '' }

  useEffect(() => {
    if (!batchId) return
    fetch(`/api/students?batch_id=${batchId}`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(r => { if (r.status === 401) router.push('/teacher/login'); return r.json() })
      .then((data: Student[]) => {
        setStudents(data)
        setRecords(data.map(s => ({ student_id: s.id, status: 'present' })))
      })
  }, [batchId, router])

  function cycleStatus(studentId: string) {
    setRecords(prev => prev.map(r => {
      if (r.student_id !== studentId) return r
      const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(r.status) + 1) % STATUS_CYCLE.length]
      return { ...r, status: next }
    }))
  }

  function markAll(status: AttendanceRecord['status']) {
    setRecords(prev => prev.map(r => ({ ...r, status })))
  }

  function getStatus(studentId: string): AttendanceRecord['status'] {
    return records.find(r => r.student_id === studentId)?.status || 'present'
  }

  async function handleSubmit() {
    setLoading(true); setError('')
    const today = new Date().toISOString().split('T')[0]
    const res = await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ batch_id: batchId, date: today, records, notify_present: notifyPresent }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) return setError(data.error)
    setResult(data.message)
    setSubmitted(true)
  }

  const counts = {
    present: records.filter(r => r.status === 'present').length,
    late: records.filter(r => r.status === 'late').length,
    absent: records.filter(r => r.status === 'absent').length,
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-xl shadow p-8 text-center max-w-sm w-full">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Attendance Submitted</h2>
          <p className="text-gray-500 text-sm mb-6">{result}</p>
          <Link href="/teacher/dashboard"
            className="block w-full bg-green-600 text-white py-2.5 rounded-lg font-medium hover:bg-green-700">
            Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title={batchName}
        subtitle={`${counts.present} present · ${counts.late} late · ${counts.absent} absent`}
        backHref="/teacher/dashboard"
        homeHref="/teacher/dashboard"
      />

      <main className="p-4 max-w-xl mx-auto pb-40">
        {/* Bulk actions */}
        <div className="flex gap-2 mb-3">
          <button onClick={() => markAll('present')}
            className="flex-1 text-xs py-2 rounded-lg border-2 border-green-300 text-green-700 bg-white hover:bg-green-50 font-medium">
            ✓ All Present
          </button>
          <button onClick={() => markAll('late')}
            className="flex-1 text-xs py-2 rounded-lg border-2 border-yellow-300 text-yellow-700 bg-white hover:bg-yellow-50 font-medium">
            ⏰ All Late
          </button>
          <button onClick={() => markAll('absent')}
            className="flex-1 text-xs py-2 rounded-lg border-2 border-red-300 text-red-700 bg-white hover:bg-red-50 font-medium">
            ✗ All Absent
          </button>
        </div>

        <p className="text-xs text-gray-400 mb-3">Tap a student card to cycle: Present → Late → Absent</p>

        {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg mb-3">{error}</div>}

        <div className="space-y-2">
          {students.map(s => {
            const status = getStatus(s.id)
            const style = STATUS_STYLE[status]
            return (
              <button
                key={s.id}
                onClick={() => cycleStatus(s.id)}
                className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition ${style.border} ${style.bg}`}
              >
                <div className="text-left">
                  <p className="font-semibold text-gray-900">{s.name}</p>
                  {s.parent_name && <p className="text-xs text-gray-400">{s.parent_name}</p>}
                </div>
                <span className={`text-sm font-bold px-3 py-1 rounded-full ${style.badge}`}>
                  {style.label}
                </span>
              </button>
            )
          })}

          {students.length === 0 && (
            <p className="text-center text-gray-400 py-12">No students in this batch.</p>
          )}
        </div>

        {students.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 space-y-3">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" checked={notifyPresent}
                onChange={e => setNotifyPresent(e.target.checked)} className="rounded" />
              Also notify parents of present students
            </label>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold text-base hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? 'Submitting...' : `Submit (${counts.absent} absent · ${counts.late} late)`}
            </button>
          </div>
        )}
      </main>
    </div>
  )
}

export default function AttendancePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <AttendanceContent />
    </Suspense>
  )
}
