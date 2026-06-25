import StatusBadge from '../../students/components/StatusBadge';
import { formatCurrency } from '../../fees/feeUtils';

export default function FeeStatusCard({ feeStatus }) {
  return (
    <div className="bg-white border border-slate-100 rounded-lg p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-slate-900">Fee Status</h3>
        <StatusBadge value={feeStatus.status} />
      </div>
      <div className="space-y-3 text-sm">
        <div className="flex items-center justify-between"><span className="text-slate-500">Assigned</span><b>{formatCurrency(feeStatus.totalAssigned)}</b></div>
        <div className="flex items-center justify-between"><span className="text-slate-500">Paid</span><b className="text-emerald-700">{formatCurrency(feeStatus.totalPaid)}</b></div>
        <div className="flex items-center justify-between"><span className="text-slate-500">Adjustment</span><b>{formatCurrency(feeStatus.totalAdjusted)}</b></div>
        <div className="flex items-center justify-between border-t border-slate-100 pt-3"><span className="text-slate-500">Due</span><b className="text-rose-700">{formatCurrency(feeStatus.totalDue)}</b></div>
      </div>
    </div>
  );
}
