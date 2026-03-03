'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Batch = { id: string; name: string; subject: string; schedule: string }

export default function TeacherDashboard() {
  const router = useRouter()
  const [batches, setBatches] = useState<Batch[]>([])
  const [teacher, setTeacher] = useState<{ name: string } | null>(null)
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })

  function getToken() { return localStorage.getItem('token') || '' }

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return router.push('/teacher/login')
    const t = localStorage.getItem('teacher')
    if (t) setTeacher(JSON.parse(t))

    fetch('/api/batches', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => { if (r.status === 401) router.push('/teacher/login'); return r.json() })
      .then(setBatches)
  }, [router])

  function logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('teacher')
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm px-4 py-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">Good morning</p>
          <h1 className="font-bold text-gray-900">{teacher?.name || 'Teacher'}</h1>
        </div>
        <button onClick={logout} className="text-sm text-red-600 hover:underline">Logout</button>
      </header>

      <main className="p-4 max-w-xl mx-auto">
        <p className="text-sm text-gray-500 mb-4">{today}</p>

        <div className="flex justify-between items-center mb-3">
          <h2 className="font-semibold text-gray-800">Your Batches</h2>
          <Link href="/teacher/alerts"
            className="text-sm bg-orange-500 text-white px-3 py-1.5 rounded-lg hover:bg-orange-600">
            Send Alert
          </Link>
        </div>

        <div className="space-y-3">
          {batches.map(b => (
            <div key={b.id} className="bg-white rounded-xl shadow-sm p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900">{b.name}</p>
                <p className="text-sm text-gray-500">{b.subject}</p>
                {b.schedule && <p className="text-xs text-gray-400 mt-0.5">{b.schedule}</p>}
              </div>
              <Link
                href={`/teacher/attendance?batch_id=${b.id}&batch_name=${encodeURIComponent(b.name)}`}
                className="bg-green-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-green-700 whitespace-nowrap"
              >
                Mark
              </Link>
            </div>
          ))}
          {batches.length === 0 && (
            <p className="text-center text-gray-400 py-12">No batches assigned to you yet.</p>
          )}
        </div>
      </main>
    </div>
  )
}
