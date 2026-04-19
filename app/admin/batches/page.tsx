'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import AdminBottomNav from '@/components/AdminBottomNav'
import BottomSheet from '@/components/BottomSheet'

type Slot = { day: string; start: string; end: string }
type Batch = { id: string; name: string; subject: string; schedule_slots: Slot[]; teacher_id?: string; teachers?: { name: string } }

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function fmt12(t: string) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${ampm}`
}

function SlotBuilder({ slots, onChange }: { slots: Slot[]; onChange: (s: Slot[]) => void }) {
  function add() { onChange([...slots, { day: 'Mon', start: '09:00', end: '10:00' }]) }
  function remove(i: number) { onChange(slots.filter((_, idx) => idx !== i)) }
  function update(i: number, field: keyof Slot, val: string) {
    onChange(slots.map((s, idx) => idx === i ? { ...s, [field]: val } : s))
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-700">Schedule Slots</p>
        <button type="button" onClick={add}
          className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-lg hover:bg-blue-100">
          + Add Slot
        </button>
      </div>
      {slots.length === 0 && (
        <p className="text-xs text-gray-400">No slots yet. Add at least one.</p>
      )}
      {slots.map((s, i) => (
        <div key={i} className="bg-gray-50 rounded-lg px-3 py-2 space-y-2">
          <div className="flex items-center gap-2">
            <select value={s.day} onChange={e => update(i, 'day', e.target.value)}
              className="flex-1 border rounded px-2 py-1.5 text-sm">
              {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <button type="button" onClick={() => remove(i)}
              className="text-gray-400 hover:text-red-500 p-1">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <input type="time" value={s.start} onChange={e => update(i, 'start', e.target.value)}
              className="flex-1 border rounded px-2 py-1.5 text-sm" />
            <span className="text-gray-400 text-xs shrink-0">to</span>
            <input type="time" value={s.end} onChange={e => update(i, 'end', e.target.value)}
              className="flex-1 border rounded px-2 py-1.5 text-sm" />
          </div>
        </div>
      ))}
    </div>
  )
}

function SlotDisplay({ slots }: { slots: Slot[] }) {
  if (!slots?.length) return null
  return (
    <div className="mt-1 space-y-0.5">
      {slots.map((s, i) => (
        <p key={i} className="text-xs text-gray-400">{s.day} · {fmt12(s.start)} – {fmt12(s.end)}</p>
      ))}
    </div>
  )
}

export default function BatchesPage() {
  const router = useRouter()
  const [batches, setBatches] = useState<Batch[]>([])
  const [teachers, setTeachers] = useState<{ id: string; name: string }[]>([])
  const [form, setForm] = useState({ name: '', subject: '', teacher_id: '' })
  const [formSlots, setFormSlots] = useState<Slot[]>([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: '', subject: '', teacher_id: '' })
  const [editSlots, setEditSlots] = useState<Slot[]>([])
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleDelete(id: string) {
    if (!confirm('Delete this batch? This cannot be undone.')) return
    setDeletingId(id)
    await fetch('/api/batches', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ id }),
    })
    setDeletingId(null)
    load()
  }

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

  function startEdit(b: Batch) {
    setEditingId(b.id)
    setEditForm({ name: b.name, subject: b.subject, teacher_id: b.teacher_id || '' })
    setEditSlots(b.schedule_slots || [])
    setEditError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const res = await fetch('/api/batches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ ...form, schedule_slots: formSlots }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) return setError(data.error)
    setForm({ name: '', subject: '', teacher_id: '' })
    setFormSlots([])
    setShowForm(false)
    load()
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    setEditLoading(true); setEditError('')
    const res = await fetch('/api/batches', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ id: editingId, ...editForm, schedule_slots: editSlots }),
    })
    const data = await res.json()
    setEditLoading(false)
    if (!res.ok) return setEditError(data.error)
    setEditingId(null)
    load()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="Batches" backHref="/admin/dashboard" homeHref="/admin/dashboard" />

      <main className="p-4 max-w-2xl mx-auto pb-28">
        <div className="flex justify-between items-center mb-4">
          <p className="text-sm text-gray-500">{batches.length} batches</p>
          <button onClick={() => setShowForm(true)}
            className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700">
            + Add Batch
          </button>
        </div>

        <div className="space-y-3">
          {batches.map(b => (
            <div key={b.id} className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{b.name}</p>
                  <p className="text-sm text-gray-500">{b.subject}</p>
                  <SlotDisplay slots={b.schedule_slots} />
                  {b.teachers?.name && <p className="text-xs text-blue-600 mt-1">Teacher: {b.teachers.name}</p>}
                </div>
                <div className="flex gap-2 ml-2 shrink-0">
                  <button onClick={() => startEdit(b)} title="Edit"
                    className="p-1.5 text-gray-400 hover:text-blue-600 transition">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button onClick={() => handleDelete(b.id)} disabled={deletingId === b.id} title="Delete"
                    className="p-1.5 text-gray-400 hover:text-red-600 disabled:opacity-50 transition">
                    {deletingId === b.id
                      ? <span className="text-xs px-1">...</span>
                      : <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    }
                  </button>
                </div>
              </div>
            </div>
          ))}
          {batches.length === 0 && (
            <p className="text-center text-gray-400 py-12">No batches yet. Add your first batch.</p>
          )}
        </div>
      </main>

      {/* Add Batch Sheet */}
      <BottomSheet open={showForm} onClose={() => { setShowForm(false); setError('') }} title="New Batch">
        <form onSubmit={handleSubmit} className="space-y-3">
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <input className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder="Batch name (e.g. Maths Morning A)"
            value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          <input className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder="Subject (e.g. Mathematics)"
            value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} required />
          <select className="w-full border rounded-lg px-3 py-2 text-sm"
            value={form.teacher_id} onChange={e => setForm({ ...form, teacher_id: e.target.value })}>
            <option value="">Select Teacher (optional)</option>
            {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <SlotBuilder slots={formSlots} onChange={setFormSlots} />
          <button type="submit" disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-xl text-sm font-semibold disabled:opacity-50 mt-2">
            {loading ? 'Saving...' : 'Save Batch'}
          </button>
        </form>
      </BottomSheet>

      {/* Edit Batch Sheet */}
      <BottomSheet open={editingId !== null} onClose={() => { setEditingId(null); setEditError('') }} title="Edit Batch">
        <form onSubmit={handleEdit} className="space-y-3">
          {editError && <p className="text-red-600 text-sm">{editError}</p>}
          <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Batch name"
            value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} required />
          <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Subject"
            value={editForm.subject} onChange={e => setEditForm({ ...editForm, subject: e.target.value })} required />
          <select className="w-full border rounded-lg px-3 py-2 text-sm"
            value={editForm.teacher_id} onChange={e => setEditForm({ ...editForm, teacher_id: e.target.value })}>
            <option value="">Select Teacher (optional)</option>
            {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <SlotBuilder slots={editSlots} onChange={setEditSlots} />
          <button type="submit" disabled={editLoading}
            className="w-full bg-blue-600 text-white py-3 rounded-xl text-sm font-semibold disabled:opacity-50 mt-2">
            {editLoading ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </BottomSheet>

      <AdminBottomNav />
    </div>
  )
}
