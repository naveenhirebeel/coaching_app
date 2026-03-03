import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthUser } from '@/lib/auth'
import { sendTelegramMessage, welcomeMessage } from '@/lib/telegram'

export async function GET(req: NextRequest) {
  const user = getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const batchId = searchParams.get('batch_id')

  let query = supabaseAdmin
    .from('students')
    .select('*, batches(name, subject)')
    .eq('institute_id', user.institute_id)
    .order('name')

  if (batchId) query = query.eq('batch_id', batchId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const user = getAuthUser(req)
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, parent_name, parent_telegram_chat_id, batch_id } = await req.json()

  if (!name || !batch_id) {
    return NextResponse.json({ error: 'Name and batch are required' }, { status: 400 })
  }

  const { data: student, error } = await supabaseAdmin
    .from('students')
    .insert({ name, parent_name, parent_telegram_chat_id, batch_id, institute_id: user.institute_id })
    .select('*, batches(name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Send welcome Telegram message to parent
  if (parent_telegram_chat_id) {
    const { data: institute } = await supabaseAdmin
      .from('institutes')
      .select('name')
      .eq('id', user.institute_id)
      .single()

    await sendTelegramMessage(
      parent_telegram_chat_id,
      welcomeMessage(name, student.batches.name, institute?.name || 'the institute')
    )
  }

  return NextResponse.json(student)
}
