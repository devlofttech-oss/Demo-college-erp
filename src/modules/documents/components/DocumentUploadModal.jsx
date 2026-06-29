import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import SearchSelect from '../../../components/SearchSelect';
import { documentCategories, documentOwnerTypes, documentTypes } from '../documentUtils';

export default function DocumentUploadModal({ students, staff, onClose, onSave }) {
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [form, setForm] = useState({
    ownerType: '',
    ownerRecordId: '',
    ownerName: '',
    archiveTitle: '',
    documentType: '',
    note: '',
    category: 'Identity',
    notes: '',
  });

  const ownerOptions = form.ownerType === 'Student' ? students : staff;
  const needsOwner = ['Student', 'Staff'].includes(form.ownerType);
  const ownerUnavailable = needsOwner && !ownerOptions.length;

  const changeOwnerType = (ownerType) => {
    setForm((prev) => ({
      ...prev,
      ownerType,
      ownerRecordId: '',
      ownerName: ownerType === 'Other' ? prev.ownerName : '',
      archiveTitle: '',
    }));
  };

  const submit = (event) => {
    event.preventDefault();
    onSave(form, file);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-3xl bg-white rounded-xl shadow-2xl border border-slate-200">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Upload Document</h2>
            <p className="text-sm text-slate-500">Store student, staff, and academic archive documents.</p>
          </div>
          <button type="button" onClick={onClose} className="h-9 w-9 rounded-full hover:bg-slate-100 text-slate-500">x</button>
        </div>
        <div className="p-6 grid sm:grid-cols-2 gap-4">
          <label>
            <span className="block text-xs font-semibold text-slate-500 mb-1.5">Owner Type</span>
            <select value={form.ownerType} onChange={(event) => changeOwnerType(event.target.value)} className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm">
              <option value="">Select owner type</option>
              {documentOwnerTypes.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          {needsOwner ? (
            <label>
              <span className="block text-xs font-semibold text-slate-500 mb-1.5">Name</span>
              <SearchSelect
                value={form.ownerRecordId}
                disabled={ownerUnavailable}
                onChange={(ownerRecordId) => setForm((prev) => ({ ...prev, ownerRecordId }))}
                options={ownerOptions.map((item) => ({
                  value: item.id,
                  label: [item.name, item.studentId || item.employeeId || item.admissionNo].filter(Boolean).join(' - '),
                }))}
                placeholder={ownerUnavailable ? 'No owners available' : 'Search owner...'}
              />
            </label>
          ) : (
            <label>
              <span className="block text-xs font-semibold text-slate-500 mb-1.5">Name</span>
              <input value={form.ownerName} disabled={!form.ownerType} onChange={(event) => setForm((prev) => ({ ...prev, ownerName: event.target.value }))} placeholder={form.ownerType ? 'Enter name' : 'Select owner type first'} className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm disabled:bg-slate-100" />
            </label>
          )}
          <label>
            <span className="block text-xs font-semibold text-slate-500 mb-1.5">Document Type</span>
            <select value={form.documentType} onChange={(event) => setForm((prev) => ({ ...prev, documentType: event.target.value, note: event.target.value === 'Other' ? prev.note : '' }))} className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm">
              <option value="">Select document type</option>
              {documentTypes.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label>
            <span className="block text-xs font-semibold text-slate-500 mb-1.5">Category</span>
            <select value={form.category} onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))} className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm">
              {documentCategories.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          {form.documentType === 'Other' && (
            <label className="sm:col-span-2">
              <span className="block text-xs font-semibold text-slate-500 mb-1.5">Note</span>
              <input value={form.note} onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))} placeholder="Note" className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm" />
            </label>
          )}
          <label className="sm:col-span-2">
            <span className="block text-xs font-semibold text-slate-500 mb-1.5">Notes</span>
            <input value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm" />
          </label>
          <div className="sm:col-span-2 rounded-lg bg-[#f5f5f6] p-4">
            <input ref={fileInputRef} type="file" className="hidden" onChange={(event) => setFile(event.target.files?.[0] || null)} />
            <button type="button" onClick={() => fileInputRef.current?.click()} className="h-10 px-4 rounded-lg bg-white border border-slate-200 text-sm font-semibold inline-flex items-center gap-2">
              <Upload size={16} /> Choose File
            </button>
            <span className="ml-3 text-sm text-slate-600">{file?.name || 'No file selected.'}</span>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="h-10 px-5 rounded-lg bg-slate-100 text-slate-700 font-semibold text-sm">Cancel</button>
          <button type="submit" disabled={!form.ownerType || ownerUnavailable} className="h-10 px-5 rounded-lg bg-[#33373e] text-white font-semibold text-sm disabled:bg-slate-300">Save Document</button>
        </div>
      </form>
    </div>
  );
}
