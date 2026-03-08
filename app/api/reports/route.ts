import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthUser } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const user = getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const batchId = searchParams.get('batch_id')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  let query = supabaseAdmin
    .from('attendance')
    .select('id, student_id, status, date, created_at, exit_time, students(name), batches(name)')
    .eq('institute_id', user.institute_id)
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
    present: number
    late: number
    absent: number
    logs: { id: string; date: string; status: string; created_at: string; exit_time: string | null }[]
  }> = {}

  for (const record of data || []) {
    const id = record.student_id
    if (!summary[id]) {
      summary[id] = { name: (record.students as { name?: string })?.name || '', present: 0, late: 0, absent: 0, logs: [] }
    }
    if (record.status === 'present') summary[id].present++
    else if (record.status === 'late') summary[id].late++
    else summary[id].absent++
    summary[id].logs.push({ id: record.id, date: record.date, status: record.status, created_at: record.created_at, exit_time: record.exit_time })
  }

  return NextResponse.json(Object.values(summary).sort((a, b) => a.name.localeCompare(b.name)))
}
