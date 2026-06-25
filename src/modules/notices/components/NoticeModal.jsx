import { useState } from 'react';
import { noticeAudiences, noticePriorities, noticeTypes } from '../noticeUtils';

export default function NoticeModal({ initialNotice = null, mode = 'create', onClose, onSave }) {
  const isEdit = mode === 'edit';
  const [form, setForm] = useState({
    type: initialNotice?.type || 'Digital Notice',
    title: initialNotice?.title || '',
    referenceNo: initialNotice?.referenceNo || '',
    audience: initialNotice?.audience || 'All',
    priority: initialNotice?.priority || 'Normal',
    body: initialNotice?.body || '',
    publishDate: initialNotice?.publishDate || new Date().toISOString().slice(0, 10),
    expiryDate: initialNotice?.expiryDate || '',
    status: initialNotice?.status || 'Published',
  });

  const submit = (event) => {
    event.preventDefault();
    onSave(form);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-3xl bg-white rounded-xl shadow-2xl border border-slate-200">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{isEdit ? 'Edit Announcement' : 'Create Announcement'}</h2>
            <p className="text-sm text-slate-500">Publish digital notices, circulars, and event announcements.</p>
          </div>
          <button type="button" onClick={onClose} className="h-9 w-9 rounded-full hover:bg-slate-100 text-slate-500">x</button>
        </div>
        <div className="p-6 grid sm:grid-cols-2 gap-4">
          <label>
            <span className="block text-xs font-semibold text-slate-500 mb-1.5">Type</span>
            <select value={form.type} onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value }))} className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm">
              {noticeTypes.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label>
            <span className="block text-xs font-semibold text-slate-500 mb-1.5">Audience</span>
            <select value={form.audience} onChange={(event) => setForm((prev) => ({ ...prev, audience: event.target.value }))} className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm">
              {noticeAudiences.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label>
            <span className="block text-xs font-semibold text-slate-500 mb-1.5">Title</span>
            <input value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm" />
          </label>
          <label>
            <span className="block text-xs font-semibold text-slate-500 mb-1.5">Reference No.</span>
            <input value={form.referenceNo} onChange={(event) => setForm((prev) => ({ ...prev, referenceNo: event.target.value }))} className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm" />
          </label>
          <label>
            <span className="block text-xs font-semibold text-slate-500 mb-1.5">Priority</span>
            <select value={form.priority} onChange={(event) => setForm((prev) => ({ ...prev, priority: event.target.value }))} className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm">
              {noticePriorities.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label>
            <span className="block text-xs font-semibold text-slate-500 mb-1.5">Publication Status</span>
            <select value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))} className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm">
              {['Published', 'Draft'].map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label>
            <span className="block text-xs font-semibold text-slate-500 mb-1.5">Publish Date</span>
            <input type="date" value={form.publishDate} onChange={(event) => setForm((prev) => ({ ...prev, publishDate: event.target.value }))} className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm" />
          </label>
          <label>
            <span className="block text-xs font-semibold text-slate-500 mb-1.5">Expiry Date</span>
            <input type="date" value={form.expiryDate} onChange={(event) => setForm((prev) => ({ ...prev, expiryDate: event.target.value }))} className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm" />
          </label>
          <label className="sm:col-span-2">
            <span className="block text-xs font-semibold text-slate-500 mb-1.5">Content</span>
            <textarea value={form.body} onChange={(event) => setForm((prev) => ({ ...prev, body: event.target.value }))} className="w-full min-h-32 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </label>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="h-10 px-5 rounded-lg bg-slate-100 text-slate-700 font-semibold text-sm">Cancel</button>
          <button type="submit" className="h-10 px-5 rounded-lg bg-[#33373e] text-white font-semibold text-sm">{isEdit ? 'Save Changes' : 'Create'}</button>
        </div>
      </form>
    </div>
  );
}
