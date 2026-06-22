import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendTelegramMessage, answerCallbackQuery, editMessageReplyMarkup } from '@/lib/telegram'

// Verify request is genuinely from Telegram
function verifySecret(req: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!secret) return true // skip verification if not configured
  return req.headers.get('x-telegram-bot-api-secret-token') === secret
}

// Layer 1 — in-memory burst guard: max 5 requests per chatId per minute
const burstMap = new Map<string, { count: number; windowStart: number }>()
const BURST_LIMIT = 5
const BURST_WINDOW_MS = 60_000

function isBurst(chatId: string): boolean {
  const now = Date.now()
  const entry = burstMap.get(chatId)
  if (!entry || now - entry.windowStart > BURST_WINDOW_MS) {
    burstMap.set(chatId, { count: 1, windowStart: now })
    return false
  }
  entry.count++
  return entry.count > BURST_LIMIT
}

// Format last-7-days attendance as a Telegram message
function formatAttendanceReport(students: { name: string; logs: { date: string; status: string }[] }[]): string {
  const lines: string[] = ['📊 <b>Attendance Report — Last 7 Days</b>\n']
  for (const s of students) {
    const present = s.logs.filter(l => l.status === 'present').length
    const late = s.logs.filter(l => l.status === 'late').length
    const absent = s.logs.filter(l => l.status === 'absent').length
    lines.push(`👤 <b>${s.name}</b>`)
    if (s.logs.length === 0) {
      lines.push('  No attendance recorded in last 7 days')
    } else {
      const dayLines = s.logs
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(l => {
          const icon = l.status === 'present' ? '✅' : l.status === 'late' ? '🕐' : '❌'
          const d = new Date(l.date)
          const label = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
          return `  ${icon} ${label}`
        })
      lines.push(...dayLines)
      lines.push(`  <i>P:${present} L:${late} A:${absent}</i>`)
    }
    lines.push('')
  }
  return lines.join('\n')
}

