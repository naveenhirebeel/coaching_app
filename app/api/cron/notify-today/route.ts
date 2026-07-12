import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { todayClassMessage, customNoteMessage, sendTrackedMessage } from '@/lib/telegram'

type DailyOverride = {
  batch_id: string
  send_default: boolean
  custom_enabled: boolean
  custom_message: string | null
}

const DAY_MAP: Record<number, string> = { 0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat' }

function fmt12(t: string) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${ampm}`
}

export async function GET(req: NextRequest) {
  const secret = req.headers.get('authorization')
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Determine today's day abbreviation + ISO date (YYYY-MM-DD) in IST
  const todayIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  const todayDay = DAY_MAP[todayIST.getDay()]
  const todayDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) // e.g. "2026-07-12"

  // Fetch all active batches with their institute info
  const { data: batches, error } = await supabaseAdmin
    .from('batches')
    .select('id, name, institute_id, schedule_slots, institutes(name)')

  if (error) {
    console.error('Cron: fetch batches error', error)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  // Per-batch overrides configured by admins for today (default toggle + custom note)
  const { data: overrides } = await supabaseAdmin
    .from('daily_batch_messages')
    .select('batch_id, send_default, custom_enabled, custom_message')
    .eq('override_date', todayDate)

  const overrideByBatch = new Map<string, DailyOverride>(
    (overrides || []).map(o => [o.batch_id, o as DailyOverride])
  )

  let totalSent = 0
  let totalSkipped = 0
  let totalCancelled = 0

  for (const batch of batches || []) {
    const slots: { day: string; start: string; end: string }[] = batch.schedule_slots || []
    const todaySlot = slots.find(s => s.day === todayDay)
    if (!todaySlot) continue

    const classTime = `${fmt12(todaySlot.start)} – ${fmt12(todaySlot.end)}`
    const instituteName = (batch.institutes as unknown as { name: string } | null)?.name || 'Institute'

    const override = overrideByBatch.get(batch.id)
    const sendDefault = override ? override.send_default : true
    const customText = override?.custom_enabled && override.custom_message?.trim()
      ? override.custom_message.trim()
      : null

    // Nothing to send for this batch today (e.g. class cancelled with no note)
    if (!sendDefault && !customText) { totalCancelled++; continue }

    const { data: students } = await supabaseAdmin
      .from('students')
      .select('id, name, parent_telegram_chat_id, parent2_telegram_chat_id')
      .eq('batch_id', batch.id)
      .eq('institute_id', batch.institute_id)

    for (const student of students || []) {
      const chatIds = [student.parent_telegram_chat_id, student.parent2_telegram_chat_id].filter(Boolean) as string[]
      if (chatIds.length === 0) { totalSkipped++; continue }

      // Compose one combined message: default reminder (if on) then custom note (if on)
      const parts: string[] = []
      if (sendDefault) parts.push(todayClassMessage(student.name, batch.name, classTime, instituteName))
      if (customText) parts.push(customNoteMessage(customText, instituteName))
      const msg = parts.join('\n\n———\n\n')

      await Promise.all(
        chatIds.map(chatId => sendTrackedMessage({
          instituteId: batch.institute_id, studentId: student.id, batchId: batch.id, chatId,
          messageType: 'today_class_reminder', message: msg,
        }))
      )
      totalSent++
    }
  }

  console.log(`Cron notify-today [${todayDay} ${todayDate}]: sent=${totalSent} skipped=${totalSkipped} cancelled=${totalCancelled}`)
  return NextResponse.json({ ok: true, day: todayDay, date: todayDate, sent: totalSent, skipped: totalSkipped, cancelled: totalCancelled })
}
