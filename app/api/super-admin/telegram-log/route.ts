import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const { instituteId, studentId, batchId, parentTgId, messageType, messageContent, status } = await req.json()

  if (!instituteId || !studentId || !parentTgId || !messageType || !messageContent) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('telegram_message_log')
    .insert({
      institute_id: instituteId,
      student_id: studentId,
      batch_id: batchId || null,
      recipient_telegram_chat_id: parentTgId,
      message_type: messageType,
      message_content: messageContent,
      status: status || 'sent',
    })

  if (error) {
    console.error('Telegram log insert error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
