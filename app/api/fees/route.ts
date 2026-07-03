import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthUser, getSuperAdminUser, isApprovedInstitute } from '@/lib/auth'
import { recomputeInvoice, periodLabelFromMonth, firstOfMonth, getTeacherBatchIds } from '@/lib/fees'
import { logActivity } from '@/lib/activity'

// GET /api/fees — list invoices for the caller's institute.
// Query: student_id, batch_id, status (filter); readable by admin, teacher, super_admin.
export async function GET(req: NextRequest) {
  const user = getAuthUser(req) || getSuperAdminUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)

  let instituteId = ('institute_id' in user ? user.institute_id : '') as string
  if (user.role === 'super_admin') {
    const paramInstitute = searchParams.get('institute_id')
    if (!paramInstitute) return NextResponse.json({ error: 'institute_id required for super_admin' }, { status: 400 })
    const approved = await isApprovedInstitute(paramInstitute)
    if (!approved) return NextResponse.json({ error: 'Institute not approved' }, { status: 403 })
    instituteId = paramInstitute
  } else if (user.role !== 'admin' && user.role !== 'teacher') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let query = supabaseAdmin
    .from('fee_invoices')
    .select('*, students(name), batches(name, subject, teacher_id, teachers(name))')
    .eq('institute_id', instituteId)
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  // Teachers only see invoices for batches assigned to them.
  if (user.role === 'teacher' && 'id' in user) {
    const myBatchIds = await getTeacherBatchIds(user.id as string, instituteId)
    if (myBatchIds.length === 0) return NextResponse.json([])
    query = query.in('batch_id', myBatchIds)
  }

  const studentId = searchParams.get('student_id')
  const batchId = searchParams.get('batch_id')
  const status = searchParams.get('status')
  if (studentId) query = query.eq('student_id', studentId)
  if (batchId) query = query.eq('batch_id', batchId)
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

