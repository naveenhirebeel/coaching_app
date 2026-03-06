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

export async function POST(req: NextRequest) {
  const user = getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { batch_id, date, records, notify_present } = await req.json()

  if (!batch_id || !date || !records?.length) {
    return NextResponse.json({ error: 'batch_id, date and records are required' }, { status: 400 })
  }

  const { data: existing } = await supabaseAdmin
    .from('attendance')
    .select('id')
    .eq('batch_id', batch_id)
    .eq('date', date)
    .limit(1)

  if (existing?.length) {
    return NextResponse.json({ error: 'Attendance already submitted for this batch today' }, { status: 400 })
  }

  const { error: insertError } = await supabaseAdmin.from('attendance').insert(
    records.map((r: { student_id: string; status: string }) => ({
      student_id: r.student_id,
      batch_id,
      date,
      status: r.status,
      institute_id: user.institute_id,
    }))
  )

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  const { data: batch } = await supabaseAdmin
    .from('batches')
    .select('name, institutes(name, phone)')
    .eq('id', batch_id)
    .single()

  const batchName = batch?.name || 'Class'
  const institutePhone = (batch?.institutes as { phone?: string })?.phone || ''
  const now = new Date()
  const formattedDate = now.toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata'
  }) + ' at ' + now.toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata'
  })

  let notifiedCount = 0
  for (const record of records) {
    const { data: student } = await supabaseAdmin
      .from('students')
      .select('name, parent_telegram_chat_id')
      .eq('id', record.student_id)
      .single()

    if (!student?.parent_telegram_chat_id) continue

    if (record.status === 'absent') {
      await sendTelegramMessage(student.parent_telegram_chat_id, absentMessage(student.name, batchName, formattedDate, institutePhone))
      notifiedCount++
    } else if (record.status === 'late') {
      await sendTelegramMessage(student.parent_telegram_chat_id, lateMessage(student.name, batchName, formattedDate, institutePhone))
      notifiedCount++
    } else if (record.status === 'present' && notify_present) {
      await sendTelegramMessage(student.parent_telegram_chat_id, presentMessage(student.name, batchName, formattedDate))
      notifiedCount++
    }
  }

  const absentCount = records.filter((r: { status: string }) => r.status === 'absent').length
  const lateCount = records.filter((r: { status: string }) => r.status === 'late').length
  return NextResponse.json({
    success: true,
    message: `Attendance saved. ${absentCount} absent, ${lateCount} late. ${notifiedCount} parents notified.`,
  })
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
