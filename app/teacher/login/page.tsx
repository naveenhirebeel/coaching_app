'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function TeacherLoginPage() {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState<'phone' | 'otp'>('phone')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const res = await fetch('/api/auth/teacher-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) return setError(data.error)
    setMessage(data.message)
    setStep('otp')
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const res = await fetch('/api/auth/teacher-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, otp }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) return setError(data.error)
    localStorage.setItem('token', data.token)
    localStorage.setItem('teacher', JSON.stringify(data.teacher))
    router.push('/teacher/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-xl shadow p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Teacher Login</h1>
        <p className="text-gray-500 text-sm mb-6">Sign in with your phone number</p>

        {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">{error}</div>}
        {message && <div className="bg-green-50 text-green-700 text-sm px-4 py-3 rounded-lg mb-4">{message}</div>}

        {step === 'phone' ? (
          <form onSubmit={sendOtp} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="9876543210"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                required
              />
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-green-600 text-white py-2.5 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50">
              {loading ? 'Sending OTP...' : 'Send OTP via Telegram'}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyOtp} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Enter OTP</label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="000000"
                value={otp}
                onChange={e => setOtp(e.target.value)}
                maxLength={6}
                required
              />
              <p className="text-xs text-gray-400 mt-1">Check your Telegram app for the OTP</p>
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-green-600 text-white py-2.5 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50">
              {loading ? 'Verifying...' : 'Verify OTP'}
            </button>
            <button type="button" onClick={() => { setStep('phone'); setError(''); setMessage('') }}
              className="w-full border py-2.5 rounded-lg text-sm text-gray-600">
              Back
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