// Process a tapped inline button. Currently only "ack:<logId>" — a parent
// acknowledging an absent/alert message — is supported.
async function handleCallbackQuery(cq: NonNullable<TelegramUpdate['callback_query']>) {
  const fromId = cq.from?.id ? String(cq.from.id) : ''
  const data = cq.data || ''

  // Burst guard shared with the message path (silent drop beyond 5 taps/min)
  if (fromId && isBurst(fromId)) {
    await answerCallbackQuery(cq.id)
    return
  }

  if (data.startsWith('ack:') && fromId) {
    const logId = data.slice(4)

    // Stamp acknowledgment only on this parent's own message row.
    const { data: updated } = await supabaseAdmin
      .from('telegram_message_log')
      .update({ acknowledged_at: new Date().toISOString(), acknowledged_by_chat_id: fromId })
      .eq('id', logId)
      .eq('recipient_telegram_chat_id', fromId)
      .is('acknowledged_at', null)
      .select('id')

    await answerCallbackQuery(cq.id, updated && updated.length > 0 ? 'Thanks! 👍' : 'Already acknowledged ✓')

    // Swap the button for a non-clickable label so it can't be tapped again.
    const chatId = cq.message?.chat?.id
    const messageId = cq.message?.message_id
    if (chatId != null && messageId != null) {
      await editMessageReplyMarkup(String(chatId), messageId, {
        inline_keyboard: [[{ text: '✅ Acknowledged', callback_data: 'acked' }]],
      })
    }
    return
  }

  // Unknown callback — clear the spinner silently.
  await answerCallbackQuery(cq.id)
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

  // --- Handle callback_query — parent tapped an inline button (e.g. "👍 Got it") ---
  if (update.callback_query) {
    await handleCallbackQuery(update.callback_query)
    return NextResponse.json({ ok: true })
  }

  const message = update.message
  console.log('[webhook] received update', JSON.stringify(update).slice(0, 500))
  console.log('[webhook] message text:', message?.text, 'chat id:', message?.chat?.id)
  if (!message?.text || !message.chat?.id) {
    console.log('[webhook] early exit - no text or chat id')
    return NextResponse.json({ ok: true })
  }

  const chatId = String(message.chat.id)
  const text = message.text.trim()

  // Layer 1 — burst guard (silent drop beyond 5 req/min per chat)
  if (isBurst(chatId)) return NextResponse.json({ ok: true })

  // --- Handle /report — parent requests last 7 days attendance ---
  if (text === '/report') {
    // Find all students linked to this chat ID
    const { data: linkedStudents } = await supabaseAdmin
      .from('students')
      .select('id, name, institute_id')
      .or(`parent_telegram_chat_id.eq.${chatId},parent2_telegram_chat_id.eq.${chatId}`)

    if (!linkedStudents || linkedStudents.length === 0) {
      await sendTelegramMessage(chatId, `❌ Your Telegram is not linked to any student. Please use the link shared by your institute.`)
      return NextResponse.json({ ok: true })
    }

    // Layer 2 — DB once-per-day check (per parent chat ID)
    const today = new Date().toISOString().slice(0, 10)
    const { data: existing } = await supabaseAdmin
      .from('parent_report_requests')
      .select('id')
      .eq('chat_id', chatId)
      .eq('requested_date', today)
      .maybeSingle()

    if (existing) {
      await sendTelegramMessage(chatId, `⏳ You've already requested a report today. Please try again tomorrow.`)
      return NextResponse.json({ ok: true })
    }

    // Log this request
    await supabaseAdmin.from('parent_report_requests').insert({ chat_id: chatId, requested_date: today })

    // Fetch last 7 days attendance for each linked student
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const studentIds = linkedStudents.map(s => s.id)

    const { data: attendance } = await supabaseAdmin
      .from('attendance')
      .select('student_id, date, status')
      .in('student_id', studentIds)
      .gte('date', sevenDaysAgo)
      .order('date', { ascending: true })

    const studentsWithLogs = linkedStudents.map(s => ({
      name: s.name,
      logs: (attendance || []).filter(a => a.student_id === s.id),
    }))

    await sendTelegramMessage(chatId, formatAttendanceReport(studentsWithLogs))
    return NextResponse.json({ ok: true })
  }

  // --- Handle /start with deep link parameter (parent linking) ---
  if (text.startsWith('/start')) {
    const param = text.split(/[ =]/)[1] || ''

    if (param.startsWith('p_') || param.startsWith('p2_')) {
      const isParent2 = param.startsWith('p2_')
      const studentId = param.slice(isParent2 ? 3 : 2)
      const field = isParent2 ? 'parent2_telegram_chat_id' : 'parent_telegram_chat_id'

      const { data: student } = await supabaseAdmin
        .from('students')
        .select('id, name, parent_name, parent2_name')
        .eq('id', studentId)
        .single()

      if (student) {
        const { error: updateError } = await supabaseAdmin
          .from('students')
          .update({ [field]: chatId })
          .eq('id', studentId)

        console.log('[webhook] parent link update', { studentId, chatId, field, updateError })

        await sendTelegramMessage(
          chatId,
          `✅ <b>Linked successfully!</b>\n\nYou will now receive attendance alerts for <b>${student.name}</b> on this chat.`
        )
        return NextResponse.json({ ok: true })
      } else {
        console.log('[webhook] student not found', { studentId })
        await sendTelegramMessage(
          chatId,
          `❌ <b>Link expired or invalid.</b>\n\nPlease ask the institute for a fresh link.`
        )
        return NextResponse.json({ ok: true })
      }
    }

    // /start with no param or unknown param — send teacher instructions
    await sendTelegramMessage(
      chatId,
      `👋 <b>Welcome to CoachingBuddy!</b>\n\nSend your registered 10-digit mobile number to link your account.\n\nExample: <code>9876543210</code>`
    )
    return NextResponse.json({ ok: true })
  }

  // --- Handle phone number (teacher or parent linking) ---
  const phoneMatch = text.match(/^[6-9]\d{9}$/) // Indian 10-digit mobile
  if (phoneMatch) {
    const phone = text

    // Check teacher first
    const { data: teacher } = await supabaseAdmin
      .from('teachers')
      .select('id, name, telegram_chat_id')
      .eq('phone', phone)
      .single()

    if (teacher) {
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

    // Check if this is a registered parent mobile
    const { data: parentStudents } = await supabaseAdmin
      .from('students')
      .select('id, name, parent_mobile, parent2_mobile')
      .or(`parent_mobile.eq.${phone},parent2_mobile.eq.${phone}`)

    if (parentStudents && parentStudents.length > 0) {
      // Link all students for this parent
      const linkedNames: string[] = []
      const updateTasks: (() => Promise<void>)[] = []

      for (const student of parentStudents) {
        if (student.parent_mobile === phone) {
          const id = student.id
          updateTasks.push(async () => { await supabaseAdmin.from('students').update({ parent_telegram_chat_id: chatId }).eq('id', id) })
        }
        if (student.parent2_mobile === phone) {
          const id = student.id
          updateTasks.push(async () => { await supabaseAdmin.from('students').update({ parent2_telegram_chat_id: chatId }).eq('id', id) })
        }
        linkedNames.push(student.name)
      }

      await Promise.all(updateTasks.map(t => t()))

      const nameList = linkedNames.map(n => `• ${n}`).join('\n')
      await sendTelegramMessage(
        chatId,
        `✅ <b>Linked successfully!</b>\n\nYou will now receive attendance alerts for:\n${nameList}`
      )
      return NextResponse.json({ ok: true })
    }

    // No teacher or parent found
    await sendTelegramMessage(
      chatId,
      `❌ No account found with phone number <code>${phone}</code>. Please check with your institute.`
    )
    return NextResponse.json({ ok: true })
  }

  // --- Unknown message ---
  await sendTelegramMessage(
    chatId,
    `ℹ️ <b>Available commands:</b>\n\n/report — Get last 7 days attendance (once per day)\n\nTo link your account, send your registered 10-digit mobile number.\nExample: <code>9876543210</code>`
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
  // Explicitly allow callback_query so parent "👍 Got it" button taps are
  // delivered (alongside normal messages). Omitting this reuses Telegram's
  // previous setting, which could silently exclude callback_query.
  const body: Record<string, unknown> = {
    url: webhookUrl,
    allowed_updates: ['message', 'callback_query'],
  }
  if (secret) body.secret_token = secret

  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()

  // Echo the resulting webhook config (server-side getWebhookInfo) so the live
  // registration — especially allowed_updates — can be verified without direct
  // access to the Telegram API from the caller.
  let webhookInfo: unknown = null
  try {
    const infoRes = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`)
    webhookInfo = (await infoRes.json())?.result ?? null
  } catch (err) {
    console.error('getWebhookInfo failed:', err)
  }

  return NextResponse.json({
    webhookUrl,
    telegram: data,
    webhookInfo,
  })
}

// Telegram update type (minimal)
type TelegramUpdate = {
  message?: {
    text?: string
    chat?: { id: number }
  }
  callback_query?: {
    id: string
    data?: string
    from?: { id: number }
    message?: {
      message_id: number
      chat?: { id: number }
    }
  }
}
