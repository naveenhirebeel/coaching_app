'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import PageHeader from '@/components/PageHeader'

type Institute = { id: string; name: string }
type Batch = { id: string; name: string; subject: string; schedule_slots: any[]; teachers: { name?: string } | null; created_at: string }
type Teacher = { id: string; name: string; phone: string; telegram_chat_id: string | null; created_at: string }
type Student = { id: string; name: string; parent_name?: string; parent_telegram_chat_id?: string; batch_id?: string; batches?: { name?: string }; created_at: string }
type Report = { student_id: string; name: string; parent_telegram_chat_id: string | null; present: number; late: number; absent: number; logs: any[] }
type Communication = { id: string; sent_at: string; student_name: string; batch_name: string; message_type: string; message_content: string; recipient_telegram_chat_id: string; status: string }
type ActivityLog = { id: string; event_type: string; actor_type: string; entity_name: string; entity_type: string; details: any; created_at: string }

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })
}
function fmtTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })
}
function fmt12(time: string) {
  const [h, m] = time.split(':')
  const hour = parseInt(h, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${m} ${ampm}`
}

const STATUS_STYLE: Record<string, string> = {
  present: 'bg-green-100 text-green-700',
  late: 'bg-yellow-100 text-yellow-700',
  absent: 'bg-red-100 text-red-700',
}

function OverviewContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const instituteIdParam = searchParams.get('institute_id')

  const [institutes, setInstitutes] = useState<Institute[]>([])
  const [selectedInstitute, setSelectedInstitute] = useState<string>('')
  const [tab, setTab] = useState<'batches' | 'teachers' | 'students' | 'reports' | 'communications' | 'audit'>('batches')
  const [loading, setLoading] = useState(false)

  const [batches, setBatches] = useState<Batch[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [reports, setReports] = useState<Report[]>([])
  const [reportFilters, setReportFilters] = useState({ from: '', to: '' })
  const [reportExpanded, setReportExpanded] = useState<Record<number, boolean>>({})
  const [communications, setCommunications] = useState<Communication[]>([])
  const [commFilters, setCommFilters] = useState({ message_type: '', from_date: '', to_date: '', student_name: '' })
  const [commExpanded, setCommExpanded] = useState<Record<string, boolean>>({})
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([])
  const [activityPage, setActivityPage] = useState(1)
  const [activityTotal, setActivityTotal] = useState(0)
  const [activityFilters, setActivityFilters] = useState({ event_type: '', actor_type: '', from_date: '', to_date: '' })

  function getToken() { return localStorage.getItem('sa_token') || '' }

  useEffect(() => {
    fetch('/api/super-admin/institutes/approved', { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(r => { if (r.status === 401) router.push('/super-admin/login'); return r.json() })
      .then(setInstitutes)
      .catch(console.error)
  }, [router])

  useEffect(() => {
    if (instituteIdParam) {
      setSelectedInstitute(instituteIdParam)
    }
  }, [instituteIdParam])

  async function loadTabData() {
    if (!selectedInstitute) return
    setLoading(true)

    try {
      if (tab === 'batches') {
        const res = await fetch(`/api/batches?institute_id=${selectedInstitute}`, { headers: { Authorization: `Bearer ${getToken()}` } })
        setBatches(await res.json())
      } else if (tab === 'teachers') {
        const res = await fetch(`/api/teachers?institute_id=${selectedInstitute}`, { headers: { Authorization: `Bearer ${getToken()}` } })
        setTeachers(await res.json())
      } else if (tab === 'students') {
        const res = await fetch(`/api/students?institute_id=${selectedInstitute}`, { headers: { Authorization: `Bearer ${getToken()}` } })
        setStudents(await res.json())
      } else if (tab === 'reports') {
        const params = new URLSearchParams()
        params.set('institute_id', selectedInstitute)
        if (reportFilters.from) params.set('from', reportFilters.from)
        if (reportFilters.to) params.set('to', reportFilters.to)
        const res = await fetch(`/api/reports?${params}`, { headers: { Authorization: `Bearer ${getToken()}` } })
        setReports(await res.json())
      } else if (tab === 'communications') {
        const params = new URLSearchParams()
        params.set('institute_id', selectedInstitute)
        if (commFilters.message_type) params.set('message_type', commFilters.message_type)
        if (commFilters.from_date) params.set('from_date', commFilters.from_date)
        if (commFilters.to_date) params.set('to_date', commFilters.to_date)
        if (commFilters.student_name) params.set('student_name', commFilters.student_name)
        const res = await fetch(`/api/super-admin/communications?${params}`, { headers: { Authorization: `Bearer ${getToken()}` } })
        setCommunications(await res.json())
      } else if (tab === 'audit') {
        const params = new URLSearchParams()
        params.set('institute_id', selectedInstitute)
        params.set('page', activityPage.toString())
        if (activityFilters.event_type) params.set('event_type', activityFilters.event_type)
        if (activityFilters.actor_type) params.set('actor_type', activityFilters.actor_type)
        if (activityFilters.from_date) params.set('from_date', activityFilters.from_date)
        if (activityFilters.to_date) params.set('to_date', activityFilters.to_date)
        const res = await fetch(`/api/super-admin/activity-logs?${params}`, { headers: { Authorization: `Bearer ${getToken()}` } })
        const data = await res.json()
        setActivityLogs(data.logs || [])
        setActivityTotal(data.total || 0)
      }
    } catch (err) {
      console.error('Load error:', err)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadTabData()
  }, [selectedInstitute, tab, reportFilters, commFilters, activityPage, activityFilters])

  async function downloadReportCSV() {
    const rows: string[] = ['Student Name,Date,Status,Entry Time,Exit Time']
    for (const row of reports) {
      for (const log of row.logs) {
        const date = new Date(log.date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })
        const entry = fmtTime(log.created_at)
        const exit = log.exit_time ? fmtTime(log.exit_time) : ''
        rows.push(`"${row.name}","${date}","${log.status}","${entry}","${exit}"`)
      }
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `oversight-report-${selectedInstitute}-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const selectedInstituteName = institutes.find(i => i.id === selectedInstitute)?.name || ''

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="Institute Oversight" backHref="/super-admin/dashboard" homeHref="/super-admin/dashboard" />

      <main className="p-4 max-w-6xl mx-auto space-y-4">
          {/* Institute Selector */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Institute</label>
            <select
              value={selectedInstitute}
              onChange={e => { setSelectedInstitute(e.target.value); setTab('batches'); setReportExpanded({}); setActivityPage(1); setCommExpanded({}) }}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Choose an institute...</option>
              {institutes.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </div>

          {!selectedInstitute ? (
            <p className="text-center text-gray-400 py-12">Select an institute to view data</p>
          ) : (
            <>
              {/* Tabs */}
              <div className="flex border-b border-gray-200 bg-white rounded-t-xl overflow-x-auto scrollbar-hide">
                {(['batches', 'teachers', 'students', 'reports', 'communications', 'audit'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => { setTab(t); setReportExpanded({}); setActivityPage(1) }}
                    className={`px-3 py-3 text-xs font-medium transition capitalize whitespace-nowrap shrink-0 ${
                      tab === t ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {t === 'communications' ? 'Comms' : t}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="bg-white rounded-b-xl shadow-sm p-4 space-y-4">
                {loading && <p className="text-center text-gray-400 py-8">Loading...</p>}

                {/* BATCHES */}
                {tab === 'batches' && !loading && (
                  <div className="space-y-3">
                    {batches.length === 0 ? (
                      <p className="text-center text-gray-400 py-8">No batches</p>
                    ) : (
                      batches.map(b => (
                        <div key={b.id} className="border rounded-lg p-4 space-y-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-semibold text-gray-900">{b.name}</p>
                              <p className="text-sm text-gray-600">{b.subject}</p>
                            </div>
                          </div>
                          {b.teachers?.name && <p className="text-xs text-blue-600">Teacher: {b.teachers.name}</p>}
                          {b.schedule_slots && b.schedule_slots.length > 0 && (
                            <p className="text-xs text-gray-600">
                              {b.schedule_slots.map((s: any, i: number) => `${s.day} · ${fmt12(s.start)} – ${fmt12(s.end)}`).join(' | ')}
                            </p>
                          )}
                          <p className="text-xs text-gray-500">Created: {fmt(b.created_at)}</p>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* TEACHERS */}
                {tab === 'teachers' && !loading && (
                  <div className="space-y-3">
                    {teachers.length === 0 ? (
                      <p className="text-center text-gray-400 py-8">No teachers</p>
                    ) : (
                      teachers.map(t => (
                        <div key={t.id} className="border rounded-lg p-4 space-y-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-semibold text-gray-900">{t.name}</p>
                              <p className="text-sm text-gray-600">{t.phone}</p>
                            </div>
                            <span className={`text-xs px-2 py-1 rounded-full ${t.telegram_chat_id ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                              {t.telegram_chat_id ? '✓ Telegram' : 'No TG'}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500">Added: {fmt(t.created_at)}</p>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* STUDENTS */}
                {tab === 'students' && !loading && (
                  <div className="space-y-3">
                    {students.length === 0 ? (
                      <p className="text-center text-gray-400 py-8">No students</p>
                    ) : (
                      students.map(s => (
                        <div key={s.id} className="border rounded-lg p-4 space-y-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-semibold text-gray-900">{s.name}</p>
                              {s.parent_name && <p className="text-sm text-gray-600">Parent: {s.parent_name}</p>}
                            </div>
                            <span className={`text-xs px-2 py-1 rounded-full ${s.parent_telegram_chat_id ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                              {s.parent_telegram_chat_id ? '✓ TG' : 'No TG'}
                            </span>
                          </div>
                          {s.batches?.name && <p className="text-xs text-blue-600">Batch: {s.batches.name}</p>}
                          <p className="text-xs text-gray-500">Enrolled: {fmt(s.created_at)}</p>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* REPORTS */}
                {tab === 'reports' && !loading && (
                  <>
                    <div className="flex gap-2 pb-4">
                      <input type="date" value={reportFilters.from} onChange={e => setReportFilters({ ...reportFilters, from: e.target.value })} className="flex-1 border rounded-lg px-3 py-2 text-sm" />
                      <input type="date" value={reportFilters.to} onChange={e => setReportFilters({ ...reportFilters, to: e.target.value })} className="flex-1 border rounded-lg px-3 py-2 text-sm" />
                      {reports.length > 0 && (
                        <button onClick={downloadReportCSV} className="flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          CSV
                        </button>
                      )}
                    </div>
                    <div className="space-y-3">
                      {reports.length === 0 ? (
                        <p className="text-center text-gray-400 py-8">No attendance data</p>
                      ) : (
                        reports.map((row, i) => {
                          const total = row.present + row.late + row.absent
                          const attended = row.present + row.late
                          const pct = total > 0 ? Math.round((attended / total) * 100) : 0
                          const isOpen = !!reportExpanded[i]

                          return (
                            <div key={i} className="border rounded-lg overflow-hidden">
                              <button
                                onClick={() => setReportExpanded(prev => ({ ...prev, [i]: !prev[i] }))}
                                className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition"
                              >
                                <div>
                                  <p className="font-semibold text-gray-900">{row.name}</p>
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    <span className="text-green-600">{row.present} present</span>
                                    {row.late > 0 && <span className="text-yellow-600 ml-2">{row.late} late</span>}
                                    <span className="text-red-600 ml-2">{row.absent} absent</span>
                                  </p>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                  <span className={`text-sm font-bold ${pct >= 75 ? 'text-green-600' : 'text-red-600'}`}>{pct}%</span>
                                  <span className="text-gray-400 text-xs">{isOpen ? '▲' : '▼'}</span>
                                </div>
                              </button>
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
                        })
                      )}
                    </div>
                  </>
                )}

                {/* COMMUNICATIONS */}
                {tab === 'communications' && !loading && (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pb-4">
                      <select value={commFilters.message_type} onChange={e => setCommFilters({ ...commFilters, message_type: e.target.value })} className="border rounded-lg px-3 py-2 text-sm">
                        <option value="">All Types</option>
                        <option value="present">Present</option>
                        <option value="absent">Absent</option>
                        <option value="late">Late</option>
                        <option value="exit">Exit</option>
                      </select>
                      <input type="date" value={commFilters.from_date} onChange={e => setCommFilters({ ...commFilters, from_date: e.target.value })} className="border rounded-lg px-3 py-2 text-sm" />
                      <input type="date" value={commFilters.to_date} onChange={e => setCommFilters({ ...commFilters, to_date: e.target.value })} className="border rounded-lg px-3 py-2 text-sm" />
                      <input type="text" placeholder="Search student..." value={commFilters.student_name} onChange={e => setCommFilters({ ...commFilters, student_name: e.target.value })} className="border rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-100">
                          <tr className="text-left">
                            <th className="px-4 py-2 font-semibold text-gray-700">Time</th>
                            <th className="px-4 py-2 font-semibold text-gray-700">Student</th>
                            <th className="px-4 py-2 font-semibold text-gray-700">Batch</th>
                            <th className="px-4 py-2 font-semibold text-gray-700">Type</th>
                            <th className="px-4 py-2 font-semibold text-gray-700">Status</th>
                            <th className="px-4 py-2 font-semibold text-gray-700">Message</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {communications.length === 0 ? (
                            <tr><td colSpan={6} className="text-center text-gray-400 py-8">No messages</td></tr>
                          ) : (
                            communications.map(c => (
                              <>
                                <tr key={c.id} className="hover:bg-gray-50">
                                  <td className="px-4 py-2 text-xs text-gray-600 whitespace-nowrap">{fmtTime(c.sent_at)}</td>
                                  <td className="px-4 py-2 text-gray-900">{c.student_name}</td>
                                  <td className="px-4 py-2 text-gray-600">{c.batch_name}</td>
                                  <td className="px-4 py-2"><span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded capitalize">{c.message_type}</span></td>
                                  <td className="px-4 py-2">
                                    <span className={`text-xs px-2 py-1 rounded ${c.status === 'sent' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                      {c.status === 'sent' ? '✓ Sent' : '✗ Failed'}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2">
                                    <button
                                      onClick={() => setCommExpanded(prev => ({ ...prev, [c.id]: !prev[c.id] }))}
                                      className="text-xs text-blue-600 hover:underline whitespace-nowrap"
                                    >
                                      {commExpanded[c.id] ? 'Hide ▲' : 'View ▼'}
                                    </button>
                                  </td>
                                </tr>
                                {commExpanded[c.id] && (
                                  <tr key={`${c.id}-msg`} className="bg-blue-50">
                                    <td colSpan={6} className="px-6 py-3">
                                      <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans leading-relaxed border-l-4 border-blue-300 pl-3">
                                        {c.message_content}
                                      </pre>
                                    </td>
                                  </tr>
                                )}
                              </>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                {/* ACTIVITY LOGS */}
                {tab === 'audit' && !loading && (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pb-4">
                      <select value={activityFilters.event_type} onChange={e => { setActivityFilters({ ...activityFilters, event_type: e.target.value }); setActivityPage(1) }} className="border rounded-lg px-3 py-2 text-sm">
                        <option value="">All Events</option>
                        <option value="attendance_marked">Attendance Marked</option>
                        <option value="attendance_exit">Attendance Exit</option>
                        <option value="student_enrolled">Student Enrolled</option>
                        <option value="student_deleted">Student Deleted</option>
                        <option value="teacher_added">Teacher Added</option>
                        <option value="teacher_deleted">Teacher Deleted</option>
                        <option value="batch_created">Batch Created</option>
                        <option value="batch_deleted">Batch Deleted</option>
                      </select>
                      <select value={activityFilters.actor_type} onChange={e => { setActivityFilters({ ...activityFilters, actor_type: e.target.value }); setActivityPage(1) }} className="border rounded-lg px-3 py-2 text-sm">
                        <option value="">All Actors</option>
                        <option value="admin">Admin</option>
                        <option value="teacher">Teacher</option>
                        <option value="system">System</option>
                      </select>
                      <input type="date" value={activityFilters.from_date} onChange={e => { setActivityFilters({ ...activityFilters, from_date: e.target.value }); setActivityPage(1) }} className="border rounded-lg px-3 py-2 text-sm" />
                      <input type="date" value={activityFilters.to_date} onChange={e => { setActivityFilters({ ...activityFilters, to_date: e.target.value }); setActivityPage(1) }} className="border rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-100">
                          <tr className="text-left">
                            <th className="px-4 py-2 font-semibold text-gray-700">Timestamp</th>
                            <th className="px-4 py-2 font-semibold text-gray-700">Event</th>
                            <th className="px-4 py-2 font-semibold text-gray-700">Entity</th>
                            <th className="px-4 py-2 font-semibold text-gray-700">Actor</th>
                            <th className="px-4 py-2 font-semibold text-gray-700">Details</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {activityLogs.length === 0 ? (
                            <tr><td colSpan={5} className="text-center text-gray-400 py-8">No activity logs</td></tr>
                          ) : (
                            activityLogs.map(log => (
                              <tr key={log.id} className="hover:bg-gray-50">
                                <td className="px-4 py-2 text-xs text-gray-600">{fmtTime(log.created_at)}</td>
                                <td className="px-4 py-2 text-gray-900 capitalize">{log.event_type.replace(/_/g, ' ')}</td>
                                <td className="px-4 py-2 text-gray-700">
                                  <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded capitalize">{log.entity_type || 'N/A'}</span>
                                  <p className="text-xs text-gray-600 mt-1">{log.entity_name}</p>
                                </td>
                                <td className="px-4 py-2 text-xs capitalize text-gray-600">{log.actor_type}</td>
                                <td className="px-4 py-2 text-xs text-gray-600 max-w-xs truncate" title={JSON.stringify(log.details || {})}>
                                  {log.details ? Object.entries(log.details).map(([k, v]) => `${k}: ${v}`).join(', ') : '—'}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                    {activityTotal > 50 && (
                      <div className="flex items-center justify-between pt-4">
                        <p className="text-xs text-gray-500">Page {activityPage} of {Math.ceil(activityTotal / 50)}</p>
                        <div className="flex gap-2">
                          <button onClick={() => setActivityPage(p => Math.max(1, p - 1))} disabled={activityPage === 1} className="px-3 py-1 border rounded text-sm disabled:opacity-50">← Prev</button>
                          <button onClick={() => setActivityPage(p => Math.min(Math.ceil(activityTotal / 50), p + 1))} disabled={activityPage * 50 >= activityTotal} className="px-3 py-1 border rounded text-sm disabled:opacity-50">Next →</button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}
      </main>
    </div>
  )
}

export default function SuperAdminOverview() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">Loading...</div>}>
      <OverviewContent />
    </Suspense>
  )
}
