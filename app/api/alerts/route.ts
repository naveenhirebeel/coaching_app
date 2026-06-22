import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthUser } from '@/lib/auth'
import { holidayMessage, sendTrackedMessage } from '@/lib/telegram'

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
      .select('name, parent_telegram_chat_id, parent2_telegram_chat_id, batches(name)')
      .eq('id', student_id)
      .eq('institute_id', user.institute_id)
      .single()

    if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    const studentChatIds = [student.parent_telegram_chat_id, student.parent2_telegram_chat_id].filter(Boolean) as string[]
    if (studentChatIds.length === 0) {
      return NextResponse.json({ error: 'No parent Telegram linked for this student' }, { status: 400 })
    }

    const batchName = (student.batches as { name?: string })?.name || 'Class'
    const msg = holidayMessage(batchName, message, instituteName)
    await Promise.all(studentChatIds.map(chatId => sendTrackedMessage({ instituteId: user.institute_id, studentId: student_id, batchId: null, chatId, messageType: 'alert', message: msg, withAck: true })))
    return NextResponse.json({ success: true, message: `Alert sent to ${student.name}'s parent(s).` })
  }

  // Batch-wise alert (batch_id = null means all batches)
  let studentsQuery = supabaseAdmin
    .from('students')
    .select('id, name, parent_telegram_chat_id, parent2_telegram_chat_id, batches(name)')
    .eq('institute_id', user.institute_id)

  if (batch_id) studentsQuery = studentsQuery.eq('batch_id', batch_id)

  const { data: students, error } = await studentsQuery
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let sentCount = 0
  for (const student of students || []) {
    const chatIds = [student.parent_telegram_chat_id, student.parent2_telegram_chat_id].filter(Boolean) as string[]
    if (chatIds.length === 0) continue
    const batchName = (student.batches as { name?: string })?.name || 'All Batches'
    const msg = holidayMessage(batchName, message, instituteName)
    await Promise.all(chatIds.map(chatId => sendTrackedMessage({ instituteId: user.institute_id, studentId: student.id, batchId: batch_id || null, chatId, messageType: 'alert', message: msg, withAck: true })))
    sentCount++
  }

  return NextResponse.json({ success: true, message: `Alert sent to ${sentCount} students' parents.` })
}
