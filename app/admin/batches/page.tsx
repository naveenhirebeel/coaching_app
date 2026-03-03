'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Batch = { id: string; name: string; subject: string; schedule: string; teachers?: { name: string } }

export default function BatchesPage() {
  const router = useRouter()
  const [batches, setBatches] = useState<Batch[]>([])
  const [teachers, setTeachers] = useState<{ id: string; name: string }[]>([])
  const [form, setForm] = useState({ name: '', subject: '', schedule: '', teacher_id: '' })
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function getToken() { return localStorage.getItem('token') || '' }

  async function load() {
    const res = await fetch('/api/batches', { headers: { Authorization: `Bearer ${getToken()}` } })
    if (res.status === 401) return router.push('/admin/login')
    setBatches(await res.json())
  }

  async function loadTeachers() {
    const res = await fetch('/api/teachers', { headers: { Authorization: `Bearer ${getToken()}` } })
    setTeachers(await res.json())
  }

  useEffect(() => { load(); loadTeachers() }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const res = await fetch('/api/batches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) return setError(data.error)
    setForm({ name: '', subject: '', schedule: '', teacher_id: '' })
    setShowForm(false)
    load()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm px-4 py-4 flex items-center gap-3">
        <Link href="/admin/dashboard" className="text-gray-500 hover:text-gray-900">← Back</Link>
        <h1 className="font-bold text-gray-900">Batches</h1>
      </header>

      <main className="p-4 max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <p className="text-sm text-gray-500">{batches.length} batches</p>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            + Add Batch
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-5 mb-4 space-y-3">
            <h2 className="font-semibold text-gray-900">New Batch</h2>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="Batch name (e.g. Maths Morning A)"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              required
            />
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="Subject (e.g. Mathematics)"
              value={form.subject}
              onChange={e => setForm({ ...form, subject: e.target.value })}
              required
            />
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="Schedule (e.g. Mon/Wed/Fri 9am-11am)"
              value={form.schedule}
              onChange={e => setForm({ ...form, schedule: e.target.value })}
            />
            <select
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={form.teacher_id}
              onChange={e => setForm({ ...form, teacher_id: e.target.value })}
            >
              <option value="">Select Teacher (optional)</option>
              {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <div className="flex gap-2">
              <button type="submit" disabled={loading}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                {loading ? 'Saving...' : 'Save Batch'}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="flex-1 border py-2 rounded-lg text-sm text-gray-600">
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="space-y-3">
          {batches.map(b => (
            <div key={b.id} className="bg-white rounded-xl shadow-sm p-4">
              <p className="font-semibold text-gray-900">{b.name}</p>
              <p className="text-sm text-gray-500">{b.subject}</p>
              {b.schedule && <p className="text-xs text-gray-400 mt-1">{b.schedule}</p>}
              {b.teachers?.name && <p className="text-xs text-blue-600 mt-1">Teacher: {b.teachers.name}</p>}
            </div>
          ))}
          {batches.length === 0 && (
            <p className="text-center text-gray-400 py-12">No batches yet. Add your first batch.</p>
          )}
        </div>
      </main>
    </div>
  )
}
