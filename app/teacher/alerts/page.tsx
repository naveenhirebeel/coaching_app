'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import TeacherBottomNav from '@/components/TeacherBottomNav'

type Batch = { id: string; name: string; subject: string }
type Student = { id: string; name: string; parent_name: string; batch_id: string; parent_telegram_chat_id: string }

const TEMPLATES = [
  { label: 'Holiday', text: 'There will be no class tomorrow due to a holiday.' },
  { label: 'Class Cancelled', text: "Today's class has been cancelled. We apologize for the inconvenience." },
  { label: 'Schedule Change', text: 'Please note there is a change in the class schedule.' },
  { label: 'Exam Reminder', text: 'Reminder: Exam is scheduled for tomorrow. Please come prepared.' },
]

type Mode = 'batch' | 'student'

function AlertsContent() {
  const router = useRouter()
  const params = useSearchParams()
  const [mode, setMode] = useState<Mode>('batch')
  const [batches, setBatches] = useState<Batch[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [batchId, setBatchId] = useState(params.get('batch_id') || '')
  const [studentId, setStudentId] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState('')
  const [error, setError] = useState('')

  function getToken() { return localStorage.getItem('token') || '' }

  useEffect(() => {
    const token = getToken()
    fetch('/api/batches', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => { if (r.status === 401) router.push('/teacher/login'); return r.json() })
      .then(setBatches)
    fetch('/api/students', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(setStudents)
  }, [router])

  const filteredStudents = batchId
    ? students.filter(s => s.batch_id === batchId)
    : students

  function switchMode(m: Mode) {
    setMode(m)
    setResult('')
    setError('')
    setStudentId('')
  }

  async function handleSend() {
    if (!message.trim()) return setError('Please enter a message')
    if (mode === 'student' && !studentId) return setError('Please select a student')
    setLoading(true); setError(''); setResult('')

    const body = mode === 'student'
      ? { student_id: studentId, message }
      : { batch_id: batchId || null, message }

    const res = await fetch('/api/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) return setError(data.error)
    setResult(data.message)
    setMessage('')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="Send Alert" backHref="/teacher/dashboard" homeHref="/teacher/dashboard" />

      <main className="p-4 max-w-xl mx-auto space-y-4 pb-28">
        {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}
        {result && <div className="bg-green-50 text-green-700 text-sm px-4 py-3 rounded-lg">{result}</div>}

        {/* Mode toggle */}
        <div className="bg-white rounded-xl shadow-sm p-1 flex">
          <button
            onClick={() => switchMode('batch')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${mode === 'batch' ? 'bg-orange-500 text-white' : 'text-gray-500 hover:text-gray-700'}`}
          >
            By Batch
          </button>
          <button
            onClick={() => switchMode('student')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${mode === 'student' ? 'bg-orange-500 text-white' : 'text-gray-500 hover:text-gray-700'}`}
          >
            By Student
          </button>
        </div>

        {/* Target selector */}
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
          <label className="block text-sm font-medium text-gray-700">
            {mode === 'batch' ? 'Send To' : 'Select Batch'}
          </label>
          <select className="w-full border rounded-lg px-3 py-2 text-sm"
            value={batchId} onChange={e => { setBatchId(e.target.value); setStudentId('') }}>
            <option value="">{mode === 'batch' ? 'All Batches (everyone)' : 'All Batches'}</option>
            {batches.map(b => <option key={b.id} value={b.id}>{b.name} – {b.subject}</option>)}
          </select>

          {mode === 'student' && (
            <>
              <label className="block text-sm font-medium text-gray-700">Select Student</label>
              <select className="w-full border rounded-lg px-3 py-2 text-sm"
                value={studentId} onChange={e => setStudentId(e.target.value)}>
                <option value="">Choose student</option>
                {filteredStudents.map(s => (
                  <option key={s.id} value={s.id} disabled={!s.parent_telegram_chat_id}>
                    {s.name}{!s.parent_telegram_chat_id ? ' (parent not linked)' : ''}
                  </option>
                ))}
              </select>
              {filteredStudents.length === 0 && batchId && (
                <p className="text-xs text-gray-400">No students in this batch.</p>
              )}
            </>
          )}
        </div>

        {/* Quick templates */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="text-sm font-medium text-gray-700 mb-3">Quick Templates</p>
          <div className="grid grid-cols-2 gap-2">
            {TEMPLATES.map(t => (
              <button key={t.label} onClick={() => setMessage(t.text)}
                className="text-left text-xs border rounded-lg px-3 py-2 hover:bg-gray-50 text-gray-700">
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Message input */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
          <textarea
            className="w-full border rounded-lg px-3 py-2 text-sm min-h-[120px] focus:outline-none focus:ring-2 focus:ring-orange-400"
            placeholder="Type your alert message here..."
            value={message}
            onChange={e => setMessage(e.target.value)}
          />
          <p className="text-xs text-gray-400 mt-1">{message.length} characters</p>
        </div>

        <button
          onClick={handleSend}
          disabled={loading || !message.trim()}
          className="w-full bg-orange-500 text-white py-3 rounded-xl font-semibold hover:bg-orange-600 disabled:opacity-50"
        >
          {loading ? 'Sending...' : mode === 'student' ? 'Send Alert to Parent' : 'Send Alert to Parents'}
        </button>
      </main>
      <TeacherBottomNav />
    </div>
  )
}

export default function AlertsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <AlertsContent />
    </Suspense>
  )
}
