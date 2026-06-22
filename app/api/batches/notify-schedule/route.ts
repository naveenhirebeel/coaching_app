import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthUser } from '@/lib/auth'
import { scheduleChangeMessage, sendTrackedMessage } from '@/lib/telegram'

function fmt12(t: string) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${ampm}`
}

export async function POST(req: NextRequest) {
  const user = getAuthUser(req)
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { batch_id } = await req.json()
  if (!batch_id) return NextResponse.json({ error: 'batch_id required' }, { status: 400 })

  const { data: batch } = await supabaseAdmin
    .from('batches')
    .select('name, schedule_slots')
    .eq('id', batch_id)
    .eq('institute_id', user.institute_id)
    .single()

  if (!batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 })

  const { data: institute } = await supabaseAdmin
    .from('institutes')
    .select('name')
    .eq('id', user.institute_id)
    .single()

  const instituteName = institute?.name || 'Institute'

  const slots: { day: string; start: string; end: string }[] = batch.schedule_slots || []
  const scheduleText = slots.length
    ? slots.map(s => `• ${s.day}: ${fmt12(s.start)} – ${fmt12(s.end)}`).join('\n')
    : 'No schedule set'

  const { data: students } = await supabaseAdmin
    .from('students')
    .select('id, name, parent_telegram_chat_id, parent2_telegram_chat_id')
    .eq('batch_id', batch_id)
    .eq('institute_id', user.institute_id)

  let sentCount = 0
  for (const student of students || []) {
    const chatIds = [student.parent_telegram_chat_id, student.parent2_telegram_chat_id].filter(Boolean) as string[]
    if (chatIds.length === 0) continue
    const msg = scheduleChangeMessage(student.name, batch.name, scheduleText, instituteName)
    await Promise.all(chatIds.map(chatId => sendTrackedMessage({ instituteId: user.institute_id, studentId: student.id, batchId: batch_id, chatId, messageType: 'schedule_change', message: msg })))
    sentCount++
  }

  return NextResponse.json({ success: true, message: `Notified ${sentCount} students' parents.` })
}
