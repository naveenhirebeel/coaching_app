'use client'
import { useEffect, useState } from 'react'
import BottomSheet from '@/components/BottomSheet'
import { formatINR } from '@/lib/fees'
import { FeeInvoice, FeePayment } from './types'

// Read-only payment history for one invoice. Fetches on mount (mounted only while
// open, key={invoice.id}).
export default function LedgerSheet({
  invoice, onClose,
}: {
  invoice: FeeInvoice
  onClose: () => void
}) {
  const [ledger, setLedger] = useState<FeePayment[]>([])
  const [loading, setLoading] = useState(true)

  function getToken() { return localStorage.getItem('token') || '' }

  useEffect(() => {
    // Fetch on open; setState runs after the await, not synchronously.
    ;(async () => {
      const res = await fetch(`/api/fees/payments?invoice_id=${invoice.id}`, { headers: { Authorization: `Bearer ${getToken()}` } })
      setLedger(res.ok ? await res.json() : [])
      setLoading(false)
    })()
  }, [invoice.id])

  return (
    <BottomSheet open onClose={onClose} title="Payment Ledger">
      <div className="space-y-3">
        <div className="bg-gray-50 rounded-lg p-3 text-sm">
          <p className="font-medium text-gray-900">{invoice.students?.name}</p>
          <p className="text-gray-500">{invoice.period_label}</p>
        </div>
        {loading ? (
          <p className="text-center text-gray-400 py-6 text-sm">Loading...</p>
        ) : ledger.length === 0 ? (
          <p className="text-center text-gray-400 py-6 text-sm">No payments recorded.</p>
        ) : (
          <ul className="space-y-2">
            {ledger.map(p => (
              <li key={p.id} className="flex items-center justify-between border-b border-gray-100 pb-2">
                <div>
                  <p className={`text-sm font-medium ${Number(p.amount) < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                    {formatINR(Number(p.amount))} <span className="text-xs text-gray-400 uppercase">{p.mode}</span>
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date(p.paid_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
                    {p.reference ? ` · ${p.reference}` : ''}
                    {p.recorded_by_role ? ` · by ${p.recorded_by_role}` : ''}
                  </p>
                  {p.note && <p className="text-xs text-gray-400">{p.note}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </BottomSheet>
  )
}
