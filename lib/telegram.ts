const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN!

// Granular delivery outcome for a single sendMessage call.
//  - delivered: Telegram accepted the message and placed it in the chat
//  - blocked:   parent blocked the bot or never pressed Start (HTTP 403)
//  - failed:    any other API error or a network failure
export type DeliveryStatus = 'delivered' | 'blocked' | 'failed'

export type SendResult = {
  ok: boolean
  status: DeliveryStatus
  messageId?: number
  error?: string
}

export async function sendTelegramMessage(
  chatId: string,
  message: string,
  options?: { replyMarkup?: object }
): Promise<SendResult> {
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML',
          ...(options?.replyMarkup ? { reply_markup: options.replyMarkup } : {}),
        }),
      }
    )
    const data = await res.json()
    if (!data.ok) {
      console.error('Telegram error:', data.description)
      const status: DeliveryStatus = data.error_code === 403 ? 'blocked' : 'failed'
      return { ok: false, status, error: data.description }
    }
    return { ok: true, status: 'delivered', messageId: data.result?.message_id }
  } catch (err) {
    console.error('Telegram send failed:', err)
    return { ok: false, status: 'failed', error: 'Network error reaching Telegram' }
  }
}

// Acknowledge a tapped inline button so the loading spinner clears and an
// optional toast is shown to the user.
export async function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackQueryId, ...(text ? { text } : {}) }),
    })
  } catch (err) {
    console.error('Telegram answerCallbackQuery failed:', err)
  }
}

// Replace the inline keyboard on an already-sent message (e.g. swap the
// "Got it" button for a disabled "Acknowledged" label after a tap).
export async function editMessageReplyMarkup(chatId: string, messageId: number, replyMarkup: object): Promise<void> {
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/editMessageReplyMarkup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId, reply_markup: replyMarkup }),
    })
  } catch (err) {
    console.error('Telegram editMessageReplyMarkup failed:', err)
  }
}

export function absentMessage(studentName: string, batchName: string, date: string, instituteName: string, institutePhone: string) {
  return `⚠️ <b>Attendance Alert</b>
🏫 ${instituteName}

<b>${studentName}</b> was marked <b>ABSENT</b> today.
📚 Batch: ${batchName}
📅 Date: ${date}
📞 Contact: ${institutePhone}`
}

export function presentMessage(studentName: string, batchName: string, date: string, instituteName: string) {
  return `✅ <b>Attendance Update</b>
🏫 ${instituteName}

<b>${studentName}</b> attended class today.
📚 Batch: ${batchName}
📅 Date: ${date}`
}

export function holidayMessage(batchName: string, message: string, instituteName: string) {
  return `🔴 <b>Alert from ${instituteName}</b>

📚 Batch: ${batchName}
${message}`
}

export function lateMessage(studentName: string, batchName: string, date: string, instituteName: string, institutePhone: string) {
  return `⏰ <b>Late Arrival Notice</b>
🏫 ${instituteName}

<b>${studentName}</b> arrived <b>LATE</b> to class today.
📚 Batch: ${batchName}
📅 Date: ${date}
📞 Contact: ${institutePhone}`
}

export function exitMessage(studentName: string, batchName: string, exitTime: string, instituteName: string) {
  return `🏠 <b>Left Class</b>
🏫 ${instituteName}

<b>${studentName}</b> has left class.
📚 Batch: ${batchName}
🕐 Left at: ${exitTime}`
}

export function reportMessage(
  studentName: string,
  batchName: string,
  instituteName: string,
  periodLabel: string,
  present: number,
  late: number,
  absent: number,
  logs: { date: string; status: string; created_at: string; marked_at?: string | null; exit_time: string | null }[]
) {
  const total = present + late + absent
  const attended = present + late
  const pct = total > 0 ? Math.round((attended / total) * 100) : 0

  const logLines = logs.map(l => {
    const d = new Date(l.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })
    const statusIcon = l.status === 'present' ? '✅' : l.status === 'late' ? '⏰' : '❌'
    if (l.status === 'absent') return `${statusIcon} ${d} — ABSENT`
    const entry = new Date(l.marked_at ?? l.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })
    const exit = l.exit_time
      ? ` · Exit ${new Date(l.exit_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })}`
      : ''
    return `${statusIcon} ${d} — ${l.status.toUpperCase()} (${entry}${exit})`
  }).join('\n')

  return `📊 <b>Attendance Report</b>
🏫 ${instituteName}

<b>${studentName}</b>
📚 ${batchName}
📅 Period: ${periodLabel}

✅ Present: ${present}${late > 0 ? `\n⏰ Late: ${late}` : ''}
❌ Absent: ${absent}
📈 Attendance: <b>${pct}%</b>

📋 <b>Session Log:</b>
${logLines || 'No records for this period.'}`
}

