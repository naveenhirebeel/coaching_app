import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthUser } from '@/lib/auth'
import { sendTelegramMessage } from '@/lib/telegram'

export async function GET(req: NextRequest) {
  const user = getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('teachers')
    .select('id, name, phone, telegram_chat_id, created_at')
    .eq('institute_id', user.institute_id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const user = getAuthUser(req)
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, phone, telegram_chat_id } = await req.json()

  if (!name || !phone) {
    return NextResponse.json({ error: 'Name and phone are required' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('teachers')
    .insert({ name, phone, telegram_chat_id, institute_id: user.institute_id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest) {
  const user = getAuthUser(req)
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, name, phone, telegram_chat_id } = await req.json()
  if (!id || !name || !phone) return NextResponse.json({ error: 'ID, name and phone are required' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('teachers')
    .update({ name, phone, telegram_chat_id })
    .eq('id', id)
    .eq('institute_id', user.institute_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const user = getAuthUser(req)
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const { data: teacher } = await supabaseAdmin
    .from('teachers')
    .select('name, telegram_chat_id, institutes(name)')
    .eq('id', id)
    .eq('institute_id', user.institute_id)
    .single()

  if (!teacher) return NextResponse.json({ error: 'Teacher not found' }, { status: 404 })

  if (teacher.telegram_chat_id) {
    const instituteName = (teacher.institutes as { name?: string })?.name || 'the institute'
    await sendTelegramMessage(
      teacher.telegram_chat_id,
      `ℹ️ You have been removed from <b>${instituteName}</b>. You will no longer receive notifications from this bot.`
    )
  }

  const { error } = await supabaseAdmin
    .from('teachers')
    .delete()
    .eq('id', id)
    .eq('institute_id', user.institute_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
