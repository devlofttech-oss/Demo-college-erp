import StatusBadge from '../../students/components/StatusBadge';
import { formatCurrency } from '../../fees/feeUtils';

export default function FeeStatusCard({ feeStatus }) {
  return (
    <div className="bg-white border border-slate-100 rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-slate-900">Fee Status</h3>
        <StatusBadge value={feeStatus.status} />
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="rounded-lg bg-[#f5f5f6] p-3">Assigned<br /><b>{formatCurrency(feeStatus.totalAssigned)}</b></div>
        <div className="rounded-lg bg-[#f5f5f6] p-3">Paid<br /><b className="text-emerald-700">{formatCurrency(feeStatus.totalPaid)}</b></div>
        <div className="rounded-lg bg-[#f5f5f6] p-3">Adjustment<br /><b>{formatCurrency(feeStatus.totalAdjusted)}</b></div>
        <div className="rounded-lg bg-[#f5f5f6] p-3">Due<br /><b className="text-rose-700">{formatCurrency(feeStatus.totalDue)}</b></div>
      </div>
    </div>
  );
}
