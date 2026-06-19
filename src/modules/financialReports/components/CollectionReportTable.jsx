import { formatCurrency } from '../../fees/feeUtils';

export default function CollectionReportTable({ rows }) {
  return (
    <div className="overflow-hidden border border-slate-100 rounded-lg bg-white">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#f5f5f6] text-slate-500">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">Student</th>
              <th className="text-left px-4 py-3 font-semibold">Class</th>
              <th className="text-left px-4 py-3 font-semibold">Date</th>
              <th className="text-left px-4 py-3 font-semibold">Mode</th>
              <th className="text-left px-4 py-3 font-semibold">Reference</th>
              <th className="text-right px-4 py-3 font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="font-semibold text-slate-900">{item.studentName}</div>
                  <div className="text-xs text-slate-500">{item.studentId}</div>
                </td>
                <td className="px-4 py-3 text-slate-600">{item.classKey || '-'}</td>
                <td className="px-4 py-3 text-slate-600">{item.paymentDate}</td>
                <td className="px-4 py-3 text-slate-600">{item.paymentMode}</td>
                <td className="px-4 py-3 text-slate-600">{item.referenceNo || '-'}</td>
                <td className="px-4 py-3 text-right font-bold text-emerald-700">{formatCurrency(item.amount)}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan="6" className="px-4 py-10 text-center text-slate-500">No collections found for this filter.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
