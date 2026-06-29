import { useState } from 'react';
import { formatCurrency } from '../feeUtils';

export default function FeeCollectionModal({ assignments, initialAssignmentId = '', onClose, onSave, students = [] }) {
  const hasInitialAssignment = Boolean(initialAssignmentId);
  const [form, setForm] = useState({
    entryMode: hasInitialAssignment ? 'assignment' : 'manual',
    assignmentId: initialAssignmentId || '',
    studentRecordId: students[0]?.id || '',
    amount: '',
    paymentMode: 'Cash',
    referenceNo: '',
    paymentDate: new Date().toISOString().slice(0, 10),
    collectedBy: 'Admin Office',
  });

  const selected = assignments.find((item) => item.id === form.assignmentId);
  const manualMode = form.entryMode === 'manual';

  const submit = (event) => {
    event.preventDefault();
    onSave(form);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-xl bg-white rounded-xl shadow-2xl border border-slate-200">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Record Fee Collection</h2>
            <p className="text-sm text-slate-500">Manual/offline payment record.</p>
          </div>
          <button type="button" onClick={onClose} className="h-9 w-9 rounded-full hover:bg-slate-100 text-slate-500">x</button>
        </div>
        <div className="p-6 grid sm:grid-cols-2 gap-4">
          <label className="sm:col-span-2">
            <span className="block text-xs font-semibold text-slate-500 mb-1.5">Entry Type</span>
            <select
              value={form.entryMode}
              onChange={(event) => setForm((prev) => ({
                ...prev,
                entryMode: event.target.value,
                assignmentId: event.target.value === 'assignment' ? prev.assignmentId || assignments[0]?.id || '' : '',
              }))}
              className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm"
            >
              <option value="manual">Manual Entry</option>
              <option value="assignment" disabled={!assignments.length}>Against Due Assignment</option>
            </select>
          </label>
          {manualMode ? (
          <label className="sm:col-span-2">
            <span className="block text-xs font-semibold text-slate-500 mb-1.5">Student</span>
            <select value={form.studentRecordId} onChange={(event) => setForm((prev) => ({ ...prev, studentRecordId: event.target.value }))} className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm">
              {students.map((item) => <option key={item.id} value={item.id}>{item.name} - {item.studentId || item.admissionNo}</option>)}
            </select>
          </label>
          ) : (
          <label className="sm:col-span-2">
            <span className="block text-xs font-semibold text-slate-500 mb-1.5">Student Fee</span>
            <select value={form.assignmentId} onChange={(event) => setForm((prev) => ({ ...prev, assignmentId: event.target.value }))} className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm">
              <option value="">Select due assignment</option>
              {assignments.map((item) => <option key={item.id} value={item.id}>{item.studentName} - {formatCurrency(item.dueAmount)} due</option>)}
            </select>
          </label>
          )}
          <label>
            <span className="block text-xs font-semibold text-slate-500 mb-1.5">Amount</span>
            <input type="number" value={form.amount} onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))} placeholder={manualMode ? 'Enter amount' : selected?.dueAmount || 0} className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm" />
          </label>
          <label>
            <span className="block text-xs font-semibold text-slate-500 mb-1.5">Payment Mode</span>
            <select value={form.paymentMode} onChange={(event) => setForm((prev) => ({ ...prev, paymentMode: event.target.value }))} className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm">
              {['Cash', 'Cheque', 'Bank Transfer', 'UPI Manual Entry', 'Card Swipe Offline'].map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label>
            <span className="block text-xs font-semibold text-slate-500 mb-1.5">Payment Date</span>
            <input type="date" value={form.paymentDate} onChange={(event) => setForm((prev) => ({ ...prev, paymentDate: event.target.value }))} className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm" />
          </label>
          <label>
            <span className="block text-xs font-semibold text-slate-500 mb-1.5">Reference No.</span>
            <input value={form.referenceNo} onChange={(event) => setForm((prev) => ({ ...prev, referenceNo: event.target.value }))} className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm" />
          </label>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="h-10 px-5 rounded-lg bg-slate-100 text-slate-700 font-semibold text-sm">Cancel</button>
          <button type="submit" className="h-10 px-5 rounded-lg bg-[#33373e] text-white font-semibold text-sm">Post Collection</button>
        </div>
      </form>
    </div>
  );
}
