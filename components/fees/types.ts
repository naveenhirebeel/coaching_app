import type { InvoiceStatus } from '@/lib/fees'

// Shared shapes for the fee UI (admin + teacher pages and the fee components).

export type FeeInvoice = {
  id: string
  student_id: string
  batch_id: string | null
  period_label: string
  period_month: string | null
  amount: number
  amount_paid: number
  due_date: string | null
  status: InvoiceStatus
  notes?: string | null
  students?: { name: string }
  batches?: { name: string; subject: string; teacher_id?: string | null; teachers?: { name: string } | null }
}

export type FeePayment = {
  id: string
  amount: number
  mode: string
  reference: string | null
  note: string | null
  paid_at: string
  recorded_by_role: string | null
  fee_invoices?: { period_label: string }
}

export const STATUS_PILL: Record<InvoiceStatus, string> = {
  pending: 'bg-orange-100 text-orange-700',
  partial: 'bg-amber-100 text-amber-700',
  paid: 'bg-green-100 text-green-700',
  waived: 'bg-gray-100 text-gray-500',
}
