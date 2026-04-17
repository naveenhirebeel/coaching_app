import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSuperAdminUser } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const user = getSuperAdminUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const instituteId = searchParams.get('institute_id')
  const messageType = searchParams.get('message_type')
  const fromDate = searchParams.get('from_date')
  const toDate = searchParams.get('to_date')
  const studentId = searchParams.get('student_id')

  if (!instituteId) return NextResponse.json({ error: 'institute_id required' }, { status: 400 })

  let query = supabaseAdmin
    .from('telegram_message_log')
    .select('id, sent_at, student_id, batch_id, recipient_telegram_chat_id, message_type, message_content, status, students(name), batches(name)')
    .eq('institute_id', instituteId)
    .order('sent_at', { ascending: false })

  if (messageType) query = query.eq('message_type', messageType)
  if (studentId) query = query.eq('student_id', studentId)
  if (fromDate) query = query.gte('sent_at', fromDate)
  if (toDate) query = query.lte('sent_at', toDate)

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const formatted = (data || []).map(msg => ({
    id: msg.id,
    sent_at: msg.sent_at,
    student_name: (msg.students as { name?: string } | null)?.name || 'Unknown',
    batch_name: (msg.batches as { name?: string } | null)?.name || 'Unknown Batch',
    recipient_telegram_chat_id: msg.recipient_telegram_chat_id,
    message_type: msg.message_type,
    message_content: msg.message_content,
    status: msg.status,
  }))

  return NextResponse.json(formatted)
}
