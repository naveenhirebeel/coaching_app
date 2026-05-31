'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import AdminBottomNav from '@/components/AdminBottomNav'
import BottomSheet from '@/components/BottomSheet'

type Student = { id: string; name: string; parent_name: string; parent_mobile: string; parent_telegram_chat_id: string; parent2_name: string; parent2_mobile: string; parent2_telegram_chat_id: string; batch_id: string; batches?: { name: string } }
type Batch = { id: string; name: string; subject: string }

export default function StudentsPage() {
  const router = useRouter()
  const [students, setStudents] = useState<Student[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [form, setForm] = useState({ name: '', parent_name: '', parent_mobile: '', parent_telegram_chat_id: '', parent2_name: '', parent2_mobile: '', parent2_telegram_chat_id: '', batch_id: '' })
  const [formMobileStatus, setFormMobileStatus] = useState<{ p1?: 'found' | 'checking'; p2?: 'found' | 'checking' }>({})
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [testStatus, setTestStatus] = useState<Record<string, { ok: boolean; msg: string }>>({})
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: '', parent_name: '', parent_mobile: '', parent_telegram_chat_id: '', parent2_name: '', parent2_mobile: '', parent2_telegram_chat_id: '', batch_id: '' })
  const [editMobileStatus, setEditMobileStatus] = useState<{ p1?: 'found' | 'checking'; p2?: 'found' | 'checking' }>({})
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  async function checkMobile(mobile: string, parent: 1 | 2, context: 'form' | 'edit') {
    if (!/^\d{10}$/.test(mobile)) return
    const setStatus = context === 'form' ? setFormMobileStatus : setEditMobileStatus
    const setF = context === 'form' ? setForm : setEditForm
    setStatus(prev => ({ ...prev, [parent === 1 ? 'p1' : 'p2']: 'checking' }))
    const res = await fetch(`/api/students?check_mobile=${mobile}`, { headers: { Authorization: `Bearer ${getToken()}` } })
    const data = await res.json()
    if (data.found) {
      setF((prev: typeof form) => ({ ...prev, [parent === 1 ? 'parent_telegram_chat_id' : 'parent2_telegram_chat_id']: data.telegram_chat_id }))
      setStatus(prev => ({ ...prev, [parent === 1 ? 'p1' : 'p2']: 'found' }))
    } else {
      setStatus(prev => { const n = { ...prev }; delete n[parent === 1 ? 'p1' : 'p2']; return n })
    }
  }

  async function handleDelete(id: string) {
    setDeleteLoading(true)
    await fetch('/api/students', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ id }),
    })
    setDeleteLoading(false)
    setDeletingId(null)
    load()
  }

  function getParentLink(studentId: string, parent: 1 | 2 = 1) {
    const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME
    const base = typeof window !== 'undefined' ? window.location.origin : ''
    const prefix = parent === 2 ? 'p2_' : 'p_'
    if (botUsername) return `https://t.me/${botUsername}?start=${prefix}${studentId}`
    return `${base}/api/telegram-webhook?ref=${prefix}${studentId}`
  }

  async function copyParentLink(studentId: string, parent: 1 | 2 = 1) {
    await navigator.clipboard.writeText(getParentLink(studentId, parent))
    setCopiedId(parent === 2 ? `${studentId}_p2` : studentId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  function startEdit(s: Student) {
    setEditingId(s.id)
    setEditForm({ name: s.name, parent_name: s.parent_name || '', parent_mobile: s.parent_mobile || '', parent_telegram_chat_id: s.parent_telegram_chat_id || '', parent2_name: s.parent2_name || '', parent2_mobile: s.parent2_mobile || '', parent2_telegram_chat_id: s.parent2_telegram_chat_id || '', batch_id: s.batch_id || '' })
    setEditMobileStatus({})
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
    setForm({ name: '', parent_name: '', parent_mobile: '', parent_telegram_chat_id: '', parent2_name: '', parent2_mobile: '', parent2_telegram_chat_id: '', batch_id: '' })
    setFormMobileStatus({})
    setShowForm(false)
    load()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="Students" backHref="/admin/dashboard" homeHref="/admin/dashboard" />

      <main className="p-4 max-w-2xl mx-auto pb-28">
        <div className="flex justify-between items-center mb-4">
          <p className="text-sm text-gray-500">{students.length} students</p>
          <button onClick={() => setShowForm(true)}
            className="bg-green-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-green-700">
            + Add Student
          </button>
        </div>

        <div className="space-y-3">
          {students.map(s => (
            <div key={s.id} className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex items-start justify-between">
                <p className="font-semibold text-gray-900">{s.name}</p>
                <div className="flex gap-2 ml-2">
                  <button onClick={() => startEdit(s)} title="Edit"
                    className="p-1.5 text-gray-400 hover:text-blue-600 transition">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button onClick={() => setDeletingId(s.id)} title="Delete"
                    className="p-1.5 text-gray-400 hover:text-red-600 transition">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
              {s.parent_name && <p className="text-sm text-gray-500">Parent 1: {s.parent_name}{s.parent_mobile ? ` · ${s.parent_mobile}` : ''}</p>}
              {s.parent2_name && <p className="text-sm text-gray-500">Parent 2: {s.parent2_name}{s.parent2_mobile ? ` · ${s.parent2_mobile}` : ''}</p>}
              {s.batches?.name && <p className="text-xs text-blue-600 mt-1">Batch: {s.batches.name}</p>}
              <div className="mt-2 space-y-1">
                <div className="flex items-center justify-between">
                  <p className={`text-xs ${s.parent_telegram_chat_id ? 'text-green-600' : 'text-orange-500'}`}>
                    Parent 1: {s.parent_telegram_chat_id ? 'Telegram linked' : 'Not linked'}
                  </p>
                  {s.parent_telegram_chat_id ? (
                    <button onClick={() => sendTest(s.parent_telegram_chat_id, s.parent_name || s.name, s.id)}
                      className="text-xs bg-blue-50 text-blue-600 px-3 py-1 rounded-lg hover:bg-blue-100">
                      Send Test
                    </button>
                  ) : (
                    <button onClick={() => copyParentLink(s.id, 1)}
                      className="text-xs bg-orange-50 text-orange-600 px-3 py-1 rounded-lg hover:bg-orange-100">
                      {copiedId === s.id ? 'Copied!' : 'Copy Link'}
                    </button>
                  )}
                </div>
                {s.parent2_name && (
                  <div className="flex items-center justify-between">
                    <p className={`text-xs ${s.parent2_telegram_chat_id ? 'text-green-600' : 'text-orange-500'}`}>
                      Parent 2: {s.parent2_telegram_chat_id ? 'Telegram linked' : 'Not linked'}
                    </p>
                    {s.parent2_telegram_chat_id ? (
                      <button onClick={() => sendTest(s.parent2_telegram_chat_id, s.parent2_name || s.name, `${s.id}_p2`)}
                        className="text-xs bg-blue-50 text-blue-600 px-3 py-1 rounded-lg hover:bg-blue-100">
                        Send Test
                      </button>
                    ) : (
                      <button onClick={() => copyParentLink(s.id, 2)}
                        className="text-xs bg-orange-50 text-orange-600 px-3 py-1 rounded-lg hover:bg-orange-100">
                        {copiedId === `${s.id}_p2` ? 'Copied!' : 'Copy Link'}
                      </button>
                    )}
                  </div>
                )}
              </div>
              {(!s.parent_telegram_chat_id || (s.parent2_name && !s.parent2_telegram_chat_id)) && (
                <p className="text-xs text-gray-400 mt-1">Share the copied link with the parent. They open it in Telegram to link automatically.</p>
              )}
              {testStatus[s.id] && (
                <p className={`text-xs mt-1 ${testStatus[s.id].ok ? 'text-green-600' : 'text-red-600'}`}>
                  {testStatus[s.id].msg}
                </p>
              )}
              {deletingId === s.id && (
                <div className="mt-3 bg-red-50 rounded-lg p-3 space-y-2">
                  <p className="text-xs text-red-700 font-medium">Remove this student? All attendance records will also be deleted. Parent will be notified via Telegram if linked.</p>
                  <div className="flex gap-2">
                    <button onClick={() => handleDelete(s.id)} disabled={deleteLoading}
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
          {students.length === 0 && (
            <p className="text-center text-gray-400 py-12">No students yet. Add your first student.</p>
          )}
        </div>
      </main>

      {/* Add Student Sheet */}
      <BottomSheet open={showForm} onClose={() => { setShowForm(false); setError('') }} title="New Student">
        <form onSubmit={handleSubmit} className="space-y-3">
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Student name"
            value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          <p className="text-xs font-medium text-gray-600 mt-2">Parent 1</p>
          <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Parent 1 name"
            value={form.parent_name} onChange={e => setForm({ ...form, parent_name: e.target.value })} />
          <div>
            <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Parent 1 mobile (10 digits)"
              value={form.parent_mobile}
              onChange={e => { setForm({ ...form, parent_mobile: e.target.value }); setFormMobileStatus(prev => { const n = { ...prev }; delete n.p1; return n }) }}
              onBlur={e => checkMobile(e.target.value, 1, 'form')}
              inputMode="numeric" maxLength={10} />
            {formMobileStatus.p1 === 'checking' && <p className="text-xs text-gray-400 mt-1">Checking...</p>}
            {formMobileStatus.p1 === 'found' && <p className="text-xs text-green-600 mt-1">✓ Already registered — Telegram linked automatically</p>}
            {!formMobileStatus.p1 && form.parent_mobile.length === 10 && !form.parent_telegram_chat_id && (
              <p className="text-xs text-gray-400 mt-1">Parent can also message the bot with their mobile to link</p>
            )}
          </div>
          <p className="text-xs font-medium text-gray-600 mt-2">Parent 2 (optional)</p>
          <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Parent 2 name"
            value={form.parent2_name} onChange={e => setForm({ ...form, parent2_name: e.target.value })} />
          <div>
            <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Parent 2 mobile (10 digits)"
              value={form.parent2_mobile}
              onChange={e => { setForm({ ...form, parent2_mobile: e.target.value }); setFormMobileStatus(prev => { const n = { ...prev }; delete n.p2; return n }) }}
              onBlur={e => checkMobile(e.target.value, 2, 'form')}
              inputMode="numeric" maxLength={10} />
            {formMobileStatus.p2 === 'checking' && <p className="text-xs text-gray-400 mt-1">Checking...</p>}
            {formMobileStatus.p2 === 'found' && <p className="text-xs text-green-600 mt-1">✓ Already registered — Telegram linked automatically</p>}
          </div>
          <select className="w-full border rounded-lg px-3 py-2 text-sm"
            value={form.batch_id} onChange={e => setForm({ ...form, batch_id: e.target.value })} required>
            <option value="">Select Batch</option>
            {batches.map(b => <option key={b.id} value={b.id}>{b.name} - {b.subject}</option>)}
          </select>
          <button type="submit" disabled={loading}
            className="w-full bg-green-600 text-white py-3 rounded-xl text-sm font-semibold disabled:opacity-50 mt-2">
            {loading ? 'Saving...' : 'Save Student'}
          </button>
        </form>
      </BottomSheet>

      {/* Edit Student Sheet */}
      <BottomSheet open={editingId !== null} onClose={() => { setEditingId(null); setEditError('') }} title="Edit Student">
        <form onSubmit={handleEdit} className="space-y-3">
          {editError && <p className="text-red-600 text-sm">{editError}</p>}
          <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Student name"
            value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} required />
          <p className="text-xs font-medium text-gray-600 mt-2">Parent 1</p>
          <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Parent 1 name"
            value={editForm.parent_name} onChange={e => setEditForm({ ...editForm, parent_name: e.target.value })} />
          <div>
            <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Parent 1 mobile (10 digits)"
              value={editForm.parent_mobile}
              onChange={e => { setEditForm({ ...editForm, parent_mobile: e.target.value }); setEditMobileStatus(prev => { const n = { ...prev }; delete n.p1; return n }) }}
              onBlur={e => checkMobile(e.target.value, 1, 'edit')}
              inputMode="numeric" maxLength={10} />
            {editMobileStatus.p1 === 'checking' && <p className="text-xs text-gray-400 mt-1">Checking...</p>}
            {editMobileStatus.p1 === 'found' && <p className="text-xs text-green-600 mt-1">✓ Already registered — Telegram linked automatically</p>}
          </div>
          <p className="text-xs font-medium text-gray-600 mt-2">Parent 2 (optional)</p>
          <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Parent 2 name"
            value={editForm.parent2_name} onChange={e => setEditForm({ ...editForm, parent2_name: e.target.value })} />
          <div>
            <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Parent 2 mobile (10 digits)"
              value={editForm.parent2_mobile}
              onChange={e => { setEditForm({ ...editForm, parent2_mobile: e.target.value }); setEditMobileStatus(prev => { const n = { ...prev }; delete n.p2; return n }) }}
              onBlur={e => checkMobile(e.target.value, 2, 'edit')}
              inputMode="numeric" maxLength={10} />
            {editMobileStatus.p2 === 'checking' && <p className="text-xs text-gray-400 mt-1">Checking...</p>}
            {editMobileStatus.p2 === 'found' && <p className="text-xs text-green-600 mt-1">✓ Already registered — Telegram linked automatically</p>}
          </div>
          <select className="w-full border rounded-lg px-3 py-2 text-sm"
            value={editForm.batch_id} onChange={e => setEditForm({ ...editForm, batch_id: e.target.value })} required>
            <option value="">Select Batch</option>
            {batches.map(b => <option key={b.id} value={b.id}>{b.name} - {b.subject}</option>)}
          </select>
          <button type="submit" disabled={editLoading}
            className="w-full bg-green-600 text-white py-3 rounded-xl text-sm font-semibold disabled:opacity-50 mt-2">
            {editLoading ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </BottomSheet>

      <AdminBottomNav />
    </div>
  )
}