// POST /api/fees — admin only.
//   Single charge: { student_id, batch_id?, period_label, amount, due_date?, notes? }
//   Generate month: { generate: true, batch_id, period_month: "YYYY-MM", amount?, due_date? }
//     Creates one invoice per student in the batch that doesn't already have one
//     for that month. amount falls back to the batch's monthly_fee.
export async function POST(req: NextRequest) {
  const user = getAuthUser(req)
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  if (body.generate) {
    const { period_month, due_date } = body
    if (!period_month) {
      return NextResponse.json({ error: 'period_month is required' }, { status: 400 })
    }

    // Explicit amount (when given) overrides each batch's own monthly_fee.
    const overrideAmount = body.amount != null && body.amount !== '' ? Number(body.amount) : null
    if (overrideAmount != null && (Number.isNaN(overrideAmount) || overrideAmount < 0)) {
      return NextResponse.json({ error: 'Amount must be a non-negative number' }, { status: 400 })
    }

    // Resolve target batches: all batches when `all`, else the provided list
    // (batch_id kept for backward compat).
    let batchIds: string[] = []
    if (body.all) {
      const { data } = await supabaseAdmin.from('batches').select('id').eq('institute_id', user.institute_id)
      batchIds = (data || []).map(b => b.id)
    } else if (Array.isArray(body.batch_ids)) {
      batchIds = body.batch_ids.filter(Boolean)
    } else if (body.batch_id) {
      batchIds = [body.batch_id]
    }
    const explicitStudentIds: string[] = Array.isArray(body.student_ids) ? body.student_ids.filter(Boolean) : []

    if (batchIds.length === 0 && explicitStudentIds.length === 0) {
      return NextResponse.json({ error: 'Select at least one batch or student' }, { status: 400 })
    }

    // Build a deduped map of target student -> { batch_id, monthly_fee } from
    // (a) every student in the selected batches and (b) explicitly picked students.
    const targets = new Map<string, { batch_id: string | null; monthly_fee: number | null }>()

    if (batchIds.length > 0) {
      const { data: batchRows } = await supabaseAdmin
        .from('batches')
        .select('id, monthly_fee, students(id)')
        .eq('institute_id', user.institute_id)
        .in('id', batchIds)
      for (const b of batchRows || []) {
        const fee = b.monthly_fee != null ? Number(b.monthly_fee) : null
        for (const s of ((b.students as { id: string }[]) || [])) {
          if (!targets.has(s.id)) targets.set(s.id, { batch_id: b.id, monthly_fee: fee })
        }
      }
    }

    if (explicitStudentIds.length > 0) {
      const { data: studentRows } = await supabaseAdmin
        .from('students')
        .select('id, batch_id, batches(monthly_fee)')
        .eq('institute_id', user.institute_id)
        .in('id', explicitStudentIds)
      for (const s of studentRows || []) {
        if (!targets.has(s.id)) {
          const fee = (s.batches as { monthly_fee?: number | null } | null)?.monthly_fee
          targets.set(s.id, { batch_id: s.batch_id, monthly_fee: fee != null ? Number(fee) : null })
        }
      }
    }

    if (targets.size === 0) {
      return NextResponse.json({ error: 'No students found for the selection' }, { status: 400 })
    }

    const monthDate = firstOfMonth(period_month)
    const periodLabel = periodLabelFromMonth(period_month)

    // Skip students who already have an invoice for this month (single query).
    const { data: existing } = await supabaseAdmin
      .from('fee_invoices')
      .select('student_id')
      .eq('institute_id', user.institute_id)
      .eq('period_month', monthDate)
      .in('student_id', [...targets.keys()])
    const already = new Set((existing || []).map(e => e.student_id))

    const rows: Record<string, unknown>[] = []
    let skippedNoAmount = 0
    for (const [studentId, info] of targets) {
      if (already.has(studentId)) continue
      const amount = overrideAmount != null ? overrideAmount : info.monthly_fee
      if (amount == null || Number.isNaN(amount) || amount < 0) { skippedNoAmount++; continue }
      rows.push({
        institute_id: user.institute_id,
        student_id: studentId,
        batch_id: info.batch_id,
        period_label: periodLabel,
        period_month: monthDate,
        amount,
        due_date: due_date || null,
        status: 'pending',
      })
    }

    if (rows.length > 0) {
      const { error } = await supabaseAdmin.from('fee_invoices').insert(rows)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    logActivity({
      instituteId: user.institute_id,
      eventType: 'fee_charged',
      actorType: 'admin',
      actorId: user.id,
      entityType: 'batch',
      entityName: `${rows.length} invoice(s)`,
      details: { period: periodLabel, count: rows.length, batches: batchIds.length, students: explicitStudentIds.length },
    }).catch(console.error)

    return NextResponse.json({ created: rows.length, skipped: already.size, skippedNoAmount })
  }

  // Single ad-hoc charge
  const { student_id, batch_id, period_label, amount, due_date, notes, period_month } = body
  if (!student_id || !period_label || amount == null) {
    return NextResponse.json({ error: 'student_id, period_label and amount are required' }, { status: 400 })
  }
  if (Number(amount) < 0 || Number.isNaN(Number(amount))) {
    return NextResponse.json({ error: 'Amount must be a non-negative number' }, { status: 400 })
  }

  const { data: student } = await supabaseAdmin
    .from('students')
    .select('id, name')
    .eq('id', student_id)
    .eq('institute_id', user.institute_id)
    .single()
  if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 })

  const { data, error } = await supabaseAdmin
    .from('fee_invoices')
    .insert({
      institute_id: user.institute_id,
      student_id,
      batch_id: batch_id || null,
      period_label,
      period_month: period_month ? firstOfMonth(period_month) : null,
      amount: Number(amount),
      due_date: due_date || null,
      notes: notes || null,
      status: 'pending',
    })
    .select('*, students(name), batches(name, subject, teacher_id, teachers(name))')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  logActivity({
    instituteId: user.institute_id,
    eventType: 'fee_charged',
    actorType: 'admin',
    actorId: user.id,
    entityType: 'student',
    entityId: student_id,
    entityName: student.name,
    details: { period: period_label, amount: Number(amount) },
  }).catch(console.error)

  return NextResponse.json(data)
}

