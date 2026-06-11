'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Tab = 'password' | 'otp'
type SetPasswordStep = 'phone' | 'otp' | 'set'

export default function TeacherLoginPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('password')

  // ── Email + Password state ──────────────────────────────────────────────
  const [pwForm, setPwForm] = useState({ email: '', password: '' })
  const [pwLoading, setPwLoading] = useState(false)
  const [pwError, setPwError] = useState('')

  // ── OTP state ───────────────────────────────────────────────────────────
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [otpStep, setOtpStep] = useState<'phone' | 'otp'>('phone')
  const [otpLoading, setOtpLoading] = useState(false)
  const [otpError, setOtpError] = useState('')
  const [otpMessage, setOtpMessage] = useState('')

  // ── Set / Reset password state ──────────────────────────────────────────
  const [showSetPassword, setShowSetPassword] = useState(false)
  const [spStep, setSpStep] = useState<SetPasswordStep>('phone')
  const [spPhone, setSpPhone] = useState('')
  const [spOtp, setSpOtp] = useState('')
  const [spEmail, setSpEmail] = useState('')
  const [spPassword, setSpPassword] = useState('')
  const [spConfirm, setSpConfirm] = useState('')
  const [spLoading, setSpLoading] = useState(false)
  const [spError, setSpError] = useState('')
  const [spMessage, setSpMessage] = useState('')

  // ── Email + Password login ──────────────────────────────────────────────
  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault()
    setPwLoading(true); setPwError('')
    const res = await fetch('/api/auth/teacher-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: pwForm.email, password: pwForm.password }),
    })
    const data = await res.json()
    setPwLoading(false)
    if (!res.ok) return setPwError(data.error)
    localStorage.setItem('token', data.token)
    localStorage.setItem('teacher', JSON.stringify(data.teacher))
    router.push('/teacher/dashboard')
  }

  // ── OTP login ───────────────────────────────────────────────────────────
  async function sendOtp(e: React.FormEvent) {
    e.preventDefault()
    setOtpLoading(true); setOtpError('')
    const res = await fetch('/api/auth/teacher-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    })
    const data = await res.json()
    setOtpLoading(false)
    if (!res.ok) return setOtpError(data.error)
    setOtpMessage(data.message)
    setOtpStep('otp')
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault()
    setOtpLoading(true); setOtpError('')
    const res = await fetch('/api/auth/teacher-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, otp }),
    })
    const data = await res.json()
    setOtpLoading(false)
    if (!res.ok) return setOtpError(data.error)
    localStorage.setItem('token', data.token)
    localStorage.setItem('teacher', JSON.stringify(data.teacher))
    router.push('/teacher/dashboard')
  }

  // ── Set / Reset password ────────────────────────────────────────────────
  async function spSendOtp(e: React.FormEvent) {
    e.preventDefault()
    setSpLoading(true); setSpError('')
    const res = await fetch('/api/auth/teacher-set-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: spPhone }),
    })
    const data = await res.json()
    setSpLoading(false)
    if (!res.ok) return setSpError(data.error)
    setSpMessage(data.message)
    setSpStep('otp')
  }

  async function spVerifyOtp(e: React.FormEvent) {
    e.preventDefault()
    setSpLoading(true); setSpError('')
    // Just advance to set step — OTP will be verified when setting the password
    setSpLoading(false)
    setSpStep('set')
  }

  async function spSetPassword(e: React.FormEvent) {
    e.preventDefault()
    if (spPassword !== spConfirm) return setSpError('Passwords do not match')
    setSpLoading(true); setSpError('')
    const res = await fetch('/api/auth/teacher-set-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: spPhone, otp: spOtp, email: spEmail, password: spPassword }),
    })
    const data = await res.json()
    setSpLoading(false)
    if (!res.ok) return setSpError(data.error)
    setSpMessage(data.message)
    // Reset and go back to login after short delay
    setTimeout(() => {
      setShowSetPassword(false)
      setSpStep('phone'); setSpPhone(''); setSpOtp(''); setSpEmail(''); setSpPassword(''); setSpConfirm('')
      setSpError(''); setSpMessage('')
      setTab('password')
    }, 2000)
  }

  function resetSetPassword() {
    setShowSetPassword(false)
    setSpStep('phone'); setSpPhone(''); setSpOtp(''); setSpEmail(''); setSpPassword(''); setSpConfirm('')
    setSpError(''); setSpMessage('')
  }

  // ── Set Password Modal ──────────────────────────────────────────────────
  if (showSetPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-xl shadow p-8 w-full max-w-sm">
          <button onClick={resetSetPassword} className="text-sm text-gray-400 hover:text-gray-600 mb-4 flex items-center gap-1">
            ← Back to login
          </button>
          <h1 className="text-xl font-bold text-gray-900 mb-1">Set / Reset Password</h1>
          <p className="text-gray-500 text-xs mb-6">Verify via Telegram OTP, then set your email and password.</p>

          {spError && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">{spError}</div>}
          {spMessage && <div className="bg-green-50 text-green-700 text-sm px-4 py-3 rounded-lg mb-4">{spMessage}</div>}

          {spStep === 'phone' && (
            <form onSubmit={spSendOtp} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="9876543210"
                  value={spPhone}
                  onChange={e => setSpPhone(e.target.value)}
                  required
                />
              </div>
              <button type="submit" disabled={spLoading}
                className="w-full bg-green-600 text-white py-2.5 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50">
                {spLoading ? 'Sending OTP...' : 'Send OTP via Telegram'}
              </button>
            </form>
          )}

          {spStep === 'otp' && (
            <form onSubmit={spVerifyOtp} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Enter OTP</label>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="000000"
                  value={spOtp}
                  onChange={e => setSpOtp(e.target.value)}
                  maxLength={6}
                  required
                />
                <p className="text-xs text-gray-400 mt-1">Check your Telegram app for the OTP</p>
              </div>
              <button type="submit" disabled={spLoading}
                className="w-full bg-green-600 text-white py-2.5 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50">
                {spLoading ? 'Verifying...' : 'Continue'}
              </button>
              <button type="button" onClick={() => { setSpStep('phone'); setSpError(''); setSpMessage('') }}
                className="w-full border py-2.5 rounded-lg text-sm text-gray-600">Back</button>
            </form>
          )}

          {spStep === 'set' && (
            <form onSubmit={spSetPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <input
                  type="email"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="you@example.com"
                  value={spEmail}
                  onChange={e => setSpEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <input
                  type="password"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Min. 8 characters"
                  value={spPassword}
                  onChange={e => setSpPassword(e.target.value)}
                  minLength={8}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                <input
                  type="password"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Re-enter password"
                  value={spConfirm}
                  onChange={e => setSpConfirm(e.target.value)}
                  required
                />
              </div>
              <button type="submit" disabled={spLoading}
                className="w-full bg-green-600 text-white py-2.5 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50">
                {spLoading ? 'Saving...' : 'Set Password'}
              </button>
            </form>
          )}
        </div>
      </div>
    )
  }

  // ── Main Login Page ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-xl shadow p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Teacher Login</h1>
        <p className="text-gray-500 text-sm mb-6">Sign in to your account</p>

        {/* Tab switcher */}
        <div className="flex bg-gray-100 rounded-lg p-1 mb-6">
          <button
            onClick={() => setTab('password')}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition ${
              tab === 'password' ? 'bg-white shadow text-gray-900' : 'text-gray-500'
            }`}>
            Email & Password
          </button>
          <button
            onClick={() => setTab('otp')}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition ${
              tab === 'otp' ? 'bg-white shadow text-gray-900' : 'text-gray-500'
            }`}>
            OTP via Telegram
          </button>
        </div>

        {/* Email + Password tab */}
        {tab === 'password' && (
          <>
            {pwError && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">{pwError}</div>}
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="you@example.com"
                  value={pwForm.email}
                  onChange={e => setPwForm({ ...pwForm, email: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Your password"
                  value={pwForm.password}
                  onChange={e => setPwForm({ ...pwForm, password: e.target.value })}
                  required
                />
              </div>
              <button type="submit" disabled={pwLoading}
                className="w-full bg-green-600 text-white py-2.5 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50">
                {pwLoading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
            <button
              onClick={() => setShowSetPassword(true)}
              className="w-full text-center text-sm text-green-600 hover:underline mt-4">
              Forgot / Set Password?
            </button>
          </>
        )}

        {/* OTP tab */}
        {tab === 'otp' && (
          <>
            {otpError && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">{otpError}</div>}
            {otpMessage && <div className="bg-green-50 text-green-700 text-sm px-4 py-3 rounded-lg mb-4">{otpMessage}</div>}

            {otpStep === 'phone' ? (
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
                <button type="submit" disabled={otpLoading}
                  className="w-full bg-green-600 text-white py-2.5 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50">
                  {otpLoading ? 'Sending OTP...' : 'Send OTP via Telegram'}
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
                <button type="submit" disabled={otpLoading}
                  className="w-full bg-green-600 text-white py-2.5 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50">
                  {otpLoading ? 'Verifying...' : 'Verify OTP'}
                </button>
                <button type="button" onClick={() => { setOtpStep('phone'); setOtpError(''); setOtpMessage('') }}
                  className="w-full border py-2.5 rounded-lg text-sm text-gray-600">Back</button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  )
}
