import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthUser } from '@/lib/auth'
import { sendTelegramMessage, absentMessage, presentMessage } from '@/lib/telegram'

export async function GET(req: NextRequest) {
  const user = getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const batchId = searchParams.get('batch_id')
  const date = searchParams.get('date') || new Date().toISOString().split('T')[0]

  const { data, error } = await supabaseAdmin
    .from('attendance')
    .select('*, students(name)')
    .eq('batch_id', batchId)
    .eq('date', date)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const user = getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { batch_id, date, records, notify_present } = await req.json()
  // records = [{ student_id, status: 'present' | 'absent' }]

  if (!batch_id || !date || !records?.length) {
    return NextResponse.json({ error: 'batch_id, date and records are required' }, { status: 400 })
  }

  // Check if attendance already submitted for this batch+date
  const { data: existing } = await supabaseAdmin
    .from('attendance')
    .select('id')
    .eq('batch_id', batch_id)
    .eq('date', date)
    .limit(1)

  if (existing?.length) {
    return NextResponse.json({ error: 'Attendance already submitted for this batch today' }, { status: 400 })
  }

  // Save all attendance records
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

  // Fetch batch + institute info for messages
  const { data: batch } = await supabaseAdmin
    .from('batches')
    .select('name, institutes(name, phone)')
    .eq('id', batch_id)
    .single()

  const batchName = batch?.name || 'Class'
  const institutePhone = (batch?.institutes as { phone?: string })?.phone || ''
  const formattedDate = new Date(date).toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long'
  })

  // Send Telegram notifications
  let notifiedCount = 0
  for (const record of records) {
    const { data: student } = await supabaseAdmin
      .from('students')
      .select('name, parent_telegram_chat_id')
      .eq('id', record.student_id)
      .single()

    if (!student?.parent_telegram_chat_id) continue

    if (record.status === 'absent') {
      await sendTelegramMessage(
        student.parent_telegram_chat_id,
        absentMessage(student.name, batchName, formattedDate, institutePhone)
      )
      notifiedCount++
    } else if (record.status === 'present' && notify_present) {
      await sendTelegramMessage(
        student.parent_telegram_chat_id,
        presentMessage(student.name, batchName, formattedDate)
      )
      notifiedCount++
    }
  }

  const absentCount = records.filter((r: { status: string }) => r.status === 'absent').length
  return NextResponse.json({
    success: true,
    message: `Attendance saved. ${absentCount} absent. ${notifiedCount} parents notified.`,
  })
}
