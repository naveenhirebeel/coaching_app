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
    .select('student_id, status, date, students(name), batches(name)')
    .eq('institute_id', user.institute_id)

  if (batchId) query = query.eq('batch_id', batchId)
  if (from) query = query.gte('date', from)
  if (to) query = query.lte('date', to)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Aggregate by student
  const summary: Record<string, { name: string; present: number; absent: number }> = {}
  for (const record of data || []) {
    const id = record.student_id
    if (!summary[id]) {
      summary[id] = { name: (record.students as { name?: string })?.name || '', present: 0, absent: 0 }
    }
    if (record.status === 'present') summary[id].present++
    else summary[id].absent++
  }

  return NextResponse.json(Object.values(summary))
}
