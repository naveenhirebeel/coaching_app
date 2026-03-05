import Link from 'next/link'

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center space-y-6 p-8">
        <h1 className="text-4xl font-bold text-gray-900">CoachingBuddy</h1>
        <p className="text-gray-500 text-lg">Attendance management for coaching institutes</p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
          <Link
            href="/admin/login"
            className="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700 transition"
          >
            Admin Login
          </Link>
          <Link
            href="/teacher/login"
            className="bg-green-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-green-700 transition"
          >
            Teacher Login
          </Link>
        </div>
        <p className="text-sm text-gray-400 mt-4">
          New institute?{' '}
          <Link href="/admin/register" className="text-blue-600 hover:underline">
            Apply for access
          </Link>
        </p>
      </div>
    </div>
  )
}
