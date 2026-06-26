import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { documentCategories, documentOwnerTypes } from '../documentUtils';

export default function DocumentUploadModal({ students, staff, onClose, onSave }) {
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [form, setForm] = useState({
    ownerType: 'Student',
    ownerRecordId: students[0]?.id || '',
    archiveTitle: '',
    documentType: '',
    category: 'Identity',
    tags: '',
  });

  const ownerOptions = form.ownerType === 'Student' ? students : staff;
  const needsOwner = form.ownerType !== 'Academic Archive';
  const ownerUnavailable = needsOwner && !ownerOptions.length;

  const changeOwnerType = (ownerType) => {
    const nextOptions = ownerType === 'Student' ? students : staff;
    setForm((prev) => ({
      ...prev,
      ownerType,
      ownerRecordId: ownerType === 'Academic Archive' ? '' : nextOptions[0]?.id || '',
      archiveTitle: ownerType === 'Academic Archive' ? prev.archiveTitle : '',
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
              {documentOwnerTypes.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          {needsOwner ? (
            <label>
              <span className="block text-xs font-semibold text-slate-500 mb-1.5">Owner</span>
              <select value={form.ownerRecordId} disabled={ownerUnavailable} onChange={(event) => setForm((prev) => ({ ...prev, ownerRecordId: event.target.value }))} className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm disabled:opacity-60">
                {ownerUnavailable ? (
                  <option value="">No owners available</option>
                ) : ownerOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
          ) : (
            <label>
              <span className="block text-xs font-semibold text-slate-500 mb-1.5">Archive Title</span>
              <input value={form.archiveTitle} onChange={(event) => setForm((prev) => ({ ...prev, archiveTitle: event.target.value }))} className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm" />
            </label>
          )}
          <label>
            <span className="block text-xs font-semibold text-slate-500 mb-1.5">Document Type</span>
            <input value={form.documentType} onChange={(event) => setForm((prev) => ({ ...prev, documentType: event.target.value }))} className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm" />
          </label>
          <label>
            <span className="block text-xs font-semibold text-slate-500 mb-1.5">Category</span>
            <select value={form.category} onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))} className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm">
              {documentCategories.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="sm:col-span-2">
            <span className="block text-xs font-semibold text-slate-500 mb-1.5">Tags</span>
            <input value={form.tags} onChange={(event) => setForm((prev) => ({ ...prev, tags: event.target.value }))} className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm" />
          </label>
          <div className="sm:col-span-2 rounded-lg bg-[#f5f5f6] p-4">
            <input ref={fileInputRef} type="file" className="hidden" onChange={(event) => setFile(event.target.files?.[0] || null)} />
            <button type="button" onClick={() => fileInputRef.current?.click()} className="h-10 px-4 rounded-lg bg-white border border-slate-200 text-sm font-semibold inline-flex items-center gap-2">
              <Upload size={16} /> Choose File
            </button>
            <span className="ml-3 text-sm text-slate-600">{file?.name || 'No file selected. Metadata can still be saved.'}</span>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="h-10 px-5 rounded-lg bg-slate-100 text-slate-700 font-semibold text-sm">Cancel</button>
          <button type="submit" disabled={ownerUnavailable} className="h-10 px-5 rounded-lg bg-[#33373e] text-white font-semibold text-sm disabled:bg-slate-300">Save Document</button>
        </div>
      </form>
    </div>
  );
}
