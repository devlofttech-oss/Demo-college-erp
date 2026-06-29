import StatusBadge from '../../students/components/StatusBadge';
import { formatCurrency } from '../../fees/feeUtils';

export default function FeeStatusCard({ feeStatus }) {
  const total = Math.max(Number(feeStatus.totalAssigned || 0), 1);
  const paidPercent = Math.round((Number(feeStatus.totalPaid || 0) / total) * 100);
  const adjustedPercent = Math.round((Number(feeStatus.totalAdjusted || 0) / total) * 100);
  const duePercent = Math.max(0, 100 - paidPercent - adjustedPercent);
  const graph = [
    { label: 'Paid', value: paidPercent, color: '#22c55e' },
    { label: 'Adjustment', value: adjustedPercent, color: '#64748b' },
    { label: 'Due', value: duePercent, color: '#ef4444' },
  ];
  return (
    <div className="bg-white border border-slate-100 rounded-lg p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-slate-900">Fee Status</h3>
        <StatusBadge value={feeStatus.status} />
      </div>
      <div className="space-y-3 text-sm">
        <div className="h-3 rounded-full bg-[#f5f5f6] overflow-hidden flex">
          {graph.map((item) => (
            <div key={item.label} className="h-full" style={{ width: `${item.value}%`, background: item.color }} />
          ))}
        </div>
        <div className="flex items-center justify-between"><span className="text-slate-500">Assigned</span><b>{formatCurrency(feeStatus.totalAssigned)}</b></div>
        <div className="flex items-center justify-between"><span className="text-slate-500">Paid</span><b className="text-emerald-700">{formatCurrency(feeStatus.totalPaid)}</b></div>
        <div className="flex items-center justify-between"><span className="text-slate-500">Adjustment</span><b>{formatCurrency(feeStatus.totalAdjusted)}</b></div>
        <div className="flex items-center justify-between border-t border-slate-100 pt-3"><span className="text-slate-500">Due</span><b className="text-rose-700">{formatCurrency(feeStatus.totalDue)}</b></div>
      </div>
    </div>
  );
}
