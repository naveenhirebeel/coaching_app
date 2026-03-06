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

export function absentMessage(studentName: string, batchName: string, date: string, institutePhone: string) {
  return `⚠️ <b>Attendance Alert</b>

<b>${studentName}</b> was marked <b>ABSENT</b> today.
📚 Batch: ${batchName}
📅 Date: ${date}
📞 Contact: ${institutePhone}`
}

export function presentMessage(studentName: string, batchName: string, date: string) {
  return `✅ <b>Attendance Update</b>

<b>${studentName}</b> attended class today.
📚 Batch: ${batchName}
📅 Date: ${date}`
}

export function holidayMessage(batchName: string, message: string, instituteName: string) {
  return `🔴 <b>Alert from ${instituteName}</b>

📚 Batch: ${batchName}
${message}`
}

export function lateMessage(studentName: string, batchName: string, date: string, institutePhone: string) {
  return `⏰ <b>Late Arrival Notice</b>

<b>${studentName}</b> arrived <b>LATE</b> to class today.
📚 Batch: ${batchName}
📅 Date: ${date}
📞 Contact: ${institutePhone}`
}

export function exitMessage(studentName: string, batchName: string, exitTime: string) {
  return `🏠 <b>Left Class</b>

<b>${studentName}</b> has left class.
📚 Batch: ${batchName}
🕐 Left at: ${exitTime}`
}

export function welcomeMessage(studentName: string, batchName: string, instituteName: string) {
  return `👋 <b>Welcome to ${instituteName}!</b>

<b>${studentName}</b> has been enrolled in <b>${batchName}</b>.
You will receive attendance alerts here automatically.`
}
