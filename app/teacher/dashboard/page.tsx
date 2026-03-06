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

  function getBatchState(batchId: string): 'none' | 'pending-exit' | 'done' {
    const batchRows = todayAttendance.filter(r => r.batch_id === batchId)
    if (batchRows.length === 0) return 'none'
    const attended = batchRows.filter(r => r.status === 'present' || r.status === 'late')
    if (attended.length === 0) return 'done' // all absent, nothing to exit
    const pendingExits = attended.filter(r => !r.exit_time)
    return pendingExits.length > 0 ? 'pending-exit' : 'done'
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
            const state = getBatchState(b.id)
            return (
              <div key={b.id} className="bg-white rounded-xl shadow-sm p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{b.name}</p>
                  <p className="text-sm text-gray-500">{b.subject}</p>
                  {b.schedule && <p className="text-xs text-gray-400 mt-0.5">{b.schedule}</p>}
                </div>
                <div className="flex flex-col gap-1.5 ml-3 items-end">
                  {state === 'none' && (
                    <Link
                      href={`/teacher/attendance?batch_id=${b.id}&batch_name=${encodeURIComponent(b.name)}`}
                      className="bg-green-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-green-700 whitespace-nowrap"
                    >
                      Mark
                    </Link>
                  )}
                  {state === 'pending-exit' && (
                    <>
                      <span className="text-xs text-green-600 font-medium">✓ Attendance done</span>
                      <Link
                        href={`/teacher/exit?batch_id=${b.id}&batch_name=${encodeURIComponent(b.name)}`}
                        className="bg-orange-500 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-orange-600 whitespace-nowrap"
                      >
                        Mark Exit
                      </Link>
                    </>
                  )}
                  {state === 'done' && (
                    <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1.5 rounded-lg">✓ Done</span>
                  )}
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
