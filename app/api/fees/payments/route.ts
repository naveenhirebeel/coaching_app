import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthUser, getSuperAdminUser, isApprovedInstitute } from '@/lib/auth'
import { recomputeInvoice, PAYMENT_MODES, PaymentMode } from '@/lib/fees'
import { logActivity } from '@/lib/activity'

// GET /api/fees/payments — ledger for the caller's institute.
// Query: invoice_id or student_id. Readable by admin, teacher, super_admin.
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
    .from('fee_payments')
    .select('*, students(name), fee_invoices(period_label)')
    .eq('institute_id', instituteId)
    .order('paid_at', { ascending: false })

  const invoiceId = searchParams.get('invoice_id')
  const studentId = searchParams.get('student_id')
  if (invoiceId) query = query.eq('invoice_id', invoiceId)
  if (studentId) query = query.eq('student_id', studentId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

// POST /api/fees/payments — record a payment. Allowed for admin AND teacher.
// Body: { invoice_id, amount, mode, reference?, note?, paid_at? }
// A negative amount records a correction/reversal. After insert the parent
// invoice's amount_paid + status are recomputed from the full ledger.
export async function POST(req: NextRequest) {
  const user = getAuthUser(req)
  if (!user || (user.role !== 'admin' && user.role !== 'teacher')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { invoice_id, amount, mode, reference, note, paid_at } = await req.json()

  if (!invoice_id || amount == null || !mode) {
    return NextResponse.json({ error: 'invoice_id, amount and mode are required' }, { status: 400 })
  }
  if (Number.isNaN(Number(amount)) || Number(amount) === 0) {
    return NextResponse.json({ error: 'Amount must be a non-zero number' }, { status: 400 })
  }
  if (!PAYMENT_MODES.includes(mode as PaymentMode)) {
    return NextResponse.json({ error: 'Invalid payment mode' }, { status: 400 })
  }

  // Invoice must belong to the caller's institute.
  const { data: invoice } = await supabaseAdmin
    .from('fee_invoices')
    .select('id, student_id, period_label, students(name)')
    .eq('id', invoice_id)
    .eq('institute_id', user.institute_id)
    .single()
  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

  const { data: payment, error } = await supabaseAdmin
    .from('fee_payments')
    .insert({
      institute_id: user.institute_id,
      invoice_id,
      student_id: invoice.student_id,
      amount: Number(amount),
      mode,
      reference: reference || null,
      note: note || null,
      recorded_by: user.id,
      recorded_by_role: user.role,
      paid_at: paid_at || undefined,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const recomputed = await recomputeInvoice(invoice_id, user.institute_id)

  logActivity({
    instituteId: user.institute_id,
    eventType: 'fee_paid',
    actorType: user.role as 'admin' | 'teacher',
    actorId: user.id,
    entityType: 'student',
    entityId: invoice.student_id,
    entityName: (invoice.students as { name?: string } | null)?.name,
    details: { period: invoice.period_label, amount: Number(amount), mode },
  }).catch(console.error)

  return NextResponse.json({ payment, invoice: recomputed })
}
