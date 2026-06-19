import StatusBadge from '../../students/components/StatusBadge';
import { formatCurrency } from '../feeUtils';

export default function FeeStructurePanel({ structures, canEdit, onEdit, onAssign }) {
  return (
    <aside className="xl:w-[32%] space-y-4">
      <div className="bg-white border border-slate-100 rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-900">Fee Structures</h3>
          <span className="text-xs text-slate-500">{structures.length} active</span>
        </div>
        <div className="space-y-3">
          {structures.map((item) => (
            <div key={item.id} className="rounded-lg bg-[#f5f5f6] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-slate-900">{item.name}</div>
                  <div className="text-xs text-slate-500 mt-1">{item.classKey} | {item.academicYear}</div>
                </div>
                <StatusBadge value={item.status} />
              </div>
              <div className="grid grid-cols-2 gap-2 mt-4 text-xs text-slate-600">
                <div className="rounded-md bg-white p-2">Tuition<br /><b>{formatCurrency(item.tuitionFee)}</b></div>
                <div className="rounded-md bg-white p-2">Library<br /><b>{formatCurrency(item.libraryFee)}</b></div>
                <div className="rounded-md bg-white p-2">Lab<br /><b>{formatCurrency(item.labFee)}</b></div>
                <div className="rounded-md bg-white p-2">Transport<br /><b>{formatCurrency(item.transportFee)}</b></div>
              </div>
              <div className="flex items-center justify-between mt-4">
                <div>
                  <div className="text-xs text-slate-500">Total</div>
                  <div className="font-bold text-slate-900">{formatCurrency(item.totalAmount)}</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => onAssign(item)} disabled={!canEdit} className="h-8 px-3 rounded-md bg-white border border-slate-200 text-xs font-semibold disabled:text-slate-300">Assign</button>
                  <button onClick={() => onEdit(item)} disabled={!canEdit} className="h-8 px-3 rounded-md bg-[#33373e] text-white text-xs font-semibold disabled:bg-slate-300">Edit</button>
                </div>
              </div>
            </div>
          ))}
          {!structures.length && <div className="rounded-lg bg-[#f5f5f6] p-4 text-sm text-slate-500">No fee structures created yet.</div>}
        </div>
      </div>
    </aside>
  );
}
