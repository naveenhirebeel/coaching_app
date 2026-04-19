'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import AdminBottomNav from '@/components/AdminBottomNav'
import BottomSheet from '@/components/BottomSheet'

type Teacher = { id: string; name: string; phone: string; telegram_chat_id: string }

export default function TeachersPage() {
  const router = useRouter()
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [form, setForm] = useState({ name: '', phone: '', telegram_chat_id: '' })
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [testStatus, setTestStatus] = useState<Record<string, { ok: boolean; msg: string }>>({})
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: '', phone: '', telegram_chat_id: '' })
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  async function handleDelete(id: string) {
    setDeleteLoading(true)
    await fetch('/api/teachers', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ id }),
    })
    setDeleteLoading(false)
    setDeletingId(null)
    load()
  }

  function startEdit(t: Teacher) {
    setEditingId(t.id)
    setEditForm({ name: t.name, phone: t.phone, telegram_chat_id: t.telegram_chat_id || '' })
    setEditError('')
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    setEditLoading(true); setEditError('')
    const res = await fetch('/api/teachers', {
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

  async function sendTest(chatId: string, name: string, teacherId: string) {
    setTestStatus(prev => ({ ...prev, [teacherId]: { ok: false, msg: 'Sending...' } }))
    const res = await fetch('/api/test-telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ chat_id: chatId, name }),
    })
    const data = await res.json()
    setTestStatus(prev => ({ ...prev, [teacherId]: { ok: res.ok, msg: res.ok ? data.message : data.error } }))
  }

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
      <PageHeader title="Teachers" backHref="/admin/dashboard" homeHref="/admin/dashboard" />

      <main className="p-4 max-w-2xl mx-auto pb-28">
        <div className="flex justify-between items-center mb-4">
          <p className="text-sm text-gray-500">{teachers.length} teachers</p>
          <button onClick={() => setShowForm(true)}
            className="bg-purple-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-purple-700">
            + Add Teacher
          </button>
        </div>

        <div className="space-y-3">
          {teachers.map(t => (
            <div key={t.id} className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex items-start justify-between">
                <p className="font-semibold text-gray-900">{t.name}</p>
                <div className="flex gap-2 ml-2">
                  <button onClick={() => startEdit(t)} title="Edit"
                    className="p-1.5 text-gray-400 hover:text-blue-600 transition">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button onClick={() => setDeletingId(t.id)} title="Delete"
                    className="p-1.5 text-gray-400 hover:text-red-600 transition">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
              <p className="text-sm text-gray-500">{t.phone}</p>
              <div className="flex items-center justify-between mt-1">
                <p className={`text-xs ${t.telegram_chat_id ? 'text-green-600' : 'text-orange-500'}`}>
                  {t.telegram_chat_id ? 'Telegram connected' : 'Telegram not linked'}
                </p>
                {t.telegram_chat_id && (
                  <button onClick={() => sendTest(t.telegram_chat_id, t.name, t.id)}
                    className="text-xs bg-blue-50 text-blue-600 px-3 py-1 rounded-lg hover:bg-blue-100">
                    Send Test
                  </button>
                )}
              </div>
              {!t.telegram_chat_id && (
                <p className="text-xs text-gray-400 mt-1">
                  Ask teacher to open your bot and send: <span className="font-mono text-gray-600">{t.phone}</span>
                </p>
              )}
              {testStatus[t.id] && (
                <p className={`text-xs mt-1 ${testStatus[t.id].ok ? 'text-green-600' : 'text-red-600'}`}>
                  {testStatus[t.id].msg}
                </p>
              )}
              {deletingId === t.id && (
                <div className="mt-3 bg-red-50 rounded-lg p-3 space-y-2">
                  <p className="text-xs text-red-700 font-medium">Remove this teacher? Their batches will remain but teacher assignment will be cleared. A Telegram notification will be sent if linked.</p>
                  <div className="flex gap-2">
                    <button onClick={() => handleDelete(t.id)} disabled={deleteLoading}
                      className="flex-1 bg-red-600 text-white py-1.5 rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50">
                      {deleteLoading ? 'Removing...' : 'Confirm Remove'}
                    </button>
                    <button onClick={() => setDeletingId(null)}
                      className="flex-1 border py-1.5 rounded-lg text-xs text-gray-600">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {teachers.length === 0 && (
            <p className="text-center text-gray-400 py-12">No teachers yet. Add your first teacher.</p>
          )}
        </div>
      </main>

      {/* Add Teacher Sheet */}
      <BottomSheet open={showForm} onClose={() => { setShowForm(false); setError('') }} title="New Teacher">
        <form onSubmit={handleSubmit} className="space-y-3">
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Teacher name"
            value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Phone number"
            value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} required />
          <div className="bg-blue-50 rounded-lg px-3 py-2 text-xs text-blue-700">
            No Chat ID needed. After saving, ask the teacher to open your Telegram bot and send their phone number (e.g. <span className="font-mono">9876543210</span>). They will be linked automatically.
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-purple-600 text-white py-3 rounded-xl text-sm font-semibold disabled:opacity-50 mt-2">
            {loading ? 'Saving...' : 'Save Teacher'}
          </button>
        </form>
      </BottomSheet>

      {/* Edit Teacher Sheet */}
      <BottomSheet open={editingId !== null} onClose={() => { setEditingId(null); setEditError('') }} title="Edit Teacher">
        <form onSubmit={handleEdit} className="space-y-3">
          {editError && <p className="text-red-600 text-sm">{editError}</p>}
          <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Teacher name"
            value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} required />
          <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Phone number"
            value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} required />
          <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Telegram Chat ID"
            value={editForm.telegram_chat_id} onChange={e => setEditForm({ ...editForm, telegram_chat_id: e.target.value })} />
          <button type="submit" disabled={editLoading}
            className="w-full bg-purple-600 text-white py-3 rounded-xl text-sm font-semibold disabled:opacity-50 mt-2">
            {editLoading ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </BottomSheet>

      <AdminBottomNav />
    </div>
  )
}
