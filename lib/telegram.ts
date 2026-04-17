const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN!

export async function sendTelegramMessage(chatId: string, message: string): Promise<{ ok: boolean; error?: string }> {
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
        }),
      }
    )
    const data = await res.json()
    if (!data.ok) {
      console.error('Telegram error:', data.description)
      return { ok: false, error: data.description }
    }
    return { ok: true }
  } catch (err) {
    console.error('Telegram send failed:', err)
    return { ok: false, error: 'Network error reaching Telegram' }
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
  logs: { date: string; status: string; created_at: string; exit_time: string | null }[]
) {
  const total = present + late + absent
  const attended = present + late
  const pct = total > 0 ? Math.round((attended / total) * 100) : 0

  const logLines = logs.map(l => {
    const d = new Date(l.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })
    const statusIcon = l.status === 'present' ? '✅' : l.status === 'late' ? '⏰' : '❌'
    if (l.status === 'absent') return `${statusIcon} ${d} — ABSENT`
    const entry = new Date(l.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })
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
  status: 'sent' | 'failed'
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
  })
  if (error) console.error('Telegram log insert error:', error)
}
