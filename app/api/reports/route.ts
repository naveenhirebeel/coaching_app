import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthUser, getSuperAdminUser, isApprovedInstitute } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const user = getAuthUser(req) || getSuperAdminUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const batchId = searchParams.get('batch_id')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  let instituteId = user.institute_id
  if (user.role === 'super_admin') {
    const paramInstitute = searchParams.get('institute_id')
    if (paramInstitute) {
      const approved = await isApprovedInstitute(paramInstitute)
      if (!approved) return NextResponse.json({ error: 'Institute not approved' }, { status: 403 })
      instituteId = paramInstitute
    } else {
      return NextResponse.json({ error: 'institute_id required for super_admin' }, { status: 400 })
    }
  } else if (user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let query = supabaseAdmin
    .from('attendance')
    .select('id, student_id, status, date, created_at, exit_time, students(name, parent_telegram_chat_id), batches(name)')
    .eq('institute_id', instituteId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: true })

  if (batchId) query = query.eq('batch_id', batchId)
  if (from) query = query.gte('date', from)
  if (to) query = query.lte('date', to)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Aggregate by student with full log
  const summary: Record<string, {
    name: string
    parent_telegram_chat_id: string | null
    present: number
    late: number
    absent: number
    logs: { id: string; date: string; status: string; created_at: string; exit_time: string | null }[]
  }> = {}

  for (const record of data || []) {
    const id = record.student_id
    const stu = record.students as { name?: string; parent_telegram_chat_id?: string | null } | null
    if (!summary[id]) {
      summary[id] = { name: stu?.name || '', parent_telegram_chat_id: stu?.parent_telegram_chat_id ?? null, present: 0, late: 0, absent: 0, logs: [] }
    }
    if (record.status === 'present') summary[id].present++
    else if (record.status === 'late') summary[id].late++
    else summary[id].absent++
    summary[id].logs.push({ id: record.id, date: record.date, status: record.status, created_at: record.created_at, exit_time: record.exit_time })
  }

  const result = Object.entries(summary)
    .map(([student_id, s]) => ({ student_id, ...s }))
    .sort((a, b) => a.name.localeCompare(b.name))

  // Fire-and-forget audit log for super_admin
  if (user.role === 'super_admin') {
    fetch(new URL('/api/super-admin/audit', req.url).toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: req.headers.get('Authorization')! },
      body: JSON.stringify({ action: 'view_reports', institute_id: instituteId })
    }).catch(console.error)
  }

  return NextResponse.json(result)
}
