import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthUser, getSuperAdminUser, isApprovedInstitute } from '@/lib/auth'
import { sendTelegramMessage } from '@/lib/telegram'
import { logActivity } from '@/lib/activity-logger'

export async function GET(req: NextRequest) {
  const user = getAuthUser(req) || getSuperAdminUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let instituteId = ('institute_id' in user ? user.institute_id : '') as string
  if (user.role === 'super_admin') {
    const { searchParams } = new URL(req.url)
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

  const { data, error } = await supabaseAdmin
    .from('teachers')
    .select('id, name, phone, telegram_chat_id, created_at')
    .eq('institute_id', instituteId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fire-and-forget audit log for super_admin
  if (user.role === 'super_admin') {
    fetch(new URL('/api/super-admin/audit', req.url).toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: req.headers.get('Authorization')! },
      body: JSON.stringify({ action: 'view_teachers', institute_id: instituteId })
    }).catch(console.error)
  }

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

  // Log activity
  logActivity(user.institute_id, 'teacher_added', 'admin', user.id, 'teacher', data.id, name, {
    phone,
    telegram_configured: !!telegram_chat_id
  }).catch(console.error)

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

  // Log activity
  logActivity(user.institute_id, 'teacher_deleted', 'admin', user.id, 'teacher', id, teacher.name, {
    telegram_notified: !!teacher.telegram_chat_id
  }).catch(console.error)

  return NextResponse.json({ success: true })
}
