'use client'
import { formatINR } from '@/lib/fees'
import { FeeInvoice, STATUS_PILL } from './types'

type Props = {
  invoice: FeeInvoice
  onRecordPayment: (inv: FeeInvoice) => void
  onEdit: (inv: FeeInvoice) => void
  onLedger: (inv: FeeInvoice) => void
  onWaiveClick: (id: string) => void
  waivingId: string | null
  actionLoading: boolean
  onConfirmWaive: (id: string) => void
  onCancelWaive: () => void
}

export default function InvoiceCard({
  invoice: inv, onRecordPayment, onEdit, onLedger, onWaiveClick,
  waivingId, actionLoading, onConfirmWaive, onCancelWaive,
}: Props) {
  const balance = Number(inv.amount) - Number(inv.amount_paid)
  const open = inv.status !== 'waived' && inv.status !== 'paid'

  return (
    <div className="bg-white rounded-xl shadow-sm p-4">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 truncate">{inv.students?.name || 'Unknown'}</p>
          <p className="text-sm text-gray-500">{inv.period_label}{inv.batches?.name ? ` · ${inv.batches.name}` : ''}</p>
          {inv.due_date && <p className="text-xs text-gray-400 mt-0.5">Due {new Date(inv.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>}
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ml-2 ${STATUS_PILL[inv.status]}`}>
          {inv.status}
        </span>
      </div>

      <div className="flex items-baseline justify-between mt-2 text-sm">
        <span className="text-gray-500">
          {formatINR(Number(inv.amount_paid))} <span className="text-gray-400">/ {formatINR(Number(inv.amount))}</span>
        </span>
        {inv.status !== 'waived' && balance > 0 && (
          <span className="font-semibold text-orange-600">{formatINR(balance)} due</span>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mt-3">
        {open && (
          <button onClick={() => onRecordPayment(inv)}
            className="text-xs bg-green-50 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-100 font-medium">
            Record Payment
          </button>
        )}
        {inv.status !== 'waived' && (
          <button onClick={() => onEdit(inv)}
            className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-100">
            Edit
          </button>
        )}
        {Number(inv.amount_paid) !== 0 && (
          <button onClick={() => onLedger(inv)}
            className="text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-100">
            Ledger
          </button>
        )}
        {open && (
          <button onClick={() => onWaiveClick(inv.id)}
            className="text-xs bg-gray-50 text-gray-500 px-3 py-1.5 rounded-lg hover:bg-gray-100">
            Waive
          </button>
        )}
      </div>

      {waivingId === inv.id && (
        <div className="mt-3 bg-gray-50 rounded-lg p-3 space-y-2">
          <p className="text-xs text-gray-600">Waive this fee? It will be marked settled with no payment due.</p>
          <div className="flex gap-2">
            <button onClick={() => onConfirmWaive(inv.id)} disabled={actionLoading}
              className="flex-1 bg-gray-700 text-white py-1.5 rounded-lg text-xs font-medium disabled:opacity-50">
              {actionLoading ? 'Waiving...' : 'Confirm Waive'}
            </button>
            <button onClick={onCancelWaive}
              className="flex-1 border py-1.5 rounded-lg text-xs text-gray-600">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