export function todayClassMessage(studentName: string, batchName: string, classTime: string, instituteName: string) {
  return `📅 <b>Class Today — ${instituteName}</b>

Hi! Just a reminder that <b>${studentName}</b> has class today.
📚 Batch: ${batchName}
🕐 Time: ${classTime}`
}

export function scheduleChangeMessage(studentName: string, batchName: string, newSchedule: string, instituteName: string) {
  return `📅 <b>Schedule Update — ${instituteName}</b>

Dear parent of <b>${studentName}</b>,

The schedule for batch <b>${batchName}</b> has been updated.

🕐 <b>New Schedule:</b>
${newSchedule}

Please note the new timings. Contact the institute if you have any questions.`
}

export function welcomeMessage(studentName: string, batchName: string, instituteName: string) {
  return `👋 <b>Welcome to ${instituteName}!</b>

<b>${studentName}</b> has been enrolled in <b>${batchName}</b>.
You will receive attendance alerts here automatically.`
}

export async function logTelegramMessage(
  instituteId: string,
  studentId: string,
  batchId: string | null,
  parentTgId: string,
  messageType: string,
  messageContent: string,
  status: 'sent' | 'delivered' | 'blocked' | 'failed' | 'pending',
  telegramMessageId?: number
) {
  const { supabaseAdmin } = await import('@/lib/supabase')
  const { error } = await supabaseAdmin.from('telegram_message_log').insert({
    institute_id: instituteId,
    student_id: studentId,
    batch_id: batchId || null,
    recipient_telegram_chat_id: parentTgId,
    message_type: messageType,
    message_content: messageContent,
    status,
    telegram_message_id: telegramMessageId ?? null,
  })
  if (error) console.error('Telegram log insert error:', error)
}

// Send a message AND record its real delivery status in telegram_message_log.
// This is the single source of truth for the delivery flow — callers no longer
// hardcode 'sent'.
//
// When withAck is true, an inline "👍 Got it" button is attached. To correlate
// the tap (a callback_query) back to this log row, the row is inserted first to
// obtain its id, which becomes the button's callback_data; the row is then
// updated with the actual delivery status once the send completes.
export async function sendTrackedMessage(opts: {
  instituteId: string
  studentId: string
  batchId: string | null
  chatId: string
  messageType: string
  message: string
  withAck?: boolean
}): Promise<SendResult> {
  const { instituteId, studentId, batchId, chatId, messageType, message, withAck } = opts

  if (!withAck) {
    const result = await sendTelegramMessage(chatId, message)
    logTelegramMessage(instituteId, studentId, batchId, chatId, messageType, message, result.status, result.messageId).catch(console.error)
    return result
  }

  const { supabaseAdmin } = await import('@/lib/supabase')
  const { data: row, error: insertError } = await supabaseAdmin
    .from('telegram_message_log')
    .insert({
      institute_id: instituteId,
      student_id: studentId,
      batch_id: batchId || null,
      recipient_telegram_chat_id: chatId,
      message_type: messageType,
      message_content: message,
      status: 'pending',
    })
    .select('id')
    .single()

  if (insertError || !row) {
    // Logging failed — still attempt to deliver the message (without a button,
    // since we have no id to correlate the ack).
    console.error('Telegram log insert error:', insertError)
    return sendTelegramMessage(chatId, message)
  }

  const replyMarkup = { inline_keyboard: [[{ text: '👍 Got it', callback_data: `ack:${row.id}` }]] }
  const result = await sendTelegramMessage(chatId, message, { replyMarkup })

  supabaseAdmin
    .from('telegram_message_log')
    .update({ status: result.status, telegram_message_id: result.messageId ?? null })
    .eq('id', row.id)
    .then(({ error }) => { if (error) console.error('Telegram log update error:', error) })

  return result
}
