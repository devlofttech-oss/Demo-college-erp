import { useState } from 'react';
import { Upload, UserRound } from 'lucide-react';

const defaultForm = {
  name: '',
  employeeId: '',
  staffType: 'Faculty',
  department: 'Science',
  designation: '',
  phone: '',
  email: '',
  qualification: '',
  photoUrl: '',
  photoName: '',
  status: 'Active',
};

export default function StaffModal({ initialStaff = null, mode = 'create', departments, onClose, onSave }) {
  const isEdit = mode === 'edit';
  const [form, setForm] = useState({ ...defaultForm, department: departments[0]?.name || 'Science', ...initialStaff });

  const uploadPhoto = (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      setForm((prev) => ({
        ...prev,
        photoUrl: reader.result,
        photoName: file.name,
      }));
    };
    reader.readAsDataURL(file);
  };

  const submit = (event) => {
    event.preventDefault();
    onSave(form);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{isEdit ? 'Edit Staff Record' : 'New Faculty / Staff'}</h2>
            <p className="text-sm text-slate-500">{isEdit ? 'Update employment and department details.' : 'Create a faculty or staff master record.'}</p>
          </div>
          <button type="button" onClick={onClose} className="h-9 w-9 rounded-full hover:bg-slate-100 text-slate-500">x</button>
        </div>
        <div className="p-6 grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2 rounded-lg bg-[#f5f5f6] p-4 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="h-20 w-20 rounded-full bg-[#30343c] text-emerald-300 flex items-center justify-center overflow-hidden shrink-0">
              {form.photoUrl ? (
                <img src={form.photoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <UserRound size={34} />
              )}
            </div>
            <label className="inline-flex h-10 px-4 rounded-lg bg-white border border-slate-200 text-sm font-semibold items-center justify-center gap-2 cursor-pointer w-fit">
              <Upload size={16} /> Profile Photo
              <input type="file" accept="image/*" className="sr-only" onChange={(event) => uploadPhoto(event.target.files?.[0])} />
            </label>
            <span className="text-xs text-slate-500">{form.photoName || 'Optional faculty/staff profile picture'}</span>
          </div>
          {[
            ['name', 'Name'],
            ['employeeId', 'Employee ID'],
            ['designation', 'Designation'],
            ['phone', 'Phone'],
            ['email', 'Email'],
            ['qualification', 'Qualification'],
          ].map(([key, label]) => (
            <label key={key}>
              <span className="block text-xs font-semibold text-slate-500 mb-1.5">{label}</span>
              <input
                value={form[key]}
                disabled={isEdit && key === 'employeeId'}
                onChange={(event) => setForm((prev) => ({ ...prev, [key]: event.target.value }))}
                className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-[#fb9a5b] focus:ring-2 focus:ring-orange-100 disabled:bg-slate-100"
              />
            </label>
          ))}
          <label>
            <span className="block text-xs font-semibold text-slate-500 mb-1.5">Staff Type</span>
            <select
              value={form.staffType}
              onChange={(event) => setForm((prev) => ({ ...prev, staffType: event.target.value }))}
              className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-[#fb9a5b] focus:ring-2 focus:ring-orange-100"
            >
              <option>Faculty</option>
              <option>Staff</option>
            </select>
          </label>
          <label>
            <span className="block text-xs font-semibold text-slate-500 mb-1.5">Department</span>
            <select
              value={form.department}
              onChange={(event) => setForm((prev) => ({ ...prev, department: event.target.value }))}
              className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-[#fb9a5b] focus:ring-2 focus:ring-orange-100"
            >
              {departments.map((department) => (
                <option key={department.id} value={department.name}>{department.name}</option>
              ))}
            </select>
          </label>
          {isEdit && (
            <label>
              <span className="block text-xs font-semibold text-slate-500 mb-1.5">Status</span>
              <select
                value={form.status}
                onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}
                className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-[#fb9a5b] focus:ring-2 focus:ring-orange-100"
              >
                <option>Active</option>
                <option>On Leave</option>
                <option>Archived</option>
              </select>
            </label>
          )}
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="h-10 px-5 rounded-lg bg-slate-100 text-slate-700 font-semibold text-sm">Cancel</button>
          <button type="submit" className="h-10 px-5 rounded-lg bg-[#33373e] text-white font-semibold text-sm">{isEdit ? 'Save Changes' : 'Save Record'}</button>
        </div>
      </form>
    </div>
  );
}
