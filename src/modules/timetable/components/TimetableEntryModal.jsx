import { useState } from 'react';
import { timeSlots, weekDays } from '../timetableUtils';

export default function TimetableEntryModal({ classOptions, classrooms, faculty, initialEntry = null, initialValues = {}, mode = 'create', onClose, onSave }) {
  const isEdit = mode === 'edit';
  const [form, setForm] = useState({
    classKey: initialEntry?.classKey || initialValues.classKey || classOptions[0] || '',
    subject: initialEntry?.subject || '',
    facultyId: initialEntry?.facultyId || faculty[0]?.id || '',
    classroomId: initialEntry?.classroomId || classrooms[0]?.id || '',
    day: initialEntry?.day || initialValues.day || weekDays[0],
    timeSlot: initialEntry?.timeSlot || initialValues.timeSlot || timeSlots[0],
  });

  const submit = (event) => {
    event.preventDefault();
    onSave(form);
  };

  return (
    <div className="erp-modal-overlay fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
      <form onSubmit={submit} className="erp-modal-form w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="erp-modal-header px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{isEdit ? 'Edit Timetable Entry' : 'Create Timetable Entry'}</h2>
            <p className="text-sm text-slate-500">Assign subject, faculty, classroom, day, and time slot.</p>
          </div>
          <button type="button" onClick={onClose} className="erp-modal-close h-9 w-9 rounded-full hover:bg-slate-100 text-slate-500">x</button>
        </div>
        <div className="p-6 grid sm:grid-cols-2 gap-4">
          <label>
            <span className="block text-xs font-semibold text-slate-500 mb-1.5">Class</span>
            <select value={form.classKey} onChange={(event) => setForm((prev) => ({ ...prev, classKey: event.target.value }))} className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm">
              {classOptions.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label>
            <span className="block text-xs font-semibold text-slate-500 mb-1.5">Subject</span>
            <input value={form.subject} onChange={(event) => setForm((prev) => ({ ...prev, subject: event.target.value }))} className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm" />
          </label>
          <label>
            <span className="block text-xs font-semibold text-slate-500 mb-1.5">Faculty</span>
            <select value={form.facultyId} onChange={(event) => setForm((prev) => ({ ...prev, facultyId: event.target.value }))} className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm">
              {faculty.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label>
            <span className="block text-xs font-semibold text-slate-500 mb-1.5">Classroom</span>
            <select value={form.classroomId} onChange={(event) => setForm((prev) => ({ ...prev, classroomId: event.target.value }))} className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm">
              {classrooms.map((item) => <option key={item.id} value={item.id}>{item.roomNo}</option>)}
            </select>
          </label>
          <label>
            <span className="block text-xs font-semibold text-slate-500 mb-1.5">Day</span>
            <select value={form.day} onChange={(event) => setForm((prev) => ({ ...prev, day: event.target.value }))} className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm">
              {weekDays.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label>
            <span className="block text-xs font-semibold text-slate-500 mb-1.5">Time Slot</span>
            <select value={form.timeSlot} onChange={(event) => setForm((prev) => ({ ...prev, timeSlot: event.target.value }))} className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm">
              {timeSlots.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
        </div>
        <div className="erp-modal-footer px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="h-10 px-5 rounded-lg bg-slate-100 text-slate-700 font-semibold text-sm">Cancel</button>
          <button type="submit" className="h-10 px-5 rounded-lg bg-[#33373e] text-white font-semibold text-sm">{isEdit ? 'Save Changes' : 'Save Entry'}</button>
        </div>
      </form>
    </div>
  );
}
