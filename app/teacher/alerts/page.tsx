'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Batch = { id: string; name: string; subject: string }

const TEMPLATES = [
  { label: 'Holiday', text: 'There will be no class tomorrow due to a holiday.' },
  { label: 'Class Cancelled', text: "Today's class has been cancelled. We apologize for the inconvenience." },
  { label: 'Schedule Change', text: 'Please note there is a change in the class schedule.' },
  { label: 'Exam Reminder', text: 'Reminder: Exam is scheduled for tomorrow. Please come prepared.' },
]

export default function AlertsPage() {
  const router = useRouter()
  const [batches, setBatches] = useState<Batch[]>([])
  const [batchId, setBatchId] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState('')
  const [error, setError] = useState('')

  function getToken() { return localStorage.getItem('token') || '' }

  useEffect(() => {
    fetch('/api/batches', { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(r => { if (r.status === 401) router.push('/teacher/login'); return r.json() })
      .then(setBatches)
  }, [router])

  async function handleSend() {
    if (!message.trim()) return setError('Please enter a message')
    setLoading(true); setError(''); setResult('')
    const res = await fetch('/api/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ batch_id: batchId || null, message }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) return setError(data.error)
    setResult(data.message)
    setMessage('')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm px-4 py-4 flex items-center gap-3">
        <Link href="/teacher/dashboard" className="text-gray-500 hover:text-gray-900">← Back</Link>
        <h1 className="font-bold text-gray-900">Send Alert</h1>
      </header>

      <main className="p-4 max-w-xl mx-auto space-y-4">
        {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}
        {result && <div className="bg-green-50 text-green-700 text-sm px-4 py-3 rounded-lg">{result}</div>}

        {/* Batch selector */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Send To</label>
          <select className="w-full border rounded-lg px-3 py-2 text-sm"
            value={batchId} onChange={e => setBatchId(e.target.value)}>
            <option value="">All Batches (everyone)</option>
            {batches.map(b => <option key={b.id} value={b.id}>{b.name} - {b.subject}</option>)}
          </select>
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
          {loading ? 'Sending...' : 'Send Alert to Parents'}
        </button>
      </main>
    </div>
  )
}
