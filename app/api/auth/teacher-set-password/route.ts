import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendTelegramMessage } from '@/lib/telegram'
import bcrypt from 'bcryptjs'

// Shared OTP store for set-password flow (use Redis in production)
const otpStore = new Map<string, { otp: string; expires: number; teacherId: string }>()

export async function POST(req: NextRequest) {
  try {
    const { phone, otp, email, password } = await req.json()

    if (!phone) {
      return NextResponse.json({ error: 'Phone is required' }, { status: 400 })
    }

    // Step 1: Send OTP to verify identity
    if (!otp) {
      const { data: teacher } = await supabaseAdmin
        .from('teachers')
        .select('id, telegram_chat_id, institutes(status)')
        .eq('phone', phone)
        .single()

      if (!teacher) {
        return NextResponse.json({ error: 'Teacher not found' }, { status: 404 })
      }

      const instituteStatus = (teacher.institutes as unknown as { status: string } | null)?.status
      if (instituteStatus !== 'approved') {
        return NextResponse.json({ error: 'Your institute account is not active.' }, { status: 403 })
      }

      if (!teacher.telegram_chat_id) {
        return NextResponse.json({ error: 'Telegram not connected. Ask admin to set up your Telegram.' }, { status: 400 })
      }

      const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString()
      otpStore.set(phone, { otp: generatedOtp, expires: Date.now() + 5 * 60 * 1000, teacherId: teacher.id })

      await sendTelegramMessage(
        teacher.telegram_chat_id,
        `🔐 Your password setup OTP is: <b>${generatedOtp}</b>\n\nValid for 5 minutes.`
      )

      return NextResponse.json({ message: 'OTP sent to your Telegram' })
    }

    // Step 2: Verify OTP + set email and password
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    const record = otpStore.get(phone)
    if (!record || record.otp !== otp || Date.now() > record.expires) {
      return NextResponse.json({ error: 'Invalid or expired OTP' }, { status: 401 })
    }

    otpStore.delete(phone)

    // Check email not already used by another teacher
    const { data: existing } = await supabaseAdmin
      .from('teachers')
      .select('id')
      .eq('email', email)
      .neq('id', record.teacherId)
      .single()

    if (existing) {
      return NextResponse.json({ error: 'This email is already in use by another teacher' }, { status: 409 })
    }

    const password_hash = await bcrypt.hash(password, 12)

    const { error } = await supabaseAdmin
      .from('teachers')
      .update({ email, password_hash })
      .eq('id', record.teacherId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, message: 'Password set successfully. You can now log in with email and password.' })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to set password' }, { status: 500 })
  }
}
