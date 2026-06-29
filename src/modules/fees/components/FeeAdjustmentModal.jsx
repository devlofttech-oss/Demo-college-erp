import { useState } from 'react';
import { formatCurrency } from '../feeUtils';

export default function FeeAdjustmentModal({ assignments, initialAssignmentId = '', onClose, onSave }) {
  const [form, setForm] = useState({
    assignmentId: initialAssignmentId || assignments[0]?.id || '',
    amount: '',
    reason: '',
  });

  const submit = (event) => {
    event.preventDefault();
    onSave(form);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-xl bg-white rounded-xl shadow-2xl border border-slate-200">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Approve Fee Adjustment</h2>
            <p className="text-sm text-slate-500">Use for waivers, concessions, and approved write-offs.</p>
          </div>
          <button type="button" onClick={onClose} className="h-9 w-9 rounded-full hover:bg-slate-100 text-slate-500">x</button>
        </div>
        <div className="p-6 space-y-4">
          <label className="block">
            <span className="block text-xs font-semibold text-slate-500 mb-1.5">Student Fee</span>
            <select value={form.assignmentId} onChange={(event) => setForm((prev) => ({ ...prev, assignmentId: event.target.value }))} className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm">
              {assignments.map((item) => <option key={item.id} value={item.id}>{item.studentName} - {formatCurrency(item.dueAmount)} due</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-semibold text-slate-500 mb-1.5">Adjustment Amount</span>
            <input type="number" value={form.amount} onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))} className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm" />
          </label>
          <label className="block">
            <span className="block text-xs font-semibold text-slate-500 mb-1.5">Reason</span>
            <textarea value={form.reason} onChange={(event) => setForm((prev) => ({ ...prev, reason: event.target.value }))} className="w-full min-h-24 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </label>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="h-10 px-5 rounded-lg bg-slate-100 text-slate-700 font-semibold text-sm">Cancel</button>
          <button type="submit" className="h-10 px-5 rounded-lg bg-[#33373e] text-white font-semibold text-sm">Approve Adjustment</button>
        </div>
      </form>
    </div>
  );
}
