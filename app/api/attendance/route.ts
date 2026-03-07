import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthUser } from '@/lib/auth'
import { sendTelegramMessage, absentMessage, presentMessage, lateMessage, exitMessage } from '@/lib/telegram'

export async function GET(req: NextRequest) {
  const user = getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const batchId = searchParams.get('batch_id')
  const date = searchParams.get('date') || new Date().toISOString().split('T')[0]

  let query = supabaseAdmin
    .from('attendance')
    .select('*, students(name)')
    .eq('institute_id', user.institute_id)
    .eq('date', date)

  if (batchId) query = query.eq('batch_id', batchId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// Mark a single student immediately (upsert — allows re-marking)
export async function POST(req: NextRequest) {
  const user = getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { student_id, batch_id, date, status, notify_present } = await req.json()

  if (!student_id || !batch_id || !date || !status) {
    return NextResponse.json({ error: 'student_id, batch_id, date and status are required' }, { status: 400 })
  }

  // Upsert — insert or update on re-mark
  const { data: upserted, error: upsertError } = await supabaseAdmin
    .from('attendance')
    .upsert(
      { student_id, batch_id, date, status, institute_id: user.institute_id },
      { onConflict: 'student_id,date,batch_id' }
    )
    .select('id')
    .single()

  if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 })

  // Fetch batch + student for Telegram
  const [{ data: batch }, { data: student }] = await Promise.all([
    supabaseAdmin.from('batches').select('name, institutes(name, phone)').eq('id', batch_id).single(),
    supabaseAdmin.from('students').select('name, parent_telegram_chat_id').eq('id', student_id).single(),
  ])

  const batchName = batch?.name || 'Class'
  const institutePhone = (batch?.institutes as { phone?: string })?.phone || ''
  const now = new Date()
  const formattedDate = now.toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata'
  }) + ' at ' + now.toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata'
  })

  let notified = false
  if (student?.parent_telegram_chat_id) {
    if (status === 'absent') {
      await sendTelegramMessage(student.parent_telegram_chat_id, absentMessage(student.name, batchName, formattedDate, institutePhone))
      notified = true
    } else if (status === 'late') {
      await sendTelegramMessage(student.parent_telegram_chat_id, lateMessage(student.name, batchName, formattedDate, institutePhone))
      notified = true
    } else if (status === 'present' && notify_present) {
      await sendTelegramMessage(student.parent_telegram_chat_id, presentMessage(student.name, batchName, formattedDate))
      notified = true
    }
  }

  return NextResponse.json({ success: true, notified, attendance_id: upserted?.id })
}

export async function PATCH(req: NextRequest) {
  const user = getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { attendance_id } = await req.json()
  if (!attendance_id) return NextResponse.json({ error: 'attendance_id required' }, { status: 400 })

  const { data: record, error: fetchError } = await supabaseAdmin
    .from('attendance')
    .select('id, exit_time, students(name, parent_telegram_chat_id), batches(name)')
    .eq('id', attendance_id)
    .eq('institute_id', user.institute_id)
    .single()

  if (fetchError || !record) return NextResponse.json({ error: 'Record not found' }, { status: 404 })
  if (record.exit_time) return NextResponse.json({ error: 'Exit already marked' }, { status: 400 })

  const exitTime = new Date()
  const formattedTime = exitTime.toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata'
  })

  const { error: updateError } = await supabaseAdmin
    .from('attendance')
    .update({ exit_time: exitTime.toISOString() })
    .eq('id', attendance_id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  const student = record.students as unknown as { name: string; parent_telegram_chat_id: string } | null
  const batchName = (record.batches as { name?: string })?.name || 'Class'

  if (student?.parent_telegram_chat_id) {
    await sendTelegramMessage(student.parent_telegram_chat_id, exitMessage(student.name, batchName, formattedTime))
  }

  return NextResponse.json({ success: true, exit_time: formattedTime })
}
