import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthUser } from '@/lib/auth'
import { absentMessage, presentMessage, lateMessage, exitMessage, sendTrackedMessage } from '@/lib/telegram'

export async function GET(req: NextRequest) {
  const user = getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const batchId = searchParams.get('batch_id')
  const date = searchParams.get('date') || new Date().toISOString().split('T')[0]
  const adhoc = searchParams.get('adhoc') // '1' = only ad-hoc, '0' = only regular, absent = all

  let query = supabaseAdmin
    .from('attendance')
    .select('*, students(name)')
    .eq('institute_id', user.institute_id)
    .eq('date', date)
    .order('created_at', { ascending: true })

  if (batchId) query = query.eq('batch_id', batchId)
  if (adhoc === '1') query = query.eq('is_adhoc', true)
  else if (adhoc === '0') query = query.eq('is_adhoc', false)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// Mark a single student — always inserts a new row for full audit log
export async function POST(req: NextRequest) {
  const user = getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { student_id, batch_id, date, status, notify_present, marked_at, is_adhoc, session_label } = await req.json()

  if (!student_id || !batch_id || !date || !status) {
    return NextResponse.json({ error: 'student_id, batch_id, date and status are required' }, { status: 400 })
  }

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('attendance')
    .insert({
      student_id, batch_id, date, status, institute_id: user.institute_id,
      ...(marked_at ? { marked_at } : {}),
      ...(is_adhoc ? { is_adhoc: true } : {}),
      ...(session_label ? { session_label } : {}),
    })
    .select('id')
    .single()

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  // Fetch batch + student for Telegram
  const [{ data: batch }, { data: student }] = await Promise.all([
    supabaseAdmin.from('batches').select('name, institutes(name, phone)').eq('id', batch_id).single(),
    supabaseAdmin.from('students').select('name, parent_telegram_chat_id, parent2_telegram_chat_id').eq('id', student_id).single(),
  ])

  const batchName = batch?.name || 'Class'
  const instituteName = (batch?.institutes as { name?: string })?.name || ''
  const institutePhone = (batch?.institutes as { phone?: string })?.phone || ''
  const when = marked_at ? new Date(marked_at) : new Date()
  const formattedDate = when.toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata'
  }) + ' at ' + when.toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata'
  })

  const parentChatIds = [student?.parent_telegram_chat_id, student?.parent2_telegram_chat_id].filter(Boolean) as string[]
  let notified = false
  if (student && parentChatIds.length > 0) {
    if (status === 'absent') {
      const msg = absentMessage(student.name, batchName, formattedDate, instituteName, institutePhone)
      await Promise.all(parentChatIds.map(chatId => sendTrackedMessage({ instituteId: user.institute_id, studentId: student_id, batchId: batch_id, chatId, messageType: 'absent', message: msg, withAck: true })))
      notified = true
    } else if (status === 'late') {
      const msg = lateMessage(student.name, batchName, formattedDate, instituteName, institutePhone)
      await Promise.all(parentChatIds.map(chatId => sendTrackedMessage({ instituteId: user.institute_id, studentId: student_id, batchId: batch_id, chatId, messageType: 'late', message: msg })))
      notified = true
    } else if (status === 'present' && notify_present) {
      const msg = presentMessage(student.name, batchName, formattedDate, instituteName)
      await Promise.all(parentChatIds.map(chatId => sendTrackedMessage({ instituteId: user.institute_id, studentId: student_id, batchId: batch_id, chatId, messageType: 'present', message: msg })))
      notified = true
    }
  }

  return NextResponse.json({ success: true, notified, attendance_id: inserted?.id })
}

export async function PATCH(req: NextRequest) {
  const user = getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { attendance_id } = body
  if (!attendance_id) return NextResponse.json({ error: 'attendance_id required' }, { status: 400 })

  const { data: record, error: fetchError } = await supabaseAdmin
    .from('attendance')
    .select('id, exit_time, status, student_id, batch_id, students(name, parent_telegram_chat_id, parent2_telegram_chat_id), batches(name, institutes(name))')
    .eq('id', attendance_id)
    .eq('institute_id', user.institute_id)
    .single()

  if (fetchError || !record) return NextResponse.json({ error: 'Record not found' }, { status: 404 })

  // Admin correction: update status, clear exit time, or move exit time from another record
  if (user.role === 'admin' && (body.status || body.clear_exit || body.move_exit)) {
    const updates: Record<string, unknown> = {}
    if (body.status) updates.status = body.status
    if (body.clear_exit) updates.exit_time = null
    if (body.move_exit) updates.exit_time = body.move_exit
    const { error } = await supabaseAdmin.from('attendance').update(updates).eq('id', attendance_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  // Teacher: mark exit
  if (record.exit_time) return NextResponse.json({ error: 'Exit already marked' }, { status: 400 })

  const exitTime = body.exit_time ? new Date(body.exit_time) : new Date()
  const formattedTime = exitTime.toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata'
  })

  const { error: updateError } = await supabaseAdmin
    .from('attendance')
    .update({ exit_time: exitTime.toISOString() })
    .eq('id', attendance_id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  const student = record.students as unknown as { name: string; parent_telegram_chat_id: string; parent2_telegram_chat_id: string } | null
  const batch = record.batches as unknown as { name?: string; institutes?: { name?: string } } | null
  const batchName = batch?.name || 'Class'
  const instituteName = batch?.institutes?.name || ''

  const exitParentChatIds = [student?.parent_telegram_chat_id, student?.parent2_telegram_chat_id].filter(Boolean) as string[]
  if (student && exitParentChatIds.length > 0) {
    const msg = exitMessage(student.name, batchName, formattedTime, instituteName)
    await Promise.all(exitParentChatIds.map(chatId => sendTrackedMessage({ instituteId: user.institute_id, studentId: record.student_id || '', batchId: record.batch_id, chatId, messageType: 'exit', message: msg })))
  }

  return NextResponse.json({ success: true, exit_time: formattedTime })
}

export async function DELETE(req: NextRequest) {
  const user = getAuthUser(req)
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { attendance_id } = await req.json()
  if (!attendance_id) return NextResponse.json({ error: 'attendance_id required' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('attendance')
    .delete()
    .eq('id', attendance_id)
    .eq('institute_id', user.institute_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
