import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthUser, getSuperAdminUser, isApprovedInstitute } from '@/lib/auth'
import { logActivity } from '@/lib/activity-logger'

export async function GET(req: NextRequest) {
  const user = getAuthUser(req) || getSuperAdminUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let instituteId = user.institute_id
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
    .from('batches')
    .select('*, teachers(name)')
    .eq('institute_id', instituteId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fire-and-forget audit log for super_admin
  if (user.role === 'super_admin') {
    fetch(new URL('/api/super-admin/audit', req.url).toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: req.headers.get('Authorization')! },
      body: JSON.stringify({ action: 'view_batches', institute_id: instituteId })
    }).catch(console.error)
  }

  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const user = getAuthUser(req)
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, subject, schedule_slots, teacher_id } = await req.json()

  if (!name || !subject) {
    return NextResponse.json({ error: 'Name and subject are required' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('batches')
    .insert({ name, subject, schedule_slots: schedule_slots ?? [], teacher_id, institute_id: user.institute_id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Log activity
  logActivity(user.institute_id, 'batch_created', 'admin', user.id, 'batch', data.id, name, {
    subject,
    schedule_slots: schedule_slots ?? [],
    teacher_id
  }).catch(console.error)

  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest) {
  const user = getAuthUser(req)
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, name, subject, schedule_slots, teacher_id } = await req.json()
  if (!id || !name || !subject) return NextResponse.json({ error: 'ID, name and subject are required' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('batches')
    .update({ name, subject, schedule_slots: schedule_slots ?? [], teacher_id })
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

  // Get batch name before deletion
  const { data: batch } = await supabaseAdmin
    .from('batches')
    .select('name')
    .eq('id', id)
    .eq('institute_id', user.institute_id)
    .single()

  const { error } = await supabaseAdmin
    .from('batches')
    .delete()
    .eq('id', id)
    .eq('institute_id', user.institute_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Log activity
  logActivity(user.institute_id, 'batch_deleted', 'admin', user.id, 'batch', id, batch?.name || 'Unknown Batch', {}).catch(console.error)

  return NextResponse.json({ success: true })
}
