import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendTelegramMessage } from '@/lib/telegram'

// Verify request is genuinely from Telegram
function verifySecret(req: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!secret) return true // skip verification if not configured
  return req.headers.get('x-telegram-bot-api-secret-token') === secret
}

export async function POST(req: NextRequest) {
  if (!verifySecret(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let update: TelegramUpdate
  try {
    update = await req.json()
  } catch {
    return NextResponse.json({ ok: true }) // always return 200 to Telegram
  }

  const message = update.message
  if (!message?.text || !message.chat?.id) {
    return NextResponse.json({ ok: true })
  }

  const chatId = String(message.chat.id)
  const text = message.text.trim()

  // --- Handle /start with deep link parameter (parent linking) ---
  if (text.startsWith('/start')) {
    const param = text.split(' ')[1] || ''

    if (param.startsWith('p_')) {
      const studentId = param.slice(2)
      const { data: student } = await supabaseAdmin
        .from('students')
        .select('id, name, parent_name')
        .eq('id', studentId)
        .single()

      if (student) {
        await supabaseAdmin
          .from('students')
          .update({ parent_telegram_chat_id: chatId })
          .eq('id', studentId)

        await sendTelegramMessage(
          chatId,
          `✅ <b>Linked successfully!</b>\n\nYou will now receive attendance alerts for <b>${student.name}</b> on this chat.`
        )
        return NextResponse.json({ ok: true })
      }
    }

    // /start with no param or unknown param — send teacher instructions
    await sendTelegramMessage(
      chatId,
      `👋 <b>Welcome to CoachingBuddy!</b>\n\nIf you are a <b>teacher</b>, send your registered phone number (digits only) to link your account.\n\nExample: <code>9876543210</code>`
    )
    return NextResponse.json({ ok: true })
  }

  // --- Handle phone number (teacher linking) ---
  const phoneMatch = text.match(/^[6-9]\d{9}$/) // Indian 10-digit mobile
  if (phoneMatch) {
    const phone = text

    const { data: teacher } = await supabaseAdmin
      .from('teachers')
      .select('id, name, telegram_chat_id')
      .eq('phone', phone)
      .single()

    if (!teacher) {
      await sendTelegramMessage(
        chatId,
        `❌ No teacher found with phone number <code>${phone}</code>. Please check with your admin.`
      )
      return NextResponse.json({ ok: true })
    }

    if (teacher.telegram_chat_id && teacher.telegram_chat_id !== chatId) {
      // Already linked to a different chat — update it
    }

    await supabaseAdmin
      .from('teachers')
      .update({ telegram_chat_id: chatId })
      .eq('id', teacher.id)

    await sendTelegramMessage(
      chatId,
      `✅ <b>Linked successfully!</b>\n\nHi <b>${teacher.name}</b>, your Telegram is now connected to CoachingBuddy. You will receive OTPs and notifications here.`
    )
    return NextResponse.json({ ok: true })
  }

  // --- Unknown message ---
  await sendTelegramMessage(
    chatId,
    `ℹ️ To link your account:\n\n• <b>Teachers:</b> Send your 10-digit phone number\n• <b>Parents:</b> Use the link provided by your institute`
  )

  return NextResponse.json({ ok: true })
}

// One-time webhook registration with Telegram
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')

  if (action !== 'setup') {
    return NextResponse.json({ error: 'Use ?action=setup' }, { status: 400 })
  }

  const token = process.env.TELEGRAM_BOT_TOKEN
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET

  if (!token || !appUrl) {
    return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN and NEXT_PUBLIC_APP_URL must be set' }, { status: 500 })
  }

  const webhookUrl = `${appUrl}/api/telegram-webhook`
  const body: Record<string, string> = { url: webhookUrl }
  if (secret) body.secret_token = secret

  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()

  return NextResponse.json({
    webhookUrl,
    telegram: data,
  })
}

// Telegram update type (minimal)
type TelegramUpdate = {
  message?: {
    text?: string
    chat?: { id: number }
  }
}
