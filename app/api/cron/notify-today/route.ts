import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { todayClassMessage, sendTrackedMessage } from '@/lib/telegram'

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

  // Determine today's day abbreviation in IST
  const todayIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  const todayDay = DAY_MAP[todayIST.getDay()]

  // Fetch all active batches with their institute info
  const { data: batches, error } = await supabaseAdmin
    .from('batches')
    .select('id, name, institute_id, schedule_slots, institutes(name)')

  if (error) {
    console.error('Cron: fetch batches error', error)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  let totalSent = 0
  let totalSkipped = 0

  for (const batch of batches || []) {
    const slots: { day: string; start: string; end: string }[] = batch.schedule_slots || []
    const todaySlot = slots.find(s => s.day === todayDay)
    if (!todaySlot) continue

    const classTime = `${fmt12(todaySlot.start)} – ${fmt12(todaySlot.end)}`
    const instituteName = (batch.institutes as unknown as { name: string } | null)?.name || 'Institute'

    const { data: students } = await supabaseAdmin
      .from('students')
      .select('id, name, parent_telegram_chat_id, parent2_telegram_chat_id')
      .eq('batch_id', batch.id)
      .eq('institute_id', batch.institute_id)

    for (const student of students || []) {
      const chatIds = [student.parent_telegram_chat_id, student.parent2_telegram_chat_id].filter(Boolean) as string[]
      if (chatIds.length === 0) { totalSkipped++; continue }

      const msg = todayClassMessage(student.name, batch.name, classTime, instituteName)

      await Promise.all(
        chatIds.map(chatId => sendTrackedMessage({
          instituteId: batch.institute_id, studentId: student.id, batchId: batch.id, chatId,
          messageType: 'today_class_reminder', message: msg,
        }))
      )
      totalSent++
    }
  }

  console.log(`Cron notify-today [${todayDay}]: sent=${totalSent} skipped=${totalSkipped}`)
  return NextResponse.json({ ok: true, day: todayDay, sent: totalSent, skipped: totalSkipped })
}
