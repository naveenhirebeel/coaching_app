import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthUser } from '@/lib/auth'
import { sendTelegramMessage, reportMessage, logTelegramMessage } from '@/lib/telegram'

export async function POST(req: NextRequest) {
  const user = getAuthUser(req)
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { student_id, period } = await req.json()
  if (!student_id || !period) return NextResponse.json({ error: 'student_id and period required' }, { status: 400 })

  const days = period === 'week' ? 7 : period === 'fortnight' ? 14 : 30
  const toDate = new Date()
  const fromDate = new Date()
  fromDate.setDate(fromDate.getDate() - (days - 1))
  const from = fromDate.toISOString().split('T')[0]
  const to = toDate.toISOString().split('T')[0]

  const periodLabel = `${fromDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })} – ${toDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })}`

  // Fetch student info
  const { data: student } = await supabaseAdmin
    .from('students')
    .select('name, parent_telegram_chat_id, batch_id, batches(name)')
    .eq('id', student_id)
    .eq('institute_id', user.institute_id)
    .single()

  if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 })
  if (!student.parent_telegram_chat_id) return NextResponse.json({ error: 'Parent has no Telegram configured' }, { status: 400 })

  // Fetch institute name
  const { data: institute } = await supabaseAdmin
    .from('institutes')
    .select('name')
    .eq('id', user.institute_id)
    .single()

  const instituteName = institute?.name || ''
  const batchName = (student.batches as { name?: string } | null)?.name || 'Unknown Batch'

  // Fetch attendance for the period
  const { data: records } = await supabaseAdmin
    .from('attendance')
    .select('date, status, created_at, exit_time')
    .eq('student_id', student_id)
    .eq('institute_id', user.institute_id)
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: true })
    .order('created_at', { ascending: true })

  const logs = records || []

  // Deduplicate: latest entry per date (last created_at wins for status)
  const latestByDate: Record<string, typeof logs[0]> = {}
  for (const r of logs) {
    latestByDate[r.date] = r
  }
  const dedupedLogs = Object.values(latestByDate).sort((a, b) => a.date.localeCompare(b.date))

  let present = 0, late = 0, absent = 0
  for (const r of dedupedLogs) {
    if (r.status === 'present') present++
    else if (r.status === 'late') late++
    else absent++
  }

  const message = reportMessage(student.name, batchName, instituteName, periodLabel, present, late, absent, dedupedLogs)
  const result = await sendTelegramMessage(student.parent_telegram_chat_id, message)

  const logStatus = result.ok ? 'sent' : 'failed'
  logTelegramMessage(user.institute_id, student_id, student.batch_id || null, student.parent_telegram_chat_id, 'alert', message, logStatus).catch(console.error)

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 })
  return NextResponse.json({ success: true })
}
