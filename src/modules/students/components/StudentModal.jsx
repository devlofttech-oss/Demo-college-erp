import { useState } from 'react';

const defaultForm = {
  name: '',
  className: 'Class XI',
  section: 'A',
  program: 'PU Science',
  academicYear: '2026-2027',
  guardianName: '',
  idHolder: '',
  phone: '',
  email: '',
  status: 'Admission Review',
};

export default function StudentModal({ academicYearOptions = ['2026-2027'], initialAcademicYear = '2026-2027', initialStudent = null, mode = 'create', onClose, onSave }) {
  const [form, setForm] = useState({
    ...defaultForm,
    academicYear: initialStudent?.academicYear || initialAcademicYear,
    ...initialStudent,
  });
  const isEdit = mode === 'edit';

  const handleSubmit = (event) => {
    event.preventDefault();
    onSave({
      name: form.name.trim(),
      className: form.className.trim(),
      section: form.section.trim(),
      program: form.program.trim(),
      academicYear: form.academicYear,
      guardianName: form.guardianName.trim(),
      idHolder: form.idHolder.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      status: form.status,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{isEdit ? 'Edit Student Profile' : 'New Student Admission'}</h2>
            <p className="text-sm text-slate-500">
              {isEdit ? 'Updates student profile and academic details.' : 'Creates profile, admission number, and student ID.'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="h-9 w-9 rounded-full hover:bg-slate-100 text-slate-500">x</button>
        </div>
        <div className="p-6 grid sm:grid-cols-2 gap-4">
          <label>
            <span className="block text-xs font-semibold text-slate-500 mb-1.5">Academic Year</span>
            <select
              required
              value={form.academicYear}
              onChange={(event) => setForm((prev) => ({ ...prev, academicYear: event.target.value }))}
              className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-[#fb9a5b] focus:ring-2 focus:ring-orange-100"
            >
              {academicYearOptions.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </label>
          {[
            ['name', 'Student Name'],
            ['guardianName', 'Guardian Name'],
            ['idHolder', 'ID Holder'],
            ['phone', 'Phone'],
            ['email', 'Email'],
            ['className', 'Class'],
            ['section', 'Section'],
            ['program', 'Program'],
          ].map(([key, label]) => (
            <label key={key} className={key === 'program' ? 'sm:col-span-2' : ''}>
              <span className="block text-xs font-semibold text-slate-500 mb-1.5">{label}</span>
              <input
                required={['name', 'guardianName', 'phone'].includes(key)}
                value={form[key]}
                onChange={(event) => setForm((prev) => ({ ...prev, [key]: event.target.value }))}
                className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-[#fb9a5b] focus:ring-2 focus:ring-orange-100"
              />
            </label>
          ))}
          {isEdit && (
            <label>
              <span className="block text-xs font-semibold text-slate-500 mb-1.5">Status</span>
              <select
                value={form.status}
                onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}
                className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-[#fb9a5b] focus:ring-2 focus:ring-orange-100"
              >
                <option>Active</option>
                <option>Admission Review</option>
                <option>Archived</option>
              </select>
            </label>
          )}
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="h-10 px-5 rounded-lg bg-slate-100 text-slate-700 font-semibold text-sm">
            Cancel
          </button>
          <button type="submit" className="h-10 px-5 rounded-lg bg-[#33373e] text-white font-semibold text-sm">
            {isEdit ? 'Save Changes' : 'Save Admission'}
          </button>
        </div>
      </form>
    </div>
  );
}
