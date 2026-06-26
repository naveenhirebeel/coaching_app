'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import TeacherBottomNav from '@/components/TeacherBottomNav'

type Message = {
  id: string
  sent_at: string
  student_name: string
  batch_name: string
  parent_name: string
  message_type: string
  message_content: string
  status: 'sent' | 'delivered' | 'blocked' | 'failed' | 'pending'
  acknowledged_at: string | null
}

const TYPE_LABELS: Record<string, string> = {
  present: 'Present', absent: 'Absent', late: 'Late', exit: 'Exit',
  alert: 'Alert', schedule_change: 'Schedule', report: 'Report',
  today_class_reminder: 'Reminder',
}

const TYPE_STYLE: Record<string, string> = {
  present: 'bg-green-100 text-green-700',
  absent: 'bg-red-100 text-red-700',
  late: 'bg-yellow-100 text-yellow-700',
  exit: 'bg-gray-100 text-gray-700',
  alert: 'bg-orange-100 text-orange-700',
  schedule_change: 'bg-blue-100 text-blue-700',
  report: 'bg-purple-100 text-purple-700',
  today_class_reminder: 'bg-indigo-100 text-indigo-700',
}

function fmtDateTime(s: string) {
  return new Date(s).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    hour12: true, timeZone: 'Asia/Kolkata',
  })
}

function statusBadge(status: Message['status']) {
  if (status === 'delivered' || status === 'sent') return { label: '✓ Delivered', cls: 'bg-green-100 text-green-700' }
  if (status === 'blocked') return { label: '⚠ Blocked', cls: 'bg-amber-100 text-amber-700' }
  if (status === 'failed') return { label: '✗ Failed', cls: 'bg-red-100 text-red-700' }
  return { label: '… Pending', cls: 'bg-gray-100 text-gray-500' }
}

export default function TeacherMessagesPage() {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const token = localStorage.getItem('token') || ''
    const params = new URLSearchParams()
    if (typeFilter) params.set('message_type', typeFilter)
    if (search.trim()) params.set('student_name', search.trim())

    fetch(`/api/teacher/communications?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(async res => {
      if (res.status === 401) return router.push('/teacher/login')
      const data = await res.json()
      if (cancelled) return
      setMessages(Array.isArray(data) ? data : [])
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [typeFilter, search, router])

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="Messages"
        subtitle="Sent to parents"
        backHref="/teacher/dashboard"
        homeHref="/teacher/dashboard"
      />

      <main className="p-4 max-w-xl mx-auto pb-28 space-y-3">
        <div className="bg-white rounded-xl shadow-sm p-3 space-y-2">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search student name…"
            className="w-full text-sm py-2 px-3 rounded-lg border border-gray-300"
          />
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="w-full text-sm py-2 px-3 rounded-lg border border-gray-300 bg-white"
          >
            <option value="">All message types</option>
            {Object.entries(TYPE_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <p className="text-center text-gray-400 py-12">Loading…</p>
        ) : messages.length === 0 ? (
          <p className="text-center text-gray-400 py-12">No messages yet.</p>
        ) : (
          messages.map(m => {
            const badge = statusBadge(m.status)
            const isOpen = expanded === m.id
            return (
              <div key={m.id} className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{m.student_name}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {m.parent_name} · {m.batch_name}
                    </p>
                  </div>
                  <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${TYPE_STYLE[m.message_type] || 'bg-gray-100 text-gray-600'}`}>
                    {TYPE_LABELS[m.message_type] || m.message_type}
                  </span>
                </div>

                <div className="flex items-center flex-wrap gap-2 mt-2">
                  <span className="text-xs text-gray-400">{fmtDateTime(m.sent_at)}</span>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span>
                  {m.acknowledged_at && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">👍 Acked</span>
                  )}
                </div>

                <button
                  onClick={() => setExpanded(isOpen ? null : m.id)}
                  className="mt-2 text-xs text-orange-500 font-medium"
                >
                  {isOpen ? 'Hide message' : 'View message'}
                </button>
                {isOpen && (
                  <div
                    className="mt-2 text-sm text-gray-700 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap break-words"
                    dangerouslySetInnerHTML={{ __html: m.message_content }}
                  />
                )}
              </div>
            )
          })
        )}
      </main>
      <TeacherBottomNav />
    </div>
  )
}
