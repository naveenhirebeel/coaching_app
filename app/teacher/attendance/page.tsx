'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import PageHeader from '@/components/PageHeader'

type Student = { id: string; name: string; parent_name: string }
type MarkedStatus = 'present' | 'late' | 'absent'
type MarkedMap = Record<string, MarkedStatus>   // student_id → status
type SendingMap = Record<string, MarkedStatus>  // student_id → which button is loading

function AttendanceContent() {
  const router = useRouter()
  const params = useSearchParams()
  const batchId = params.get('batch_id') || ''
  const batchName = params.get('batch_name') || 'Batch'

  const [students, setStudents] = useState<Student[]>([])
  const [marked, setMarked] = useState<MarkedMap>({})
  const [sending, setSending] = useState<SendingMap>({})
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
        const existing: { student_id: string; status: MarkedStatus }[] = await aRes.json()
        const map: MarkedMap = {}
        existing.forEach(r => { map[r.student_id] = r.status })
        setMarked(map)
      }
    })
  }, [batchId, router])

  async function mark(studentId: string, status: MarkedStatus) {
    setSending(prev => ({ ...prev, [studentId]: status }))
    const today = new Date().toISOString().split('T')[0]

    await fetch('/api/attendance', {
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

    setMarked(prev => ({ ...prev, [studentId]: status }))
    setSending(prev => {
      const next = { ...prev }
      delete next[studentId]
      return next
    })
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
