import { useState } from 'react';

export default function FeeStructureModal({ classOptions, initialStructure = null, mode = 'create', onClose, onSave }) {
  const isEdit = mode === 'edit';
  const [form, setForm] = useState({
    name: initialStructure?.name || 'Annual Fee Structure',
    classKey: initialStructure?.classKey || classOptions[0] || '',
    academicYear: initialStructure?.academicYear || '2026-2027',
    tuitionFee: initialStructure?.tuitionFee || 0,
    libraryFee: initialStructure?.libraryFee || 0,
    labFee: initialStructure?.labFee || 0,
    transportFee: initialStructure?.transportFee || 0,
    dueDate: initialStructure?.dueDate || '',
    status: initialStructure?.status || 'Active',
  });

  const totalAmount = ['tuitionFee', 'libraryFee', 'labFee', 'transportFee']
    .reduce((sum, key) => sum + Number(form[key] || 0), 0);

  const submit = (event) => {
    event.preventDefault();
    onSave({ ...form, totalAmount });
  };

  const setNumber = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{isEdit ? 'Edit Fee Structure' : 'Create Fee Structure'}</h2>
            <p className="text-sm text-slate-500">Define class-wise fee components and due date.</p>
          </div>
          <button type="button" onClick={onClose} className="h-9 w-9 rounded-full hover:bg-slate-100 text-slate-500">x</button>
        </div>
        <div className="p-6 grid sm:grid-cols-2 gap-4">
          <label>
            <span className="block text-xs font-semibold text-slate-500 mb-1.5">Structure Name</span>
            <input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm" />
          </label>
          <label>
            <span className="block text-xs font-semibold text-slate-500 mb-1.5">Class</span>
            <select value={form.classKey} onChange={(event) => setForm((prev) => ({ ...prev, classKey: event.target.value }))} className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm">
              {classOptions.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label>
            <span className="block text-xs font-semibold text-slate-500 mb-1.5">Academic Year</span>
            <input value={form.academicYear} onChange={(event) => setForm((prev) => ({ ...prev, academicYear: event.target.value }))} className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm" />
          </label>
          <label>
            <span className="block text-xs font-semibold text-slate-500 mb-1.5">Due Date</span>
            <input type="date" value={form.dueDate} onChange={(event) => setForm((prev) => ({ ...prev, dueDate: event.target.value }))} className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm" />
          </label>
          <label>
            <span className="block text-xs font-semibold text-slate-500 mb-1.5">Tuition Fee</span>
            <input type="number" value={form.tuitionFee} onChange={(event) => setNumber('tuitionFee', event.target.value)} className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm" />
          </label>
          <label>
            <span className="block text-xs font-semibold text-slate-500 mb-1.5">Library Fee</span>
            <input type="number" value={form.libraryFee} onChange={(event) => setNumber('libraryFee', event.target.value)} className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm" />
          </label>
          <label>
            <span className="block text-xs font-semibold text-slate-500 mb-1.5">Lab Fee</span>
            <input type="number" value={form.labFee} onChange={(event) => setNumber('labFee', event.target.value)} className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm" />
          </label>
          <label>
            <span className="block text-xs font-semibold text-slate-500 mb-1.5">Transport Fee</span>
            <input type="number" value={form.transportFee} onChange={(event) => setNumber('transportFee', event.target.value)} className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm" />
          </label>
          <div className="sm:col-span-2 rounded-lg bg-[#f5f5f6] p-4">
            <div className="text-xs text-slate-500">Total Amount</div>
            <div className="text-2xl font-bold text-slate-900">Rs. {totalAmount.toLocaleString('en-IN')}</div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="h-10 px-5 rounded-lg bg-slate-100 text-slate-700 font-semibold text-sm">Cancel</button>
          <button type="submit" className="h-10 px-5 rounded-lg bg-[#33373e] text-white font-semibold text-sm">{isEdit ? 'Save Changes' : 'Create Structure'}</button>
        </div>
      </form>
    </div>
  );
}
