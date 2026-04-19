'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import AdminBottomNav from '@/components/AdminBottomNav'

export default function AdminDashboard() {
  const router = useRouter()
  const [institute, setInstitute] = useState<{ name: string } | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return router.push('/admin/login')
    const inst = localStorage.getItem('institute')
    if (inst) setInstitute(JSON.parse(inst))
  }, [router])

  function logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('institute')
    router.push('/')
  }

  const sections = [
    { label: 'Batches', desc: 'Manage class batches and schedules', href: '/admin/batches', color: 'bg-blue-500' },
    { label: 'Teachers', desc: 'Add and manage teachers', href: '/admin/teachers', color: 'bg-purple-500' },
    { label: 'Students', desc: 'Enroll and manage students', href: '/admin/students', color: 'bg-green-500' },
    { label: 'Reports', desc: 'View attendance reports', href: '/admin/reports', color: 'bg-orange-500' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="CoachingBuddy"
        subtitle={institute?.name}
        right={<button onClick={logout} className="text-sm text-red-600 hover:underline">Logout</button>}
      />

      <main className="p-4 max-w-2xl mx-auto pb-24">
        <h2 className="text-xl font-semibold text-gray-800 mt-4 mb-6">Admin Dashboard</h2>
        <div className="grid grid-cols-2 gap-4">
          {sections.map(s => (
            <Link
              key={s.href}
              href={s.href}
              className="bg-white rounded-xl shadow-sm p-5 hover:shadow-md transition"
            >
              <div className={`w-10 h-10 ${s.color} rounded-lg mb-3`} />
              <p className="font-semibold text-gray-900">{s.label}</p>
              <p className="text-xs text-gray-500 mt-1">{s.desc}</p>
            </Link>
          ))}
        </div>
      </main>
      <AdminBottomNav />
    </div>
  )
}