// PATCH /api/fees — admin, or teacher for their own batches. Edit or waive/unwaive.
//   Edit:    { id, amount?, due_date?, period_label?, notes? }
//   Waive:   { id, action: 'waive' }
//   Unwaive: { id, action: 'unwaive' }  (recomputes status from the ledger)
export async function PATCH(req: NextRequest) {
  const user = getAuthUser(req)
  if (!user || (user.role !== 'admin' && user.role !== 'teacher')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id, action, amount, due_date, period_label, notes } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const { data: invoice } = await supabaseAdmin
    .from('fee_invoices')
    .select('id, student_id, batch_id, period_label, students(name)')
    .eq('id', id)
    .eq('institute_id', user.institute_id)
    .single()
  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

  // Teachers may only act on invoices for batches assigned to them.
  if (user.role === 'teacher') {
    const myBatchIds = await getTeacherBatchIds(user.id, user.institute_id)
    if (!invoice.batch_id || !myBatchIds.includes(invoice.batch_id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  if (action === 'waive') {
    const { error } = await supabaseAdmin
      .from('fee_invoices')
      .update({ status: 'waived' })
      .eq('id', id)
      .eq('institute_id', user.institute_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    logActivity({
      instituteId: user.institute_id,
      eventType: 'fee_waived',
      actorType: user.role as 'admin' | 'teacher',
      actorId: user.id,
      entityType: 'student',
      entityId: invoice.student_id,
      entityName: (invoice.students as { name?: string } | null)?.name,
      details: { period: invoice.period_label },
    }).catch(console.error)

    const { data } = await supabaseAdmin
      .from('fee_invoices')
      .select('*, students(name), batches(name, subject, teacher_id, teachers(name))')
      .eq('id', id)
      .single()
    return NextResponse.json(data)
  }

  if (action === 'unwaive') {
    // Reset to a payment-derived status, then recompute from the ledger.
    await supabaseAdmin.from('fee_invoices').update({ status: 'pending' }).eq('id', id).eq('institute_id', user.institute_id)
    await recomputeInvoice(id, user.institute_id)
    const { data } = await supabaseAdmin
      .from('fee_invoices')
      .select('*, students(name), batches(name, subject, teacher_id, teachers(name))')
      .eq('id', id)
      .single()
    return NextResponse.json(data)
  }

  // Field edit
  const patch: Record<string, unknown> = {}
  if (amount != null) {
    if (Number(amount) < 0 || Number.isNaN(Number(amount))) {
      return NextResponse.json({ error: 'Amount must be a non-negative number' }, { status: 400 })
    }
    patch.amount = Number(amount)
  }
  if (due_date !== undefined) patch.due_date = due_date || null
  if (period_label !== undefined) patch.period_label = period_label
  if (notes !== undefined) patch.notes = notes || null

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('fee_invoices')
    .update(patch)
    .eq('id', id)
    .eq('institute_id', user.institute_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Amount change can flip paid/partial/pending — keep status consistent.
  if (patch.amount != null) await recomputeInvoice(id, user.institute_id)

  const { data } = await supabaseAdmin
    .from('fee_invoices')
    .select('*, students(name), batches(name, subject, teacher_id, teachers(name))')
    .eq('id', id)
    .single()
  return NextResponse.json(data)
}

// DELETE /api/fees — admin only. Only invoices with no payments can be deleted;
// otherwise waive to preserve the ledger.
export async function DELETE(req: NextRequest) {
  const user = getAuthUser(req)
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const { count } = await supabaseAdmin
    .from('fee_payments')
    .select('id', { count: 'exact', head: true })
    .eq('invoice_id', id)
    .eq('institute_id', user.institute_id)

  if ((count ?? 0) > 0) {
    return NextResponse.json({ error: 'This invoice has payments. Waive it instead of deleting.' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('fee_invoices')
    .delete()
    .eq('id', id)
    .eq('institute_id', user.institute_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
