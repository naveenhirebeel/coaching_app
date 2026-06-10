import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSuperAdminUser } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const user = getSuperAdminUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Find the most recent cron run date
  const { data: lastRun } = await supabaseAdmin
    .from('telegram_message_log')
    .select('sent_at')
    .eq('message_type', 'today_class_reminder')
    .order('sent_at', { ascending: false })
    .limit(1)
    .single()

  if (!lastRun) return NextResponse.json({ lastRunAt: null, sent: 0, failed: 0, institutes: [] })

  // Get the date of the last run (truncate to day)
  const lastRunDate = lastRun.sent_at.slice(0, 10)
  const from = `${lastRunDate}T00:00:00.000Z`
  const to = `${lastRunDate}T23:59:59.999Z`

  const { data: logs } = await supabaseAdmin
    .from('telegram_message_log')
    .select('institute_id, status, institutes(name)')
    .eq('message_type', 'today_class_reminder')
    .gte('sent_at', from)
    .lte('sent_at', to)

  const instituteMap: Record<string, { name: string; sent: number; failed: number }> = {}
  let totalSent = 0
  let totalFailed = 0

  for (const log of logs || []) {
    const id = log.institute_id
    if (!instituteMap[id]) {
      instituteMap[id] = { name: (log.institutes as { name?: string } | null)?.name || id, sent: 0, failed: 0 }
    }
    if (log.status === 'sent') { instituteMap[id].sent++; totalSent++ }
    else { instituteMap[id].failed++; totalFailed++ }
  }

  return NextResponse.json({
    lastRunAt: lastRun.sent_at,
    sent: totalSent,
    failed: totalFailed,
    institutes: Object.values(instituteMap).sort((a, b) => b.sent - a.sent),
  })
}
