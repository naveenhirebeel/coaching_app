'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Student = { id: string; name: string; parent_name: string; parent_telegram_chat_id: string; batch_id: string; batches?: { name: string } }
type Batch = { id: string; name: string; subject: string }

export default function StudentsPage() {
  const router = useRouter()
  const [students, setStudents] = useState<Student[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [form, setForm] = useState({ name: '', parent_name: '', parent_telegram_chat_id: '', batch_id: '' })
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [testStatus, setTestStatus] = useState<Record<string, { ok: boolean; msg: string }>>({})
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: '', parent_name: '', parent_telegram_chat_id: '', batch_id: '' })
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState('')

  function startEdit(s: Student) {
    setEditingId(s.id)
    setEditForm({ name: s.name, parent_name: s.parent_name || '', parent_telegram_chat_id: s.parent_telegram_chat_id || '', batch_id: s.batch_id || '' })
    setEditError('')
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    setEditLoading(true); setEditError('')
    const res = await fetch('/api/students', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ id: editingId, ...editForm }),
    })
    const data = await res.json()
    setEditLoading(false)
    if (!res.ok) return setEditError(data.error)
    setEditingId(null)
    load()
  }

  async function sendTest(chatId: string, name: string, studentId: string) {
    setTestStatus(prev => ({ ...prev, [studentId]: { ok: false, msg: 'Sending...' } }))
    const res = await fetch('/api/test-telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ chat_id: chatId, name }),
    })
    const data = await res.json()
    setTestStatus(prev => ({ ...prev, [studentId]: { ok: res.ok, msg: res.ok ? data.message : data.error } }))
  }

  function getToken() { return localStorage.getItem('token') || '' }

  async function load() {
    const [sRes, bRes] = await Promise.all([
      fetch('/api/students', { headers: { Authorization: `Bearer ${getToken()}` } }),
      fetch('/api/batches', { headers: { Authorization: `Bearer ${getToken()}` } }),
    ])
    if (sRes.status === 401) return router.push('/admin/login')
    setStudents(await sRes.json())
    setBatches(await bRes.json())
  }

  useEffect(() => { load() }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const res = await fetch('/api/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) return setError(data.error)
    setForm({ name: '', parent_name: '', parent_telegram_chat_id: '', batch_id: '' })
    setShowForm(false)
    load()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm px-4 py-4 flex items-center gap-3">
        <Link href="/admin/dashboard" className="text-gray-500 hover:text-gray-900">← Back</Link>
        <h1 className="font-bold text-gray-900">Students</h1>
      </header>

      <main className="p-4 max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <p className="text-sm text-gray-500">{students.length} students</p>
          <button onClick={() => setShowForm(!showForm)}
            className="bg-green-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-green-700">
            + Add Student
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-5 mb-4 space-y-3">
            <h2 className="font-semibold text-gray-900">New Student</h2>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Student name"
              value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
            <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Parent name"
              value={form.parent_name} onChange={e => setForm({ ...form, parent_name: e.target.value })} />
            <div>
              <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Parent Telegram Chat ID"
                value={form.parent_telegram_chat_id}
                onChange={e => setForm({ ...form, parent_telegram_chat_id: e.target.value })} />
              <p className="text-xs text-gray-400 mt-1">Parent must message your Telegram bot first to get a Chat ID</p>
            </div>
            <select className="w-full border rounded-lg px-3 py-2 text-sm"
              value={form.batch_id} onChange={e => setForm({ ...form, batch_id: e.target.value })} required>
              <option value="">Select Batch</option>
              {batches.map(b => <option key={b.id} value={b.id}>{b.name} - {b.subject}</option>)}
            </select>
            <div className="flex gap-2">
              <button type="submit" disabled={loading}
                className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                {loading ? 'Saving...' : 'Save Student'}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="flex-1 border py-2 rounded-lg text-sm text-gray-600">Cancel</button>
            </div>
          </form>
        )}

        <div className="space-y-3">
          {students.map(s => (
            <div key={s.id} className="bg-white rounded-xl shadow-sm p-4">
              {editingId === s.id ? (
                <form onSubmit={handleEdit} className="space-y-3">
                  {editError && <p className="text-red-600 text-sm">{editError}</p>}
                  <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Student name"
                    value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} required />
                  <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Parent name"
                    value={editForm.parent_name} onChange={e => setEditForm({ ...editForm, parent_name: e.target.value })} />
                  <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Parent Telegram Chat ID"
                    value={editForm.parent_telegram_chat_id} onChange={e => setEditForm({ ...editForm, parent_telegram_chat_id: e.target.value })} />
                  <select className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={editForm.batch_id} onChange={e => setEditForm({ ...editForm, batch_id: e.target.value })} required>
                    <option value="">Select Batch</option>
                    {batches.map(b => <option key={b.id} value={b.id}>{b.name} - {b.subject}</option>)}
                  </select>
                  <div className="flex gap-2">
                    <button type="submit" disabled={editLoading}
                      className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                      {editLoading ? 'Saving...' : 'Save'}
                    </button>
                    <button type="button" onClick={() => setEditingId(null)}
                      className="flex-1 border py-2 rounded-lg text-sm text-gray-600">Cancel</button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="flex items-start justify-between">
                    <p className="font-semibold text-gray-900">{s.name}</p>
                    <button onClick={() => startEdit(s)}
                      className="text-xs text-gray-400 hover:text-green-600 ml-2">Edit</button>
                  </div>
                  {s.parent_name && <p className="text-sm text-gray-500">Parent: {s.parent_name}</p>}
                  {s.batches?.name && <p className="text-xs text-blue-600 mt-1">Batch: {s.batches.name}</p>}
                  <div className="flex items-center justify-between mt-1">
                    <p className={`text-xs ${s.parent_telegram_chat_id ? 'text-green-600' : 'text-orange-500'}`}>
                      {s.parent_telegram_chat_id ? 'Telegram alerts active' : 'No Telegram set up'}
                    </p>
                    {s.parent_telegram_chat_id && (
                      <button onClick={() => sendTest(s.parent_telegram_chat_id, s.parent_name || s.name, s.id)}
                        className="text-xs bg-blue-50 text-blue-600 px-3 py-1 rounded-lg hover:bg-blue-100">
                        Send Test
                      </button>
                    )}
                  </div>
                  {testStatus[s.id] && (
                    <p className={`text-xs mt-1 ${testStatus[s.id].ok ? 'text-green-600' : 'text-red-600'}`}>
                      {testStatus[s.id].msg}
                    </p>
                  )}
                </>
              )}
            </div>
          ))}
          {students.length === 0 && (
            <p className="text-center text-gray-400 py-12">No students yet. Add your first student.</p>
          )}
        </div>
      </main>
    </div>
  )
}
