import StatusBadge from '../../students/components/StatusBadge';
import { formatCurrency, getDueBucket } from '../feeUtils';

export default function FeeAssignmentTable({ assignments, canCollect, onCollect }) {
  return (
    <div className="overflow-hidden border border-slate-100 rounded-lg bg-white">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#f5f5f6] text-slate-500">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">Student</th>
              <th className="text-left px-4 py-3 font-semibold">Class</th>
              <th className="text-right px-4 py-3 font-semibold">Total</th>
              <th className="text-right px-4 py-3 font-semibold">Paid</th>
              <th className="text-right px-4 py-3 font-semibold">Due</th>
              <th className="text-left px-4 py-3 font-semibold">Status</th>
              <th className="text-left px-4 py-3 font-semibold">Aging</th>
              <th className="text-right px-4 py-3 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {assignments.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="font-semibold text-slate-900">{item.studentName}</div>
                  <div className="text-xs text-slate-500">{item.studentId}</div>
                </td>
                <td className="px-4 py-3 text-slate-600">{item.classKey}</td>
                <td className="px-4 py-3 text-right font-semibold">{formatCurrency(item.totalAmount)}</td>
                <td className="px-4 py-3 text-right text-emerald-700">{formatCurrency(item.paidAmount)}</td>
                <td className="px-4 py-3 text-right text-rose-700">{formatCurrency(item.dueAmount)}</td>
                <td className="px-4 py-3"><StatusBadge value={item.status} /></td>
                <td className="px-4 py-3"><StatusBadge value={getDueBucket(item.dueDate, item.status)} /></td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => onCollect(item.id)} disabled={!canCollect || item.dueAmount <= 0} className="h-8 px-3 rounded-md bg-[#33373e] text-white text-xs font-semibold disabled:bg-slate-300">
                    Collect
                  </button>
                </td>
              </tr>
            ))}
            {!assignments.length && (
              <tr>
                <td colSpan="8" className="px-4 py-10 text-center text-slate-500">No fee assignments found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
