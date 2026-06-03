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

  const studentName = searchParams.get('student_name')

  let query = supabaseAdmin
    .from('telegram_message_log')
    .select('id, sent_at, student_id, batch_id, recipient_telegram_chat_id, message_type, message_content, status, students(name, parent_name, parent_telegram_chat_id, parent2_name, parent2_telegram_chat_id), batches(name)')
    .eq('institute_id', instituteId)
    .order('sent_at', { ascending: false })

  if (messageType) query = query.eq('message_type', messageType)
  if (studentId) query = query.eq('student_id', studentId)
  if (fromDate) query = query.gte('sent_at', fromDate)
  if (toDate) query = query.lte('sent_at', toDate)

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const search = studentName?.toLowerCase() || ''
  const formatted = (data || [])
    .map(msg => {
      const student = msg.students as {
        name?: string
        parent_name?: string
        parent_telegram_chat_id?: string
        parent2_name?: string
        parent2_telegram_chat_id?: string
      } | null
      const recipientChatId = msg.recipient_telegram_chat_id
      let parentName = '—'
      if (student?.parent_telegram_chat_id && student.parent_telegram_chat_id === recipientChatId) {
        parentName = student.parent_name || 'Parent 1'
      } else if (student?.parent2_telegram_chat_id && student.parent2_telegram_chat_id === recipientChatId) {
        parentName = student.parent2_name || 'Parent 2'
      }
      return {
        id: msg.id,
        sent_at: msg.sent_at,
        student_name: student?.name || 'Unknown',
        batch_name: (msg.batches as { name?: string } | null)?.name || '—',
        parent_name: parentName,
        recipient_telegram_chat_id: recipientChatId,
        message_type: msg.message_type,
        message_content: msg.message_content,
        status: msg.status,
      }
    })
    .filter(msg => !search || msg.student_name.toLowerCase().includes(search))

  return NextResponse.json(formatted)
}
