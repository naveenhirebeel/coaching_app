import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthUser } from '@/lib/auth'

// Manage the per-day override for the daily "Class Today" reminder.
// Two scopes, selected by presence of batch_id:
//   batch scope     : batch_id set  -> applies to one batch (wins over institute)
//   institute scope : batch_id omitted -> applies to all of the institute's batches
//
//   GET    ?date=YYYY-MM-DD [&batch_id=]              -> current override (null if none)
//   PUT    { override_date, send_default, custom_enabled, custom_message [, batch_id] }
//   DELETE { override_date [, batch_id] }             -> reset that scope to default

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const COLS = 'batch_id, override_date, send_default, custom_enabled, custom_message, updated_at'

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

// Narrow a query to the requested scope (specific batch, or the institute-wide row).
function scopeFilter<T extends { eq: (c: string, v: unknown) => T; is: (c: string, v: null) => T }>(
  q: T, instituteId: string, batchId: string | null,
) {
  return batchId
    ? q.eq('batch_id', batchId)
    : q.eq('institute_id', instituteId).is('batch_id', null)
}

export async function GET(req: NextRequest) {
  const user = requireAdmin(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const batchId = req.nextUrl.searchParams.get('batch_id')
  const date = req.nextUrl.searchParams.get('date')
  if (!date || !DATE_RE.test(date)) {
    return NextResponse.json({ error: 'valid date required' }, { status: 400 })
  }
  if (batchId && !(await ownsBatch(batchId, user.institute_id))) {
    return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
  }

  let q = supabaseAdmin.from('daily_batch_messages').select(COLS).eq('override_date', date)
  q = scopeFilter(q, user.institute_id, batchId)
  const { data, error } = await q.maybeSingle()

  if (error) return NextResponse.json({ error: 'DB error' }, { status: 500 })
  return NextResponse.json({ override: data ?? null })
}

export async function PUT(req: NextRequest) {
  const user = requireAdmin(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const batchId: string | null = body.batch_id || null
  const overrideDate: string = body.override_date
  const sendDefault = body.send_default !== false // default true
  const customEnabled = body.custom_enabled === true
  const customMessage: string = (body.custom_message ?? '').toString().trim()

  if (!overrideDate || !DATE_RE.test(overrideDate)) {
    return NextResponse.json({ error: 'valid override_date required' }, { status: 400 })
  }
  if (customEnabled && !customMessage) {
    return NextResponse.json({ error: 'Custom message is empty' }, { status: 400 })
  }
  if (batchId && !(await ownsBatch(batchId, user.institute_id))) {
    return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
  }

  const values = {
    send_default: sendDefault,
    custom_enabled: customEnabled,
    custom_message: customEnabled ? customMessage : null,
    updated_at: new Date().toISOString(),
  }

  // Manual upsert: the unique indexes are partial (batch-scoped vs institute-wide),
  // which supabase-js onConflict cannot target, so find-then-update/insert instead.
  let findQ = supabaseAdmin
    .from('daily_batch_messages')
    .select('id')
    .eq('override_date', overrideDate)
  findQ = scopeFilter(findQ, user.institute_id, batchId)
  const { data: existing } = await findQ.maybeSingle()

  const write = existing
    ? supabaseAdmin.from('daily_batch_messages').update(values).eq('id', existing.id)
    : supabaseAdmin.from('daily_batch_messages').insert({
        institute_id: user.institute_id,
        batch_id: batchId,
        override_date: overrideDate,
        created_by: user.id,
        ...values,
      })

  const { data, error } = await write.select(COLS).single()
  if (error) {
    console.error('daily-message write error', error)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }
  return NextResponse.json({ success: true, override: data })
}

export async function DELETE(req: NextRequest) {
  const user = requireAdmin(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const batchId: string | null = body.batch_id || null
  const overrideDate: string = body.override_date
  if (!overrideDate || !DATE_RE.test(overrideDate)) {
    return NextResponse.json({ error: 'valid override_date required' }, { status: 400 })
  }
  if (batchId && !(await ownsBatch(batchId, user.institute_id))) {
    return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
  }

  let q = supabaseAdmin
    .from('daily_batch_messages')
    .delete()
    .eq('override_date', overrideDate)
    .eq('institute_id', user.institute_id)
  q = scopeFilter(q, user.institute_id, batchId)
  const { error } = await q

  if (error) return NextResponse.json({ error: 'DB error' }, { status: 500 })
  return NextResponse.json({ success: true })
}
