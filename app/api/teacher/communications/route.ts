import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthUser } from '@/lib/auth'

// Teacher-scoped view of messages sent to parents. Mirrors the super-admin
// communications endpoint but is locked to the caller's own institute — the
// institute_id is taken from the token, never from the client.
export async function GET(req: NextRequest) {
  const user = getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const messageType = searchParams.get('message_type')
  const fromDate = searchParams.get('from_date')
  const toDate = searchParams.get('to_date')
  const studentName = searchParams.get('student_name')

  let query = supabaseAdmin
    .from('telegram_message_log')
    .select('id, sent_at, student_id, batch_id, recipient_telegram_chat_id, message_type, message_content, status, acknowledged_at, students(name, parent_name, parent_telegram_chat_id, parent2_name, parent2_telegram_chat_id), batches(name)')
    .eq('institute_id', user.institute_id)
    .order('sent_at', { ascending: false })

  if (messageType) query = query.eq('message_type', messageType)
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
        message_type: msg.message_type,
        message_content: msg.message_content,
        status: msg.status,
        acknowledged_at: msg.acknowledged_at,
      }
    })
    .filter(msg => !search || msg.student_name.toLowerCase().includes(search))

  return NextResponse.json(formatted)
}
