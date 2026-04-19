'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type Institute = {
  id: string
  name: string
  phone: string
  email: string
  address: string
  status: 'pending' | 'approved' | 'revoked' | 'suspended' | 'archived'
  status_reason: string | null
  status_updated_at: string | null
  created_at: string
}

type Tab = 'pending' | 'approved' | 'revoked' | 'suspended' | 'archived'

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  approved: 'Active',
  revoked: 'Revoked',
  suspended: 'Suspended',
  archived: 'Archived',
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  revoked: 'bg-orange-100 text-orange-800',
  suspended: 'bg-red-100 text-red-800',
  archived: 'bg-gray-100 text-gray-600',
}

function getToken() { return localStorage.getItem('sa_token') || '' }

export default function SuperAdminDashboard() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('pending')
  const [institutes, setInstitutes] = useState<Institute[]>([])
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [reasonModal, setReasonModal] = useState<{ id: string; name: string; nextStatus: string } | null>(null)
  const [reason, setReason] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null)
  const [counts, setCounts] = useState<Record<string, number>>({})

  async function load(status: Tab) {
    setLoading(true)
    const res = await fetch(`/api/super-admin/institutes?status=${status}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
    if (res.status === 401) { router.push('/super-admin/login'); return }
    const data = await res.json()
    setInstitutes(data)
    setLoading(false)
  }

  async function loadCounts() {
    const statuses: Tab[] = ['pending', 'approved', 'revoked', 'suspended', 'archived']
    const results = await Promise.all(
      statuses.map(s =>
        fetch(`/api/super-admin/institutes?status=${s}`, { headers: { Authorization: `Bearer ${getToken()}` } })
          .then(r => r.json()).then(d => [s, Array.isArray(d) ? d.length : 0])
      )
    )
    setCounts(Object.fromEntries(results))
  }

  useEffect(() => { load(tab); loadCounts() }, [tab])

  async function updateStatus(id: string, status: string, statusReason?: string) {
    setActionLoading(id)
    await fetch('/api/super-admin/institutes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ id, status, reason: statusReason }),
    })
    setActionLoading(null)
    setReasonModal(null)
    setReason('')
    load(tab)
    loadCounts()
  }

  async function hardDelete(id: string) {
    setActionLoading(id)
    await fetch('/api/super-admin/institutes', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ id }),
    })
    setActionLoading(null)
    setDeleteConfirm(null)
    load(tab)
    loadCounts()
  }

  function openReasonModal(inst: Institute, nextStatus: string) {
    setReasonModal({ id: inst.id, name: inst.name, nextStatus })
    setReason('')
  }

  const tabs: Tab[] = ['pending', 'approved', 'revoked', 'suspended', 'archived']

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 px-6 py-4 flex items-center justify-between shadow">
        <div>
          <h1 className="font-bold text-lg">Super Admin Dashboard</h1>
          <p className="text-gray-400 text-xs">Institute management</p>
        </div>
        <div className="flex items-center gap-3">
          <a href="/super-admin/overview"
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <span className="hidden sm:inline">Institute </span>Oversight
          </a>
          <button onClick={() => { localStorage.removeItem('sa_token'); router.push('/super-admin/login') }}
            className="text-sm text-gray-400 hover:text-white">
            <span className="hidden sm:inline">Sign </span>Out
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 px-4 pt-5 pb-1 overflow-x-auto scrollbar-hide">
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
              tab === t ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}>
            {STATUS_LABELS[t]}
            {counts[t] > 0 && (
              <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${tab === t ? 'bg-indigo-500' : 'bg-gray-700'}`}>
                {counts[t]}
              </span>
            )}
          </button>
        ))}
      </div>

      <main className="p-6 max-w-4xl mx-auto space-y-3">
        {loading && <p className="text-gray-400 text-sm text-center py-10">Loading...</p>}

        {!loading && institutes.length === 0 && (
          <p className="text-gray-500 text-sm text-center py-10">No {STATUS_LABELS[tab].toLowerCase()} institutes.</p>
        )}

        {institutes.map(inst => (
          <div key={inst.id} className="bg-gray-800 rounded-xl p-5 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold text-white">{inst.name}</p>
                <p className="text-sm text-gray-400">{inst.email} · {inst.phone}</p>
                {inst.address && <p className="text-xs text-gray-500 mt-0.5">{inst.address}</p>}
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 ${STATUS_COLORS[inst.status]}`}>
                {STATUS_LABELS[inst.status]}
              </span>
            </div>

            {inst.status_reason && (
              <p className="text-xs text-gray-400 bg-gray-700/50 rounded-lg px-3 py-2">
                <span className="text-gray-500">Reason: </span>{inst.status_reason}
              </p>
            )}

            <p className="text-xs text-gray-500">
              Registered: {new Date(inst.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>

            {inst.status === 'approved' && (
              <a href={`/super-admin/overview?institute_id=${inst.id}`}
                className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                View Institute Data
              </a>
            )}

            {/* Action buttons per status */}
            <div className="flex flex-wrap gap-2 pt-1">
              {inst.status === 'pending' && (
                <>
                  <button onClick={() => updateStatus(inst.id, 'approved')}
                    disabled={actionLoading === inst.id}
                    className="bg-green-600 text-white text-xs px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50">
                    Approve
                  </button>
                  <button onClick={() => openReasonModal(inst, 'revoked')}
                    disabled={actionLoading === inst.id}
                    className="bg-orange-600 text-white text-xs px-4 py-2 rounded-lg hover:bg-orange-700 disabled:opacity-50">
                    Reject
                  </button>
                </>
              )}
              {inst.status === 'approved' && (
                <button onClick={() => openReasonModal(inst, 'revoked')}
                  disabled={actionLoading === inst.id}
                  className="bg-orange-600 text-white text-xs px-4 py-2 rounded-lg hover:bg-orange-700 disabled:opacity-50">
                  Revoke Access
                </button>
              )}
              {inst.status === 'revoked' && (
                <>
                  <button onClick={() => updateStatus(inst.id, 'approved')}
                    disabled={actionLoading === inst.id}
                    className="bg-green-600 text-white text-xs px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50">
                    Reinstate
                  </button>
                  <button onClick={() => openReasonModal(inst, 'suspended')}
                    disabled={actionLoading === inst.id}
                    className="bg-red-600 text-white text-xs px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50">
                    Escalate to Suspend
                  </button>
                </>
              )}
              {inst.status === 'suspended' && (
                <>
                  <button onClick={() => updateStatus(inst.id, 'approved')}
                    disabled={actionLoading === inst.id}
                    className="bg-green-600 text-white text-xs px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50">
                    Reinstate
                  </button>
                  <button onClick={() => openReasonModal(inst, 'archived')}
                    disabled={actionLoading === inst.id}
                    className="bg-gray-600 text-white text-xs px-4 py-2 rounded-lg hover:bg-gray-500 disabled:opacity-50">
                    Archive
                  </button>
                </>
              )}
              {inst.status === 'archived' && (
                <button onClick={() => setDeleteConfirm({ id: inst.id, name: inst.name })}
                  disabled={actionLoading === inst.id}
                  className="bg-red-800 text-white text-xs px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50">
                  Permanently Delete
                </button>
              )}
            </div>
          </div>
        ))}
      </main>

      {/* Reason Modal */}
      {reasonModal && (
        <div className="fixed inset-0 bg-black/60 flex items-end justify-center z-50">
          <div className="bg-gray-800 rounded-t-2xl p-6 w-full max-w-xl space-y-4 pb-safe">
            <h2 className="font-semibold text-white">
              {reasonModal.nextStatus === 'revoked' ? 'Revoke / Reject' :
               reasonModal.nextStatus === 'suspended' ? 'Suspend' : 'Archive'} — {reasonModal.name}
            </h2>
            <textarea
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              rows={3}
              placeholder="Reason (optional)"
              value={reason}
              onChange={e => setReason(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                onClick={() => updateStatus(reasonModal.id, reasonModal.nextStatus, reason)}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-700">
                Confirm
              </button>
              <button onClick={() => setReasonModal(null)}
                className="flex-1 bg-gray-700 text-gray-300 py-2 rounded-lg text-sm hover:bg-gray-600">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hard Delete Confirm Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-end justify-center z-50">
          <div className="bg-gray-800 rounded-t-2xl p-6 w-full max-w-xl space-y-4 pb-safe">
            <h2 className="font-semibold text-white text-red-400">Permanent Deletion</h2>
            <p className="text-sm text-gray-300">
              This will permanently delete <span className="font-semibold text-white">{deleteConfirm.name}</span> and all associated teachers, students, batches, and attendance records.
              <span className="block mt-2 text-red-400 font-medium">This cannot be undone.</span>
            </p>
            <div className="flex gap-2">
              <button onClick={() => hardDelete(deleteConfirm.id)}
                className="flex-1 bg-red-700 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-600">
                Delete Forever
              </button>
              <button onClick={() => setDeleteConfirm(null)}
                className="flex-1 bg-gray-700 text-gray-300 py-2 rounded-lg text-sm hover:bg-gray-600">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
