import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabase'
import { sendTelegramMessage } from '@/lib/telegram'

export async function POST(req: NextRequest) {
  try {
    const { name, phone, email, password, address } = await req.json()

    if (!name || !phone || !email || !password) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }

    const { data: existing } = await supabaseAdmin
      .from('institutes')
      .select('id')
      .eq('email', email)
      .single()

    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const { data: institute, error } = await supabaseAdmin
      .from('institutes')
      .insert({ name, phone, email, password: hashedPassword, address, status: 'pending' })
      .select()
      .single()

    if (error) throw error

    // Notify super admin on Telegram
    const superAdminChatId = process.env.SUPER_ADMIN_TELEGRAM_CHAT_ID
    if (superAdminChatId) {
      await sendTelegramMessage(
        superAdminChatId,
        `🆕 <b>New Institute Registration</b>\n\n<b>${name}</b>\n📞 ${phone}\n📧 ${email}\n\nLogin to approve: /super-admin`
      )
    }

    return NextResponse.json({ message: 'Registration successful. Your account is under review. You will be notified once approved.' })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 })
  }
}
