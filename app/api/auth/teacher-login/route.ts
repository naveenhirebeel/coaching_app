import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { signToken } from '@/lib/auth'
import { sendTelegramMessage } from '@/lib/telegram'
import bcrypt from 'bcryptjs'

// In-memory OTP store (use Redis in production)
const otpStore = new Map<string, { otp: string; expires: number }>()

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { phone, otp, email, password } = body

    // ── Email + Password login ──────────────────────────────────────────────
    if (email && password) {
      const { data: teacher } = await supabaseAdmin
        .from('teachers')
        .select('*, institutes(status)')
        .eq('email', email)
        .single()

      if (!teacher || !teacher.password_hash) {
        return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
      }

      const instituteStatus = (teacher.institutes as { status: string } | null)?.status
      if (instituteStatus !== 'approved') {
        return NextResponse.json({ error: 'Your institute account is not active.' }, { status: 403 })
      }

      const valid = await bcrypt.compare(password, teacher.password_hash)
      if (!valid) {
        return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
      }

      const token = signToken({ id: teacher.id, role: 'teacher', institute_id: teacher.institute_id })
      return NextResponse.json({
        token,
        teacher: { id: teacher.id, name: teacher.name, institute_id: teacher.institute_id },
      })
    }

    // ── OTP login ───────────────────────────────────────────────────────────
    if (!phone) {
      return NextResponse.json({ error: 'Phone or email is required' }, { status: 400 })
    }

    // Step 1: Send OTP
    if (!otp) {
      const { data: teacher } = await supabaseAdmin
        .from('teachers')
        .select('*, institutes(status)')
        .eq('phone', phone)
        .single()

      if (!teacher) {
        return NextResponse.json({ error: 'Teacher not found' }, { status: 404 })
      }

      const instituteStatus = (teacher.institutes as { status: string } | null)?.status
      if (instituteStatus !== 'approved') {
        return NextResponse.json({ error: 'Your institute account is not active. Please contact your admin.' }, { status: 403 })
      }

      if (!teacher.telegram_chat_id) {
        return NextResponse.json({ error: 'Telegram not connected. Ask admin to set up your Telegram.' }, { status: 400 })
      }

      const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString()
      otpStore.set(phone, { otp: generatedOtp, expires: Date.now() + 5 * 60 * 1000 })

      await sendTelegramMessage(
        teacher.telegram_chat_id,
        `🔐 Your login OTP is: <b>${generatedOtp}</b>\n\nValid for 5 minutes.`
      )

      return NextResponse.json({ message: 'OTP sent to your Telegram' })
    }

    // Step 2: Verify OTP
    const record = otpStore.get(phone)
    if (!record || record.otp !== otp || Date.now() > record.expires) {
      return NextResponse.json({ error: 'Invalid or expired OTP' }, { status: 401 })
    }

    otpStore.delete(phone)

    const { data: teacher } = await supabaseAdmin
      .from('teachers')
      .select('*')
      .eq('phone', phone)
      .single()

    const token = signToken({ id: teacher.id, role: 'teacher', institute_id: teacher.institute_id })

    return NextResponse.json({
      token,
      teacher: { id: teacher.id, name: teacher.name, institute_id: teacher.institute_id },
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}
