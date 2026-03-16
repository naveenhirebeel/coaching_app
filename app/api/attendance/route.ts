import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthUser } from '@/lib/auth'
import { sendTelegramMessage, absentMessage, presentMessage, lateMessage, exitMessage, logTelegramMessage } from '@/lib/telegram'
import { logActivity } from '@/lib/activity-logger'

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
    .order('created_at', { ascending: true })

  if (batchId) query = query.eq('batch_id', batchId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// Mark a single student — always inserts a new row for full audit log
export async function POST(req: NextRequest) {
  const user = getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { student_id, batch_id, date, status, notify_present } = await req.json()

  if (!student_id || !batch_id || !date || !status) {
    return NextResponse.json({ error: 'student_id, batch_id, date and status are required' }, { status: 400 })
  }

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('attendance')
    .insert({ student_id, batch_id, date, status, institute_id: user.institute_id })
    .select('id')
    .single()

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  // Fetch batch + student for Telegram
  const [{ data: batch }, { data: student }] = await Promise.all([
    supabaseAdmin.from('batches').select('name, institutes(name, phone)').eq('id', batch_id).single(),
    supabaseAdmin.from('students').select('name, parent_telegram_chat_id').eq('id', student_id).single(),
  ])

  const batchName = batch?.name || 'Class'
  const instituteName = (batch?.institutes as { name?: string })?.name || ''
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
      const msg = absentMessage(student.name, batchName, formattedDate, instituteName, institutePhone)
      await sendTelegramMessage(student.parent_telegram_chat_id, msg)
      logTelegramMessage(user.institute_id, student_id, batch_id, student.parent_telegram_chat_id, 'absent', msg, 'sent').catch(console.error)
      notified = true
    } else if (status === 'late') {
      const msg = lateMessage(student.name, batchName, formattedDate, instituteName, institutePhone)
      await sendTelegramMessage(student.parent_telegram_chat_id, msg)
      logTelegramMessage(user.institute_id, student_id, batch_id, student.parent_telegram_chat_id, 'late', msg, 'sent').catch(console.error)
      notified = true
    } else if (status === 'present' && notify_present) {
      const msg = presentMessage(student.name, batchName, formattedDate, instituteName)
      await sendTelegramMessage(student.parent_telegram_chat_id, msg)
      logTelegramMessage(user.institute_id, student_id, batch_id, student.parent_telegram_chat_id, 'present', msg, 'sent').catch(console.error)
      notified = true
    }
  }

  // Log activity
  logActivity(user.institute_id, 'attendance_marked', 'admin', user.id, 'attendance', inserted?.id || '', student?.name || '', {
    status,
    batch: batchName,
    date,
    notified
  }).catch(console.error)

  return NextResponse.json({ success: true, notified, attendance_id: inserted?.id })
}

export async function PATCH(req: NextRequest) {
  const user = getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { attendance_id } = await req.json()
  if (!attendance_id) return NextResponse.json({ error: 'attendance_id required' }, { status: 400 })

  const { data: record, error: fetchError } = await supabaseAdmin
    .from('attendance')
    .select('id, exit_time, student_id, batch_id, students(name, parent_telegram_chat_id), batches(name, institutes(name))')
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
  const batch = record.batches as unknown as { name?: string; institutes?: { name?: string } } | null
  const batchName = batch?.name || 'Class'
  const instituteName = batch?.institutes?.name || ''

  if (student?.parent_telegram_chat_id) {
    const msg = exitMessage(student.name, batchName, formattedTime, instituteName)
    await sendTelegramMessage(student.parent_telegram_chat_id, msg)
    logTelegramMessage(user.institute_id, record.student_id || '', record.batch_id, student.parent_telegram_chat_id, 'exit', msg, 'sent').catch(console.error)
  }

  // Log activity
  logActivity(user.institute_id, 'attendance_exit', 'admin', user.id, 'attendance', attendance_id, student?.name || '', {
    exit_time: formattedTime,
    batch: batchName
  }).catch(console.error)

  return NextResponse.json({ success: true, exit_time: formattedTime })
}
