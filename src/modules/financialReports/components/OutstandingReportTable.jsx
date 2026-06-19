import StatusBadge from '../../students/components/StatusBadge';
import { formatCurrency } from '../../fees/feeUtils';

export default function OutstandingReportTable({ rows }) {
  return (
    <div className="overflow-hidden border border-slate-100 rounded-lg bg-white">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#f5f5f6] text-slate-500">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">Student</th>
              <th className="text-left px-4 py-3 font-semibold">Class</th>
              <th className="text-left px-4 py-3 font-semibold">Due Date</th>
              <th className="text-left px-4 py-3 font-semibold">Aging</th>
              <th className="text-right px-4 py-3 font-semibold">Assigned</th>
              <th className="text-right px-4 py-3 font-semibold">Paid</th>
              <th className="text-right px-4 py-3 font-semibold">Outstanding</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="font-semibold text-slate-900">{item.studentName}</div>
                  <div className="text-xs text-slate-500">{item.studentId}</div>
                </td>
                <td className="px-4 py-3 text-slate-600">{item.classKey}</td>
                <td className="px-4 py-3 text-slate-600">{item.dueDate}</td>
                <td className="px-4 py-3"><StatusBadge value={item.dueBucket} /></td>
                <td className="px-4 py-3 text-right">{formatCurrency(item.totalAmount)}</td>
                <td className="px-4 py-3 text-right text-emerald-700">{formatCurrency(item.paidAmount)}</td>
                <td className="px-4 py-3 text-right font-bold text-rose-700">{formatCurrency(item.dueAmount)}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan="7" className="px-4 py-10 text-center text-slate-500">No outstanding dues found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
