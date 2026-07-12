'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import AdminBottomNav from '@/components/AdminBottomNav'
import BottomSheet from '@/components/BottomSheet'

type Slot = { day: string; start: string; end: string }
type Batch = { id: string; name: string; subject: string; schedule_slots: Slot[]; teacher_id?: string; teachers?: { name: string }; students?: { count: number }[] }

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function fmt12(t: string) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${ampm}`
}

// Today's date (YYYY-MM-DD) in IST, matching the cron's timezone.
function istToday() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className="w-full flex items-center justify-between gap-3 text-left">
      <span>
        <span className="text-sm font-medium text-gray-800">{label}</span>
        {hint && <span className="block text-xs text-gray-400">{hint}</span>}
      </span>
      <span className={`shrink-0 w-11 h-6 rounded-full p-0.5 transition ${checked ? 'bg-blue-600' : 'bg-gray-300'}`}>
        <span className={`block w-5 h-5 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </span>
    </button>
  )
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
        <div key={i} className="bg-gray-50 rounded-lg px-3 py-2.5 space-y-2.5">
          <div className="flex items-center gap-2">
            <select value={s.day} onChange={e => update(i, 'day', e.target.value)}
              className="flex-1 border rounded-lg px-3 py-2 text-sm bg-white">
              {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <button type="button" onClick={() => remove(i)}
              className="shrink-0 text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <p className="text-xs text-gray-400 pl-0.5">Start</p>
              <input type="time" value={s.start} onChange={e => update(i, 'start', e.target.value)}
                className="w-full border rounded-lg px-2 py-2 text-sm bg-white" />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-gray-400 pl-0.5">End</p>
              <input type="time" value={s.end} onChange={e => update(i, 'end', e.target.value)}
                className="w-full border rounded-lg px-2 py-2 text-sm bg-white" />
            </div>
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
  const [pageLoading, setPageLoading] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: '', subject: '', teacher_id: '' })
  const [editSlots, setEditSlots] = useState<Slot[]>([])
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [notifyBatch, setNotifyBatch] = useState<{ id: string; name: string } | null>(null)
  const [notifying, setNotifying] = useState(false)
  const [notifyResult, setNotifyResult] = useState('')
  const [dailyBatch, setDailyBatch] = useState<{ id: string; name: string } | null>(null)
  const [daily, setDaily] = useState({ override_date: istToday(), send_default: true, custom_enabled: false, custom_message: '' })
  const [dailyLoading, setDailyLoading] = useState(false)
  const [dailySaving, setDailySaving] = useState(false)
  const [dailyMsg, setDailyMsg] = useState('')

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
    setPageLoading(false)
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

  function slotsChanged(original: Slot[], updated: Slot[]) {
    return JSON.stringify(original) !== JSON.stringify(updated)
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
    const originalBatch = batches.find(b => b.id === editingId)
    const originalSlots = originalBatch?.schedule_slots || []
    const scheduleDidChange = slotsChanged(originalSlots, editSlots)
    const res = await fetch('/api/batches', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ id: editingId, ...editForm, schedule_slots: editSlots }),
    })
    const data = await res.json()
    setEditLoading(false)
    if (!res.ok) return setEditError(data.error)
    const savedId = editingId!
    const savedName = editForm.name
    setEditingId(null)
    load()
    if (scheduleDidChange) {
      setNotifyBatch({ id: savedId, name: savedName })
      setNotifyResult('')
    }
  }

  async function openDaily(b: Batch) {
    setDailyBatch({ id: b.id, name: b.name })
    setDailyMsg('')
    const date = istToday()
    setDaily({ override_date: date, send_default: true, custom_enabled: false, custom_message: '' })
    loadDaily(b.id, date)
  }

  async function loadDaily(batchId: string, date: string) {
    setDailyLoading(true)
    const res = await fetch(`/api/batches/daily-message?batch_id=${batchId}&date=${date}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
    const data = await res.json().catch(() => ({}))
    setDailyLoading(false)
    const o = data.override
    setDaily({
      override_date: date,
      send_default: o ? o.send_default : true,
      custom_enabled: o ? o.custom_enabled : false,
      custom_message: o?.custom_message || '',
    })
  }

  async function saveDaily() {
    if (!dailyBatch) return
    if (daily.custom_enabled && !daily.custom_message.trim()) { setDailyMsg('Enter a custom message or turn it off.'); return }
    if (!daily.send_default && !daily.custom_enabled) { setDailyMsg('Nothing will be sent. Enable at least one, or use this to cancel the class silently.') }
    setDailySaving(true)
    const res = await fetch('/api/batches/daily-message', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ batch_id: dailyBatch.id, ...daily }),
    })
    const data = await res.json().catch(() => ({}))
    setDailySaving(false)
    setDailyMsg(res.ok ? 'Saved for ' + daily.override_date : (data.error || 'Failed to save'))
  }

  async function resetDaily() {
    if (!dailyBatch) return
    setDailySaving(true)
    const res = await fetch('/api/batches/daily-message', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ batch_id: dailyBatch.id, override_date: daily.override_date }),
    })
    setDailySaving(false)
    setDaily({ ...daily, send_default: true, custom_enabled: false, custom_message: '' })
    setDailyMsg(res.ok ? 'Reset to default reminder.' : 'Failed to reset')
  }

  async function handleNotify() {
    if (!notifyBatch) return
    setNotifying(true)
    const res = await fetch('/api/batches/notify-schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ batch_id: notifyBatch.id }),
    })
    const data = await res.json()
    setNotifying(false)
    setNotifyResult(data.message || data.error || 'Done')
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
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900 truncate">{b.name}</p>
                  <p className="text-sm text-gray-500 truncate">{b.subject}</p>
                  <SlotDisplay slots={b.schedule_slots} />
                  <div className="flex items-center gap-3 mt-1">
                    {b.teachers?.name && <p className="text-xs text-blue-600">Teacher: {b.teachers.name}</p>}
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {b.students?.[0]?.count ?? 0} students
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 ml-2 shrink-0">
                  <button onClick={() => openDaily(b)} title="Today's message"
                    className="p-1.5 text-gray-400 hover:text-blue-600 transition">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </button>
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
          {batches.length === 0 && (pageLoading
            ? <p className="text-center text-gray-400 py-12">Loading...</p>
            : <p className="text-center text-gray-400 py-12">No batches yet. Add your first batch.</p>
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

      {/* Today's message override sheet */}
      <BottomSheet open={dailyBatch !== null} onClose={() => setDailyBatch(null)} title="Daily Message">
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Customise what parents of <span className="font-medium text-gray-800">{dailyBatch?.name}</span> receive on a given day.
            Set it before the daily reminder goes out (09:00 IST).
          </p>

          <div className="space-y-1">
            <p className="text-xs text-gray-400 pl-0.5">Date</p>
            <input type="date" value={daily.override_date}
              min={istToday()}
              onChange={e => { const d = e.target.value; setDaily({ ...daily, override_date: d }); setDailyMsg(''); if (dailyBatch) loadDaily(dailyBatch.id, d) }}
              className="w-full border rounded-lg px-3 py-2 text-sm bg-white" />
          </div>

          {dailyLoading ? (
            <p className="text-sm text-gray-400 py-4 text-center">Loading...</p>
          ) : (
            <>
              <div className="bg-gray-50 rounded-lg px-3 py-3 space-y-3">
                <Toggle checked={daily.send_default} onChange={v => setDaily({ ...daily, send_default: v })}
                  label="Send default reminder" hint="The usual “Class Today” message" />
                <div className="border-t" />
                <Toggle checked={daily.custom_enabled} onChange={v => setDaily({ ...daily, custom_enabled: v })}
                  label="Add custom message" hint="Exam today, bring notes, class cancelled…" />
              </div>

              {daily.custom_enabled && (
                <textarea value={daily.custom_message}
                  onChange={e => setDaily({ ...daily, custom_message: e.target.value })}
                  placeholder="e.g. Class is cancelled today due to a holiday."
                  rows={3}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
              )}

              <p className="text-xs text-gray-400">
                {daily.send_default && daily.custom_enabled && 'Parents get the reminder plus your note.'}
                {daily.send_default && !daily.custom_enabled && 'Parents get the usual reminder only.'}
                {!daily.send_default && daily.custom_enabled && 'Parents get only your custom message.'}
                {!daily.send_default && !daily.custom_enabled && 'No message will be sent (class silently cancelled).'}
              </p>

              {dailyMsg && <p className="text-sm text-blue-600">{dailyMsg}</p>}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={resetDaily} disabled={dailySaving}
                  className="flex-1 py-2.5 rounded-xl border text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                  Reset to default
                </button>
                <button type="button" onClick={saveDaily} disabled={dailySaving}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
                  {dailySaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </>
          )}
        </div>
      </BottomSheet>

      {/* Schedule change notification modal */}
      {notifyBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            {!notifyResult ? (
              <>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">📅</span>
                  <h2 className="text-base font-semibold text-gray-900">Schedule Changed</h2>
                </div>
                <p className="text-sm text-gray-600 mb-5">
                  The schedule for <span className="font-medium text-gray-900">{notifyBatch.name}</span> was updated.
                  Would you like to notify all parents in this batch via Telegram?
                </p>
                <div className="flex gap-3">
                  <button onClick={() => setNotifyBatch(null)}
                    className="flex-1 py-2.5 rounded-xl border text-sm text-gray-600 hover:bg-gray-50">
                    Skip
                  </button>
                  <button onClick={handleNotify} disabled={notifying}
                    className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
                    {notifying ? 'Sending...' : 'Yes, Notify Parents'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">✅</span>
                  <h2 className="text-base font-semibold text-gray-900">Notifications Sent</h2>
                </div>
                <p className="text-sm text-gray-600 mb-5">{notifyResult}</p>
                <button onClick={() => setNotifyBatch(null)}
                  className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700">
                  Done
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <AdminBottomNav />
    </div>
  )
}
