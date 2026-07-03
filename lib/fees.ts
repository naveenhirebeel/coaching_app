// Fee collection helpers — shared by the fee API routes.

export type InvoiceStatus = 'pending' | 'partial' | 'paid' | 'waived'
export type PaymentMode = 'cash' | 'upi' | 'card' | 'bank' | 'cheque'

export const PAYMENT_MODES: PaymentMode[] = ['cash', 'upi', 'card', 'bank', 'cheque']

// ₹ with no decimals — matches the en-IN formatting used elsewhere in the app.
export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

// "2026-07" or "2026-07-01" → "July 2026". Falls back to the raw string.
export function periodLabelFromMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  if (!y || !m) return ym
  const d = new Date(Date.UTC(y, m - 1, 1))
  return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

// Normalize a "YYYY-MM" (or "YYYY-MM-DD") input to the first-of-month date string.
export function firstOfMonth(ym: string): string {
  return `${ym.slice(0, 7)}-01`
}

// Derive status from amounts. 'waived' is set explicitly by an admin and is never
// auto-overwritten by a recompute.
export function deriveStatus(amount: number, amountPaid: number): InvoiceStatus {
  if (amountPaid <= 0) return 'pending'
  if (amountPaid >= amount) return 'paid'
  return 'partial'
}

// Batch ids assigned to a teacher, used to scope teacher access to fees/payments
// (a teacher may only see and act on invoices for their own batches).
export async function getTeacherBatchIds(teacherId: string, instituteId: string): Promise<string[]> {
  const { supabaseAdmin } = await import('@/lib/supabase')
  const { data } = await supabaseAdmin
    .from('batches')
    .select('id')
    .eq('institute_id', instituteId)
    .eq('teacher_id', teacherId)
  return (data || []).map(b => b.id)
}

// Recompute an invoice's amount_paid + status from its payment ledger. Called
// after every payment insert. Returns the new values, or null if not found.
export async function recomputeInvoice(
  invoiceId: string,
  instituteId: string
): Promise<{ amount_paid: number; status: InvoiceStatus } | null> {
  const { supabaseAdmin } = await import('@/lib/supabase')

  const { data: inv } = await supabaseAdmin
    .from('fee_invoices')
    .select('amount, status')
    .eq('id', invoiceId)
    .eq('institute_id', instituteId)
    .single()
  if (!inv) return null

  const { data: payments } = await supabaseAdmin
    .from('fee_payments')
    .select('amount')
    .eq('invoice_id', invoiceId)

  const paid = (payments || []).reduce((sum, p) => sum + Number(p.amount), 0)
  const status: InvoiceStatus =
    inv.status === 'waived' ? 'waived' : deriveStatus(Number(inv.amount), paid)

  await supabaseAdmin
    .from('fee_invoices')
    .update({ amount_paid: paid, status })
    .eq('id', invoiceId)
    .eq('institute_id', instituteId)

  return { amount_paid: paid, status }
}
