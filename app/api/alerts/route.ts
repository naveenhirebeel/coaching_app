import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthUser } from '@/lib/auth'
import { sendTelegramMessage, holidayMessage } from '@/lib/telegram'

export async function POST(req: NextRequest) {
  const user = getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { batch_id, message } = await req.json()
  // batch_id = null means send to ALL batches

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

  // Get students to notify
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
