import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthUser } from '@/lib/auth'
import { sendTelegramMessage, holidayMessage } from '@/lib/telegram'

export async function POST(req: NextRequest) {
  const user = getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { batch_id, student_id, message } = await req.json()

  if (!message) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 })
  }

  // Get institute name
  const { data: institute } = await supabaseAdmin
    .from('institutes')
    .select('name')
    .eq('id', user.institute_id)
    .single()

  const instituteName = institute?.name || 'Institute'

  // Student-wise alert
  if (student_id) {
    const { data: student } = await supabaseAdmin
      .from('students')
      .select('name, parent_telegram_chat_id, batches(name)')
      .eq('id', student_id)
      .eq('institute_id', user.institute_id)
      .single()

    if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    if (!student.parent_telegram_chat_id) {
      return NextResponse.json({ error: 'Parent Telegram not linked for this student' }, { status: 400 })
    }

    const batchName = (student.batches as { name?: string })?.name || 'Class'
    await sendTelegramMessage(
      student.parent_telegram_chat_id,
      holidayMessage(batchName, message, instituteName)
    )
    return NextResponse.json({ success: true, message: `Alert sent to ${student.name}'s parent.` })
  }

  // Batch-wise alert (batch_id = null means all batches)
  let studentsQuery = supabaseAdmin
    .from('students')
    .select('name, parent_telegram_chat_id, batches(name)')
    .eq('institute_id', user.institute_id)
    .not('parent_telegram_chat_id', 'is', null)

  if (batch_id) studentsQuery = studentsQuery.eq('batch_id', batch_id)

  const { data: students, error } = await studentsQuery
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let sentCount = 0
  for (const student of students || []) {
    if (!student.parent_telegram_chat_id) continue
    const batchName = (student.batches as { name?: string })?.name || 'All Batches'
    await sendTelegramMessage(
      student.parent_telegram_chat_id,
      holidayMessage(batchName, message, instituteName)
    )
    sentCount++
  }

  return NextResponse.json({ success: true, message: `Alert sent to ${sentCount} parents.` })
}
