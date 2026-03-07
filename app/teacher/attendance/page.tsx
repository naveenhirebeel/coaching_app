'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import PageHeader from '@/components/PageHeader'

type Student = { id: string; name: string; parent_name: string }
type MarkedStatus = 'present' | 'late' | 'absent'
type MarkedMap = Record<string, MarkedStatus>   // student_id → status
type SendingMap = Record<string, MarkedStatus>  // student_id → which button is loading
type AttendanceIdMap = Record<string, string>   // student_id → attendance record id
type ExitMap = Record<string, string>           // student_id → exit time string

function AttendanceContent() {
  const router = useRouter()
  const params = useSearchParams()
  const batchId = params.get('batch_id') || ''
  const batchName = params.get('batch_name') || 'Batch'

  const [students, setStudents] = useState<Student[]>([])
  const [marked, setMarked] = useState<MarkedMap>({})
  const [sending, setSending] = useState<SendingMap>({})
  const [attendanceIds, setAttendanceIds] = useState<AttendanceIdMap>({})
  const [exits, setExits] = useState<ExitMap>({})
  const [exitSending, setExitSending] = useState<Record<string, boolean>>({})
  const [notifyPresent, setNotifyPresent] = useState(false)

  function getToken() { return localStorage.getItem('token') || '' }

  useEffect(() => {
    if (!batchId) return
    const today = new Date().toISOString().split('T')[0]
    const token = getToken()

    Promise.all([
      fetch(`/api/students?batch_id=${batchId}`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`/api/attendance?batch_id=${batchId}&date=${today}`, { headers: { Authorization: `Bearer ${token}` } }),
    ]).then(async ([sRes, aRes]) => {
      if (sRes.status === 401) return router.push('/teacher/login')
      const studentData: Student[] = await sRes.json()
      setStudents(studentData)

      if (aRes.ok) {
        const existing: { id: string; student_id: string; status: MarkedStatus; exit_time: string | null }[] = await aRes.json()
        const map: MarkedMap = {}
        const idMap: AttendanceIdMap = {}
        const exitMap: ExitMap = {}
        existing.forEach(r => {
          map[r.student_id] = r.status
          idMap[r.student_id] = r.id
          if (r.exit_time) {
            const t = new Date(r.exit_time)
            exitMap[r.student_id] = t.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })
          }
        })
        setMarked(map)
        setAttendanceIds(idMap)
        setExits(exitMap)
      }
    })
  }, [batchId, router])

  async function mark(studentId: string, status: MarkedStatus) {
    setSending(prev => ({ ...prev, [studentId]: status }))
    const today = new Date().toISOString().split('T')[0]

    const res = await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({
        student_id: studentId,
        batch_id: batchId,
        date: today,
        status,
        notify_present: notifyPresent,
      }),
    })
    const data = await res.json()
    if (data.attendance_id) {
      setAttendanceIds(prev => ({ ...prev, [studentId]: data.attendance_id }))
    }

    setMarked(prev => ({ ...prev, [studentId]: status }))
    setSending(prev => {
      const next = { ...prev }
      delete next[studentId]
      return next
    })
  }

  async function markExit(studentId: string) {
    const attendanceId = attendanceIds[studentId]
    if (!attendanceId) return
    setExitSending(prev => ({ ...prev, [studentId]: true }))

    const res = await fetch('/api/attendance', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ attendance_id: attendanceId }),
    })
    const data = await res.json()

    if (res.ok && data.exit_time) {
      // Reset card to original state after exit
      setMarked(prev => { const next = { ...prev }; delete next[studentId]; return next })
      setAttendanceIds(prev => { const next = { ...prev }; delete next[studentId]; return next })
      setExits(prev => { const next = { ...prev }; delete next[studentId]; return next })
    }
    setExitSending(prev => { const next = { ...prev }; delete next[studentId]; return next })
  }

  const markedCount = Object.keys(marked).length
  const total = students.length

  const BTN: Record<MarkedStatus, { active: string; inactive: string; label: string }> = {
    present: {
      active: 'bg-green-600 text-white',
      inactive: 'border border-green-400 text-green-700 hover:bg-green-50',
      label: 'Present',
    },
    late: {
      active: 'bg-yellow-500 text-white',
      inactive: 'border border-yellow-400 text-yellow-700 hover:bg-yellow-50',
      label: 'Late',
    },
    absent: {
      active: 'bg-red-600 text-white',
      inactive: 'border border-red-400 text-red-700 hover:bg-red-50',
      label: 'Absent',
    },
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title={batchName}
        subtitle={`${markedCount} of ${total} marked`}
        backHref="/teacher/dashboard"
        homeHref="/teacher/dashboard"
      />

      <main className="p-4 max-w-xl mx-auto pb-24 space-y-3">
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer bg-white rounded-xl shadow-sm px-4 py-3">
          <input type="checkbox" checked={notifyPresent}
            onChange={e => setNotifyPresent(e.target.checked)} className="rounded" />
          Notify parents when marked Present
        </label>

        {students.map(s => {
          const currentStatus = marked[s.id]
          const isSending = sending[s.id]
          const exitTime = exits[s.id]
          const isExiting = exitSending[s.id]
          const canExit = (currentStatus === 'present' || currentStatus === 'late') && attendanceIds[s.id]

          return (
            <div key={s.id} className={`bg-white rounded-xl shadow-sm p-4 border-2 transition ${
              currentStatus === 'present' ? 'border-green-300' :
              currentStatus === 'late'    ? 'border-yellow-300' :
              currentStatus === 'absent'  ? 'border-red-300' :
              'border-transparent'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-semibold text-gray-900">{s.name}</p>
                  {s.parent_name && <p className="text-xs text-gray-400">{s.parent_name}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {exitTime && (
                    <span className="text-xs text-gray-400">Exited {exitTime}</span>
                  )}
                  {currentStatus && (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      currentStatus === 'present' ? 'bg-green-100 text-green-700' :
                      currentStatus === 'late'    ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {currentStatus.toUpperCase()}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                {(['present', 'late', 'absent'] as MarkedStatus[]).map(status => {
                  const isActive = currentStatus === status
                  const isLoading = isSending === status
                  const style = BTN[status]
                  return (
                    <button
                      key={status}
                      onClick={() => mark(s.id, status)}
                      disabled={!!isSending}
                      className={`flex-1 text-sm py-2 rounded-lg font-medium transition disabled:opacity-60 ${
                        isActive ? style.active : style.inactive
                      }`}
                    >
                      {isLoading ? '...' : style.label}
                    </button>
                  )
                })}
              </div>
              {canExit && (
                <div className="mt-2">
                  {exitTime ? (
                    <p className="text-center text-xs text-gray-400 py-1">Exit sent at {exitTime}</p>
                  ) : (
                    <button
                      onClick={() => markExit(s.id)}
                      disabled={isExiting}
                      className="w-full text-sm py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition"
                    >
                      {isExiting ? 'Sending...' : 'Send Exit Alert'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {students.length === 0 && (
          <p className="text-center text-gray-400 py-12">No students in this batch.</p>
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
