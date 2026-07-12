import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthUser } from '@/lib/auth'

// Manage the per-day override for the daily "Class Today" reminder of a batch.
//   GET    ?batch_id=&date=YYYY-MM-DD  -> current override (null if none set)
//   PUT    { batch_id, override_date, send_default, custom_enabled, custom_message }
//   DELETE { batch_id, override_date } -> reset to default behaviour

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function requireAdmin(req: NextRequest) {
  const user = getAuthUser(req)
  if (!user || user.role !== 'admin') return null
  return user
}

// Verify the batch belongs to the caller's institute; returns false if not.
async function ownsBatch(batchId: string, instituteId: string) {
  const { data } = await supabaseAdmin
    .from('batches')
    .select('id')
    .eq('id', batchId)
    .eq('institute_id', instituteId)
    .single()
  return !!data
}

export async function GET(req: NextRequest) {
  const user = requireAdmin(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const batchId = req.nextUrl.searchParams.get('batch_id')
  const date = req.nextUrl.searchParams.get('date')
  if (!batchId || !date || !DATE_RE.test(date)) {
    return NextResponse.json({ error: 'batch_id and valid date required' }, { status: 400 })
  }
  if (!(await ownsBatch(batchId, user.institute_id))) {
    return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
  }

  const { data, error } = await supabaseAdmin
    .from('daily_batch_messages')
    .select('batch_id, override_date, send_default, custom_enabled, custom_message, updated_at')
    .eq('batch_id', batchId)
    .eq('override_date', date)
    .maybeSingle()

  if (error) return NextResponse.json({ error: 'DB error' }, { status: 500 })
  return NextResponse.json({ override: data ?? null })
}

export async function PUT(req: NextRequest) {
  const user = requireAdmin(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const batchId: string = body.batch_id
  const overrideDate: string = body.override_date
  const sendDefault = body.send_default !== false // default true
  const customEnabled = body.custom_enabled === true
  const customMessage: string = (body.custom_message ?? '').toString().trim()

  if (!batchId || !overrideDate || !DATE_RE.test(overrideDate)) {
    return NextResponse.json({ error: 'batch_id and valid override_date required' }, { status: 400 })
  }
  if (customEnabled && !customMessage) {
    return NextResponse.json({ error: 'Custom message is empty' }, { status: 400 })
  }
  if (!(await ownsBatch(batchId, user.institute_id))) {
    return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
  }

  const { data, error } = await supabaseAdmin
    .from('daily_batch_messages')
    .upsert({
      institute_id: user.institute_id,
      batch_id: batchId,
      override_date: overrideDate,
      send_default: sendDefault,
      custom_enabled: customEnabled,
      custom_message: customEnabled ? customMessage : null,
      created_by: user.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'batch_id,override_date' })
    .select('batch_id, override_date, send_default, custom_enabled, custom_message')
    .single()

  if (error) {
    console.error('daily-message upsert error', error)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }
  return NextResponse.json({ success: true, override: data })
}

export async function DELETE(req: NextRequest) {
  const user = requireAdmin(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const batchId: string = body.batch_id
  const overrideDate: string = body.override_date
  if (!batchId || !overrideDate || !DATE_RE.test(overrideDate)) {
    return NextResponse.json({ error: 'batch_id and valid override_date required' }, { status: 400 })
  }
  if (!(await ownsBatch(batchId, user.institute_id))) {
    return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
  }

  const { error } = await supabaseAdmin
    .from('daily_batch_messages')
    .delete()
    .eq('batch_id', batchId)
    .eq('override_date', overrideDate)
    .eq('institute_id', user.institute_id)

  if (error) return NextResponse.json({ error: 'DB error' }, { status: 500 })
  return NextResponse.json({ success: true })
}
