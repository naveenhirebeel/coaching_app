'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'

type Batch = { id: string; name: string; subject: string; schedule: string }
type AttendanceRow = { batch_id: string; status: string; exit_time: string | null }

export default function TeacherDashboard() {
  const router = useRouter()
  const [batches, setBatches] = useState<Batch[]>([])
  const [teacher, setTeacher] = useState<{ name: string } | null>(null)
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRow[]>([])
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })

  function getToken() { return localStorage.getItem('token') || '' }

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return router.push('/teacher/login')
    const t = localStorage.getItem('teacher')
    if (t) setTeacher(JSON.parse(t))

    const todayDate = new Date().toISOString().split('T')[0]
    Promise.all([
      fetch('/api/batches', { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`/api/attendance?date=${todayDate}`, { headers: { Authorization: `Bearer ${token}` } }),
    ]).then(async ([bRes, aRes]) => {
      if (bRes.status === 401) return router.push('/teacher/login')
      setBatches(await bRes.json())
      if (aRes.ok) setTodayAttendance(await aRes.json())
    })
  }, [router])

  function logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('teacher')
    router.push('/')
  }

  function getBatchStatus(batchId: string): string {
    const rows = todayAttendance.filter(r => r.batch_id === batchId)
    if (rows.length === 0) return 'Attendance pending'
    const attended = rows.filter(r => r.status === 'present' || r.status === 'late')
    if (attended.length === 0) return `All absent (${rows.length})`
    const inClass = attended.filter(r => !r.exit_time).length
    if (inClass === 0) return `All exited · ${attended.length} attended`
    return `${inClass} still in class · ${attended.filter(r => r.exit_time).length} exited`
  }

  function isAttendanceDone(batchId: string) {
    return todayAttendance.some(r => r.batch_id === batchId)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title={teacher?.name || 'Teacher'}
        subtitle="Good morning"
        right={<button onClick={logout} className="text-sm text-red-600 hover:underline">Logout</button>}
      />

      <main className="p-4 max-w-xl mx-auto">
        <p className="text-sm text-gray-500 mb-4">{today}</p>

        <div className="flex justify-between items-center mb-3">
          <h2 className="font-semibold text-gray-800">Your Batches</h2>
          <Link href="/teacher/alerts"
            className="text-sm bg-orange-500 text-white px-3 py-1.5 rounded-lg hover:bg-orange-600">
            Send Alert
          </Link>
        </div>

        <div className="space-y-3">
          {batches.map(b => {
            const status = getBatchStatus(b.id)
            const attendanceDone = isAttendanceDone(b.id)
            return (
              <div key={b.id} className="bg-white rounded-xl shadow-sm p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold text-gray-900">{b.name}</p>
                    <p className="text-sm text-gray-500">{b.subject}</p>
                    {b.schedule && <p className="text-xs text-gray-400 mt-0.5">{b.schedule}</p>}
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ml-2 shrink-0 ${
                    attendanceDone ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {attendanceDone ? '✓' : '○'} {status}
                  </span>
                </div>
                <div className="flex gap-2 mt-3">
                  <Link
                    href={`/teacher/attendance?batch_id=${b.id}&batch_name=${encodeURIComponent(b.name)}`}
                    className="flex-1 text-center bg-green-600 text-white text-sm py-2 rounded-lg hover:bg-green-700"
                  >
                    Mark
                  </Link>
                  <Link
                    href={`/teacher/alerts?batch_id=${b.id}`}
                    className="flex-1 text-center bg-orange-500 text-white text-sm py-2 rounded-lg hover:bg-orange-600"
                  >
                    Send Alerts
                  </Link>
                </div>
              </div>
            )
          })}
          {batches.length === 0 && (
            <p className="text-center text-gray-400 py-12">No batches assigned to you yet.</p>
          )}
        </div>
      </main>
    </div>
  )
}
