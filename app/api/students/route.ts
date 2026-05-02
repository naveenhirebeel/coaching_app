import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthUser, getSuperAdminUser, isApprovedInstitute } from '@/lib/auth'
import { sendTelegramMessage, welcomeMessage } from '@/lib/telegram'

export async function GET(req: NextRequest) {
  const user = getAuthUser(req) || getSuperAdminUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const batchId = searchParams.get('batch_id')

  let instituteId = ('institute_id' in user ? user.institute_id : '') as string
  if (user.role === 'super_admin') {
    const paramInstitute = searchParams.get('institute_id')
    if (paramInstitute) {
      const approved = await isApprovedInstitute(paramInstitute)
      if (!approved) return NextResponse.json({ error: 'Institute not approved' }, { status: 403 })
      instituteId = paramInstitute
    } else {
      return NextResponse.json({ error: 'institute_id required for super_admin' }, { status: 400 })
    }
  } else if (user.role !== 'admin' && user.role !== 'teacher') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let query = supabaseAdmin
    .from('students')
    .select('*, batches(name, subject)')
    .eq('institute_id', instituteId)
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

export async function PATCH(req: NextRequest) {
  const user = getAuthUser(req)
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, name, parent_name, parent_telegram_chat_id, batch_id } = await req.json()
  if (!id || !name || !batch_id) return NextResponse.json({ error: 'ID, name and batch are required' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('students')
    .update({ name, parent_name, parent_telegram_chat_id, batch_id })
    .eq('id', id)
    .eq('institute_id', user.institute_id)
    .select('*, batches(name, subject)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const user = getAuthUser(req)
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const { data: student } = await supabaseAdmin
    .from('students')
    .select('name, parent_telegram_chat_id, institutes(name)')
    .eq('id', id)
    .eq('institute_id', user.institute_id)
    .single()

  if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 })

  if (student.parent_telegram_chat_id) {
    const instituteName = (student.institutes as { name?: string })?.name || 'the institute'
    await sendTelegramMessage(
      student.parent_telegram_chat_id,
      `ℹ️ <b>${student.name}</b> has been removed from <b>${instituteName}</b>. You will no longer receive attendance alerts for this student.`
    )
  }

  const { error } = await supabaseAdmin
    .from('students')
    .delete()
    .eq('id', id)
    .eq('institute_id', user.institute_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
