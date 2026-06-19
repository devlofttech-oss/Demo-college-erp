import { formatCurrency } from '../feeUtils';

export default function FeeReportsPanel({ collections, adjustments }) {
  return (
    <div className="grid lg:grid-cols-2 gap-4 mt-5">
      <div className="bg-white border border-slate-100 rounded-lg p-5">
        <h3 className="font-bold text-slate-900 mb-4">Recent Collections</h3>
        <div className="space-y-3">
          {collections.slice(0, 5).map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-lg bg-[#f5f5f6] p-3">
              <div>
                <div className="font-semibold text-sm">{item.studentName}</div>
                <div className="text-xs text-slate-500">{item.paymentMode} | {item.paymentDate}</div>
              </div>
              <div className="font-bold text-emerald-700">{formatCurrency(item.amount)}</div>
            </div>
          ))}
          {!collections.length && <div className="text-sm text-slate-500">No collections posted yet.</div>}
        </div>
      </div>
      <div className="bg-white border border-slate-100 rounded-lg p-5">
        <h3 className="font-bold text-slate-900 mb-4">Adjustments & Waivers</h3>
        <div className="space-y-3">
          {adjustments.slice(0, 5).map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-lg bg-[#f5f5f6] p-3">
              <div>
                <div className="font-semibold text-sm">{item.studentName}</div>
                <div className="text-xs text-slate-500">{item.reason}</div>
              </div>
              <div className="font-bold text-sky-700">{formatCurrency(item.amount)}</div>
            </div>
          ))}
          {!adjustments.length && <div className="text-sm text-slate-500">No adjustments approved yet.</div>}
        </div>
      </div>
    </div>
  );
}
