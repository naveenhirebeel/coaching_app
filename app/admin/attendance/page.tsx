'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import AdminBottomNav from '@/components/AdminBottomNav'

type Batch = { id: string; name: string; subject: string }
type AttendanceRecord = {
  id: string
  student_id: string
  status: 'present' | 'late' | 'absent'
  date: string
  created_at: string
  marked_at: string | null
  exit_time: string | null
  students: { name: string } | null
}

const STATUS_STYLE: Record<string, string> = {
  present: 'bg-green-100 text-green-700',
  late: 'bg-yellow-100 text-yellow-700',
  absent: 'bg-red-100 text-red-700',
}

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata',
  })
}

function fmtExit(exitStr: string) {
  return new Date(exitStr).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata',
  })
}

export default function AttendanceCorrectionPage() {
  const router = useRouter()
  const [batches, setBatches] = useState<Batch[]>([])
  const [batchId, setBatchId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [actionId, setActionId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<AttendanceRecord | null>(null)

  function getToken() { return localStorage.getItem('token') || '' }

  useEffect(() => {
    fetch('/api/batches', { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(r => { if (r.status === 401) router.push('/admin/login'); return r.json() })
      .then(setBatches)
  }, [router])

  async function load() {
    if (!batchId) return
    setLoading(true)
    const res = await fetch(`/api/attendance?batch_id=${batchId}&date=${date}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
    const data = await res.json()
    setRecords(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [batchId, date])

  async function updateStatus(record: AttendanceRecord, status: 'present' | 'late' | 'absent') {
    setActionId(record.id)
    await fetch('/api/attendance', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ attendance_id: record.id, status }),
    })
    setActionId(null)
    load()
  }

  async function clearExit(record: AttendanceRecord) {
    setActionId(record.id)
    await fetch('/api/attendance', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ attendance_id: record.id, clear_exit: true }),
    })
    setActionId(null)
    load()
  }

  async function deleteRecord(record: AttendanceRecord, moveExitToId?: string) {
    setActionId(record.id)
    // If there's an exit time to preserve, move it to another entry first
    if (moveExitToId && record.exit_time) {
      await fetch('/api/attendance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ attendance_id: moveExitToId, move_exit: record.exit_time }),
      })
    }
    await fetch('/api/attendance', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ attendance_id: record.id }),
    })
    setActionId(null)
    setConfirmDelete(null)
    load()
  }

  // Group records by student for easy viewing
  const byStudent: { [studentId: string]: { name: string; records: AttendanceRecord[] } } = {}
  for (const r of records) {
    if (!byStudent[r.student_id]) {
      byStudent[r.student_id] = { name: r.students?.name || 'Unknown', records: [] }
    }
    byStudent[r.student_id].records.push(r)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="Attendance Correction" backHref="/admin/dashboard" homeHref="/admin/dashboard" />

      <main className="p-4 max-w-2xl mx-auto pb-28 space-y-4">
        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Batch</label>
            <select
              value={batchId}
              onChange={e => setBatchId(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Select a batch...</option>
              {batches.map(b => (
                <option key={b.id} value={b.id}>{b.name} — {b.subject}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>

        {!batchId && (
          <p className="text-center text-gray-400 py-10">Select a batch to view attendance records.</p>
        )}

        {batchId && loading && (
          <p className="text-center text-gray-400 py-10">Loading...</p>
        )}

        {batchId && !loading && records.length === 0 && (
          <p className="text-center text-gray-400 py-10">No attendance records for this batch on this date.</p>
        )}

        {batchId && !loading && (Object.entries(byStudent) as [string, { name: string; records: AttendanceRecord[] }][]).map(([studentId, { name, records: recs }]) => (
          <div key={studentId} className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
              <p className="font-semibold text-gray-900 text-sm">{name}</p>
              {recs.length > 1 && (
                <span className="text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full font-medium">
                  {recs.length} entries — duplicates?
                </span>
              )}
            </div>
            <div className="divide-y">
              {recs.map(r => (
                <div key={r.id} className="px-4 py-3 space-y-3">
                  {/* Record info */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_STYLE[r.status]}`}>
                      {r.status.toUpperCase()}
                    </span>
                    <span className="text-xs text-gray-500">Marked at {fmt(r.marked_at ?? r.created_at)}</span>
                    {r.exit_time && (
                      <span className="text-xs text-gray-500">· Exit {fmtExit(r.exit_time)}</span>
                    )}
                  </div>

                  {/* Status correction */}
                  <div className="space-y-2">
                    <p className="text-xs text-gray-400 font-medium">Change status</p>
                    <div className="flex gap-2">
                      {(['present', 'late', 'absent'] as const).map(s => (
                        <button
                          key={s}
                          onClick={() => updateStatus(r, s)}
                          disabled={r.status === s || actionId === r.id}
                          className={`flex-1 text-xs py-1.5 rounded-lg font-medium transition disabled:opacity-40 ${
                            r.status === s
                              ? STATUS_STYLE[s] + ' cursor-default'
                              : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          {actionId === r.id && r.status !== s ? '...' : s.charAt(0).toUpperCase() + s.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Exit time + delete row */}
                  <div className="flex items-center gap-2">
                    {r.exit_time && (
                      <button
                        onClick={() => clearExit(r)}
                        disabled={actionId === r.id}
                        className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Clear Exit Time
                      </button>
                    )}
                    <button
                      onClick={() => setConfirmDelete(r)}
                      disabled={actionId === r.id}
                      className="ml-auto text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      Delete Entry
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </main>

      {/* Delete confirmation */}
      {confirmDelete && (() => {
        const otherEntries = (byStudent[confirmDelete.student_id]?.records || [])
          .filter(r => r.id !== confirmDelete.id)
        const otherEntry = otherEntries[0]
        const hasExit = !!confirmDelete.exit_time
        const canMoveExit = hasExit && !!otherEntry
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900 mb-1">Delete Attendance Entry?</h2>
                <p className="text-sm text-gray-600">
                  <span className="font-medium">{confirmDelete.students?.name}</span> — {confirmDelete.status.toUpperCase()}, marked at {fmt(confirmDelete.marked_at ?? confirmDelete.created_at)}
                </p>
              </div>

              {hasExit && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-sm text-orange-800 space-y-1">
                  <p className="font-semibold">⚠️ This entry has an exit time ({fmtExit(confirmDelete.exit_time!)})</p>
                  {canMoveExit
                    ? <p className="text-xs">You can move the exit time to the other entry ({otherEntry.status.toUpperCase()}, {fmt(otherEntry.marked_at ?? otherEntry.created_at)}) before deleting, so it isn't lost.</p>
                    : <p className="text-xs">Deleting will permanently remove this exit time — there is no other entry to move it to.</p>
                  }
                </div>
              )}

              <div className="flex flex-col gap-2">
                {canMoveExit && (
                  <button
                    onClick={() => deleteRecord(confirmDelete, otherEntry.id)}
                    disabled={actionId === confirmDelete.id}
                    className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
                  >
                    {actionId === confirmDelete.id ? 'Processing...' : `Delete & Move Exit to Other Entry`}
                  </button>
                )}
                <button
                  onClick={() => deleteRecord(confirmDelete)}
                  disabled={actionId === confirmDelete.id}
                  className="w-full py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
                >
                  {actionId === confirmDelete.id ? 'Deleting...' : hasExit ? 'Delete Entry & Exit Time' : 'Delete Entry'}
                </button>
                <button onClick={() => setConfirmDelete(null)}
                  className="w-full py-2.5 rounded-xl border text-sm text-gray-600 hover:bg-gray-50">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      <AdminBottomNav />
    </div>
  )
}
