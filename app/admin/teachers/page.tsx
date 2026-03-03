'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Teacher = { id: string; name: string; phone: string; telegram_chat_id: string }

export default function TeachersPage() {
  const router = useRouter()
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [form, setForm] = useState({ name: '', phone: '', telegram_chat_id: '' })
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function getToken() { return localStorage.getItem('token') || '' }

  async function load() {
    const res = await fetch('/api/teachers', { headers: { Authorization: `Bearer ${getToken()}` } })
    if (res.status === 401) return router.push('/admin/login')
    setTeachers(await res.json())
  }

  useEffect(() => { load() }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const res = await fetch('/api/teachers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) return setError(data.error)
    setForm({ name: '', phone: '', telegram_chat_id: '' })
    setShowForm(false)
    load()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm px-4 py-4 flex items-center gap-3">
        <Link href="/admin/dashboard" className="text-gray-500 hover:text-gray-900">← Back</Link>
        <h1 className="font-bold text-gray-900">Teachers</h1>
      </header>

      <main className="p-4 max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <p className="text-sm text-gray-500">{teachers.length} teachers</p>
          <button onClick={() => setShowForm(!showForm)}
            className="bg-purple-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-purple-700">
            + Add Teacher
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-5 mb-4 space-y-3">
            <h2 className="font-semibold text-gray-900">New Teacher</h2>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Teacher name"
              value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
            <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Phone number"
              value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} required />
            <div>
              <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Telegram Chat ID"
                value={form.telegram_chat_id} onChange={e => setForm({ ...form, telegram_chat_id: e.target.value })} />
              <p className="text-xs text-gray-400 mt-1">
                Teacher must message your bot first. Their Chat ID appears in bot logs.
              </p>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={loading}
                className="flex-1 bg-purple-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                {loading ? 'Saving...' : 'Save Teacher'}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="flex-1 border py-2 rounded-lg text-sm text-gray-600">Cancel</button>
            </div>
          </form>
        )}

        <div className="space-y-3">
          {teachers.map(t => (
            <div key={t.id} className="bg-white rounded-xl shadow-sm p-4">
              <p className="font-semibold text-gray-900">{t.name}</p>
              <p className="text-sm text-gray-500">{t.phone}</p>
              <p className={`text-xs mt-1 ${t.telegram_chat_id ? 'text-green-600' : 'text-orange-500'}`}>
                {t.telegram_chat_id ? 'Telegram connected' : 'Telegram not set up'}
              </p>
            </div>
          ))}
          {teachers.length === 0 && (
            <p className="text-center text-gray-400 py-12">No teachers yet. Add your first teacher.</p>
          )}
        </div>
      </main>
    </div>
  )
}
