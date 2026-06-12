'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import TeacherBottomNav from '@/components/TeacherBottomNav'
import { sortBatches, type Slot } from '@/lib/sortBatches'

type Student = { id: string; name: string }
type Batch = { id: string; name: string; subject: string; schedule_slots: Slot[]; students: Student[] }
type AttendanceRow = { batch_id: string; status: string; exit_time: string | null }
type ChangePasswordStep = 'phone' | 'otp' | 'set'

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function fmt12(t: string) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${ampm}`
}

function isTodayBatch(slots: Slot[]): boolean {
  const todayDay = DAY_SHORT[new Date().getDay()]
  return slots?.some(s => s.day === todayDay) ?? false
}

function isActiveBatch(slots: Slot[]): boolean {
  const todayDay = DAY_SHORT[new Date().getDay()]
  const now = new Date()
  const nowMins = now.getHours() * 60 + now.getMinutes()
  return slots?.some(s => {
    if (s.day !== todayDay) return false
    const [sh, sm] = s.start.split(':').map(Number)
    const [eh, em] = s.end.split(':').map(Number)
    return nowMins >= sh * 60 + sm && nowMins <= eh * 60 + em
  }) ?? false
}

function batchPriority(
  slots: Slot[],
  rows: AttendanceRow[]
): number {
  const isToday = isTodayBatch(slots)
  const isActive = isActiveBatch(slots)
  const present = rows.filter(r => r.status === 'present' || r.status === 'late')
  const stillInClass = present.filter(r => !r.exit_time).length
  const isCompleted = rows.length > 0 && present.length > 0 && stillInClass === 0

  if (isActive) return 0
  if (isToday && !isCompleted) return 1
  if (!isToday) return 2
  return 3 // completed today
}

export default function TeacherDashboard() {
  const router = useRouter()
  const [batches, setBatches] = useState<Batch[]>([])
  const [teacher, setTeacher] = useState<{ name: string } | null>(null)
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRow[]>([])
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null)
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })

  // Change password state
  const [showChangePw, setShowChangePw] = useState(false)
  const [cpStep, setCpStep] = useState<ChangePasswordStep>('phone')
  const [cpPhone, setCpPhone] = useState('')
  const [cpOtp, setCpOtp] = useState('')
  const [cpEmail, setCpEmail] = useState('')
  const [cpPassword, setCpPassword] = useState('')
  const [cpConfirm, setCpConfirm] = useState('')
  const [cpLoading, setCpLoading] = useState(false)
  const [cpError, setCpError] = useState('')
  const [cpMessage, setCpMessage] = useState('')

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
      setBatches(sortBatches(await bRes.json()))
      if (aRes.ok) setTodayAttendance(await aRes.json())
    })
  }, [router])

  function logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('teacher')
    router.push('/')
  }

  async function cpSendOtp(e: React.FormEvent) {
    e.preventDefault()
    setCpLoading(true); setCpError('')
    const res = await fetch('/api/auth/teacher-set-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: cpPhone }),
    })
    const data = await res.json()
    setCpLoading(false)
    if (!res.ok) return setCpError(data.error)
    setCpMessage(data.message)
    setCpStep('otp')
  }

  async function cpSetPassword(e: React.FormEvent) {
    e.preventDefault()
    if (cpPassword !== cpConfirm) return setCpError('Passwords do not match')
    setCpLoading(true); setCpError('')
    const res = await fetch('/api/auth/teacher-set-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: cpPhone, otp: cpOtp, email: cpEmail, password: cpPassword }),
    })
    const data = await res.json()
    setCpLoading(false)
    if (!res.ok) return setCpError(data.error)
    setCpMessage(data.message)
    setTimeout(() => {
      setShowChangePw(false)
      setCpStep('phone'); setCpPhone(''); setCpOtp(''); setCpEmail(''); setCpPassword(''); setCpConfirm('')
      setCpError(''); setCpMessage('')
    }, 2000)
  }

  function resetChangePw() {
    setShowChangePw(false)
    setCpStep('phone'); setCpPhone(''); setCpOtp(''); setCpEmail(''); setCpPassword(''); setCpConfirm('')
    setCpError(''); setCpMessage('')
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

  function getAttendanceCounts(batchId: string) {
    const rows = todayAttendance.filter(r => r.batch_id === batchId)
    const present = rows.filter(r => r.status === 'present' || r.status === 'late').length
    const absent = rows.filter(r => r.status === 'absent').length
    return { present, absent, total: rows.length }
  }

  function isCompletedBatch(batchId: string): boolean {
    const rows = todayAttendance.filter(r => r.batch_id === batchId)
    if (rows.length === 0) return false
    const present = rows.filter(r => r.status === 'present' || r.status === 'late')
    if (present.length === 0) return false
    return present.every(r => !!r.exit_time)
  }

  const sortedBatches = [...batches].sort((a, b) => {
    const aRows = todayAttendance.filter(r => r.batch_id === a.id)
    const bRows = todayAttendance.filter(r => r.batch_id === b.id)
    return batchPriority(a.schedule_slots ?? [], aRows) - batchPriority(b.schedule_slots ?? [], bRows)
  })

  // Change Password modal
  if (showChangePw) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-xl shadow p-8 w-full max-w-sm">
          <button onClick={resetChangePw} className="text-sm text-gray-400 hover:text-gray-600 mb-4">← Back</button>
          <h1 className="text-xl font-bold text-gray-900 mb-1">Change Password</h1>
          <p className="text-gray-500 text-xs mb-6">Verify via Telegram OTP, then set a new email and password.</p>

          {cpError && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">{cpError}</div>}
          {cpMessage && <div className="bg-green-50 text-green-700 text-sm px-4 py-3 rounded-lg mb-4">{cpMessage}</div>}

          {cpStep === 'phone' && (
            <form onSubmit={cpSendOtp} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="9876543210"
                  value={cpPhone}
                  onChange={e => setCpPhone(e.target.value)}
                  required
                />
              </div>
              <button type="submit" disabled={cpLoading}
                className="w-full bg-green-600 text-white py-2.5 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50">
                {cpLoading ? 'Sending OTP...' : 'Send OTP via Telegram'}
              </button>
            </form>
          )}

          {cpStep === 'otp' && (
            <form onSubmit={e => { e.preventDefault(); setCpStep('set') }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Enter OTP</label>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="000000"
                  value={cpOtp}
                  onChange={e => setCpOtp(e.target.value)}
                  maxLength={6}
                  required
                />
                <p className="text-xs text-gray-400 mt-1">Check your Telegram app for the OTP</p>
              </div>
              <button type="submit"
                className="w-full bg-green-600 text-white py-2.5 rounded-lg font-medium hover:bg-green-700">
                Continue
              </button>
              <button type="button" onClick={() => { setCpStep('phone'); setCpError(''); setCpMessage('') }}
                className="w-full border py-2.5 rounded-lg text-sm text-gray-600">Back</button>
            </form>
          )}

          {cpStep === 'set' && (
            <form onSubmit={cpSetPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <input
                  type="email"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="you@example.com"
                  value={cpEmail}
                  onChange={e => setCpEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <input
                  type="password"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Min. 8 characters"
                  value={cpPassword}
                  onChange={e => setCpPassword(e.target.value)}
                  minLength={8}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                <input
                  type="password"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Re-enter password"
                  value={cpConfirm}
                  onChange={e => setCpConfirm(e.target.value)}
                  required
                />
              </div>
              <button type="submit" disabled={cpLoading}
                className="w-full bg-green-600 text-white py-2.5 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50">
                {cpLoading ? 'Saving...' : 'Save Password'}
              </button>
            </form>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title={teacher?.name || 'Teacher'}
        subtitle="Good morning"
        right={
          <div className="flex items-center gap-3">
            <button onClick={() => setShowChangePw(true)} className="text-sm text-gray-500 hover:underline">Change Password</button>
            <button onClick={logout} className="text-sm text-red-600 hover:underline">Logout</button>
          </div>
        }
      />

      <main className="p-4 max-w-xl mx-auto pb-28">
        <p className="text-sm text-gray-500 mb-4">{today}</p>

        <div className="flex justify-between items-center mb-3">
          <h2 className="font-semibold text-gray-800">Your Batches</h2>
          <Link href="/teacher/alerts"
            className="text-sm bg-orange-500 text-white px-3 py-1.5 rounded-lg hover:bg-orange-600">
            Send Alert
          </Link>
        </div>

        <div className="space-y-3">
          {sortedBatches.map(b => {
            const status = getBatchStatus(b.id)
            const attendanceDone = isAttendanceDone(b.id)
            const todayBatch = isTodayBatch(b.schedule_slots ?? [])
            const activeBatch = isActiveBatch(b.schedule_slots ?? [])
            const completed = isCompletedBatch(b.id)
            const { present, absent } = getAttendanceCounts(b.id)

            return (
              <div key={b.id} className={`rounded-xl shadow-sm p-4 border-l-4 ${
                completed
                  ? 'bg-gray-50 border-l-gray-300'
                  : activeBatch
                  ? 'bg-white border-l-green-500'
                  : todayBatch
                  ? 'bg-white border-l-amber-400'
                  : 'bg-white border-l-transparent'
              }`}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`font-semibold ${completed ? 'text-gray-400' : 'text-gray-900'}`}>{b.name}</p>
                      {completed && (
                        <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                          ✓ Completed
                        </span>
                      )}
                      {activeBatch && !completed && (
                        <span className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
                          Active
                        </span>
                      )}
                    </div>
                    <p className={`text-sm ${completed ? 'text-gray-400' : 'text-gray-500'}`}>{b.subject}</p>
                    {b.schedule_slots?.map((s, i) => (
                      <p key={i} className="text-xs text-gray-400 mt-0.5">{s.day} · {fmt12(s.start)} – {fmt12(s.end)}</p>
                    ))}
                    <button
                      onClick={() => setExpandedBatch(expandedBatch === b.id ? null : b.id)}
                      className={`text-xs font-semibold mt-1.5 ${completed ? 'text-gray-400' : 'text-blue-600'} flex items-center gap-1`}
                    >
                      👥 {b.students?.length ?? 0} Students
                      <span className="text-gray-400">{expandedBatch === b.id ? '▲' : '▼'}</span>
                    </button>
                    {expandedBatch === b.id && (
                      <ul className="mt-2 space-y-1">
                        {b.students?.map(s => (
                          <li key={s.id} className="text-xs text-gray-600 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block shrink-0" />
                            {s.name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {!completed && (
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ml-2 shrink-0 ${
                      attendanceDone ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {attendanceDone ? '✓' : '○'} {status}
                    </span>
                  )}
                </div>

                {/* Present / Absent counts */}
                {todayBatch && (
                  <div className="flex gap-2 mt-2">
                    {attendanceDone ? (
                      <>
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                          completed ? 'bg-gray-100 text-gray-400' : 'bg-green-50 text-green-700'
                        }`}>
                          ✓ {present} Present
                        </span>
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                          completed ? 'bg-gray-100 text-gray-400' : 'bg-red-50 text-red-600'
                        }`}>
                          ✗ {absent} Absent
                        </span>
                      </>
                    ) : activeBatch ? (
                      <span className="text-xs font-medium bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full">
                        ⏳ Attendance Pending
                      </span>
                    ) : null}
                  </div>
                )}

                <div className="flex gap-2 mt-3">
                  <Link
                    href={`/teacher/attendance?batch_id=${b.id}&batch_name=${encodeURIComponent(b.name)}`}
                    className={`flex-1 text-center text-sm py-2 rounded-lg ${
                      completed
                        ? 'bg-gray-100 text-gray-400'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
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
      <TeacherBottomNav />
    </div>
  )
}
