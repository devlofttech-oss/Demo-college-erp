import { useState } from 'react';

export default function UserModal({ initialUser = null, mode = 'create', roles, students = [], onClose, onSave }) {
  const isEdit = mode === 'edit';
  const initialLinkedRecordIds = new Set(initialUser?.linkedStudentRecordIds || []);
  const initialLinkedStudentIds = new Set(initialUser?.linkedStudentIds || []);
  students.forEach((student) => {
    if (initialLinkedStudentIds.has(student.studentId)) {
      initialLinkedRecordIds.add(student.id);
    }
  });
  const [form, setForm] = useState({
    name: initialUser?.name || '',
    email: initialUser?.email || '',
    password: '',
    roleId: initialUser?.roleId || roles[0]?.id || '',
    status: initialUser?.status || 'Active',
    linkedStudentRecordIds: [...initialLinkedRecordIds],
  });
  const isParentRole = form.roleId === 'parent';

  const toggleLinkedStudent = (studentId) => {
    setForm((prev) => {
      const selected = new Set(prev.linkedStudentRecordIds || []);
      if (selected.has(studentId)) {
        selected.delete(studentId);
      } else {
        selected.add(studentId);
      }
      return { ...prev, linkedStudentRecordIds: [...selected] };
    });
  };

  const submit = (event) => {
    event.preventDefault();
    onSave(form);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-xl bg-white rounded-xl shadow-2xl border border-slate-200">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{isEdit ? 'Edit User' : 'Create User'}</h2>
            <p className="text-sm text-slate-500">
              {isEdit ? 'Update role and access status.' : 'Creates Firebase Auth login and ERP profile.'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="h-9 w-9 rounded-full hover:bg-slate-100 text-slate-500">x</button>
        </div>

        <div className="p-6 grid sm:grid-cols-2 gap-4">
          <label>
            <span className="block text-xs font-semibold text-slate-500 mb-1.5">Name</span>
            <input
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-[#fb9a5b] focus:ring-2 focus:ring-orange-100"
            />
          </label>
          <label>
            <span className="block text-xs font-semibold text-slate-500 mb-1.5">Email</span>
            <input
              type="email"
              disabled={isEdit}
              value={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-[#fb9a5b] focus:ring-2 focus:ring-orange-100 disabled:bg-slate-100"
            />
          </label>
          {!isEdit && (
            <label>
              <span className="block text-xs font-semibold text-slate-500 mb-1.5">Password</span>
              <input
                type="password"
                minLength={12}
                value={form.password}
                onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-[#fb9a5b] focus:ring-2 focus:ring-orange-100"
              />
            </label>
          )}
          <label>
            <span className="block text-xs font-semibold text-slate-500 mb-1.5">Role</span>
            <select
              value={form.roleId}
              onChange={(event) => setForm((prev) => ({ ...prev, roleId: event.target.value }))}
              className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-[#fb9a5b] focus:ring-2 focus:ring-orange-100"
            >
              {roles.map((role) => (
                <option key={role.id} value={role.id}>{role.name}</option>
              ))}
            </select>
          </label>
          {isParentRole && (
            <fieldset className="sm:col-span-2 rounded-lg border border-slate-200 p-4">
              <legend className="px-1 text-xs font-semibold text-slate-500">Linked students</legend>
              {students.length ? (
                <div className="max-h-40 overflow-y-auto divide-y divide-slate-100">
                  {students.map((student) => (
                    <label key={student.id} className="flex items-center gap-3 py-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={form.linkedStudentRecordIds.includes(student.id)}
                        onChange={() => toggleLinkedStudent(student.id)}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      <span>
                        <span className="font-semibold">{student.name}</span>
                        <span className="text-slate-500"> / {student.studentId || student.id}</span>
                      </span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No active students are available to link.</p>
              )}
            </fieldset>
          )}
          {isEdit && (
            <label>
              <span className="block text-xs font-semibold text-slate-500 mb-1.5">Status</span>
              <select
                value={form.status}
                onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}
                className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-[#fb9a5b] focus:ring-2 focus:ring-orange-100"
              >
                <option>Active</option>
                <option>Suspended</option>
              </select>
            </label>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="h-10 px-5 rounded-lg bg-slate-100 text-slate-700 font-semibold text-sm">
            Cancel
          </button>
          <button type="submit" className="h-10 px-5 rounded-lg bg-[#33373e] text-white font-semibold text-sm">
            {isEdit ? 'Save Changes' : 'Create User'}
          </button>
        </div>
      </form>
    </div>
  );
}
