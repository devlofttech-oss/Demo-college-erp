import { Edit3 } from 'lucide-react';
import { formatCurrency, formatPaymentDate } from '../feeUtils';

export default function FeeCollectionTable({ collections, onEdit }) {
  return (
    <div className="overflow-hidden border border-slate-100 rounded-lg bg-white">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#f5f5f6] text-slate-500">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">Student</th>
              <th className="text-left px-4 py-3 font-semibold">No.</th>
              <th className="text-left px-4 py-3 font-semibold">Fee Structure</th>
              <th className="text-left px-4 py-3 font-semibold">Class</th>
              <th className="text-left px-4 py-3 font-semibold">Date</th>
              <th className="text-left px-4 py-3 font-semibold">Mode</th>
              <th className="text-left px-4 py-3 font-semibold">Credited To</th>
              <th className="text-left px-4 py-3 font-semibold">Reference</th>
              <th className="text-right px-4 py-3 font-semibold">Amount</th>
              <th className="text-right px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {collections.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="font-semibold text-slate-900">{item.studentName}</div>
                  <div className="text-xs text-slate-500">{item.studentId || '-'}</div>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  <div className="font-bold text-slate-800">
                    {item.installmentNo ? `${item.installmentNo}/${item.installmentCount || item.installmentNo}` : '-'}
                  </div>
                  {item.batchPaymentId && <div className="text-[11px] text-slate-500">Batch</div>}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  <div className="font-semibold text-slate-800">{item.feeStructureName || '-'}</div>
                  <div className="text-xs text-slate-500">{item.feeStructureId || ''}</div>
                </td>
                <td className="px-4 py-3 text-slate-600">{item.classKey || '-'}</td>
                <td className="px-4 py-3 text-slate-600">
                  <div>{formatPaymentDate(item.paymentDate || item.createdAtText)}</div>
                  {item.paymentTime && <div className="text-xs text-slate-500">{item.paymentTime}</div>}
                </td>
                <td className="px-4 py-3 text-slate-600">{item.paymentMode || '-'}</td>
                <td className="px-4 py-3 text-slate-600">{item.creditedToAccount || '-'}</td>
                <td className="px-4 py-3 text-slate-600">{item.referenceNo || '-'}</td>
                <td className="px-4 py-3 text-right">
                  <div className="font-bold text-emerald-700">{formatCurrency(item.amount)}</div>
                  {item.admissionThroughAgent && (
                    <div className="text-[11px] font-semibold text-cyan-700">
                      Agent payout {formatCurrency(item.agentFeePaidAmount)} | Pending {formatCurrency(item.pendingAgentFeeBalance)}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => onEdit?.(item)}
                    className="h-8 px-3 rounded-md bg-white border border-slate-200 text-xs font-semibold text-slate-700 inline-flex items-center gap-1"
                  >
                    <Edit3 size={13} /> Edit
                  </button>
                </td>
              </tr>
            ))}
            {!collections.length && (
              <tr>
                <td colSpan="10" className="px-4 py-10 text-center text-slate-500">No fee collections found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
