import { useState } from 'react';

export default function ExamScheduleModal({ classOptions, faculty, initialSchedule = null, mode = 'create', onClose, onSave }) {
  const isEdit = mode === 'edit';
  const [form, setForm] = useState({
    examName: initialSchedule?.examName || 'Mid Term Examination',
    classKey: initialSchedule?.classKey || classOptions[0] || '',
    subject: initialSchedule?.subject || '',
    examType: initialSchedule?.examType || 'Written',
    examDate: initialSchedule?.examDate || '',
    startTime: initialSchedule?.startTime || '',
    durationMinutes: initialSchedule?.durationMinutes || 180,
    roomNo: initialSchedule?.roomNo || '',
    maxMarks: initialSchedule?.maxMarks || 100,
    facultyId: initialSchedule?.facultyId || faculty[0]?.id || '',
    status: initialSchedule?.status || 'Scheduled',
  });

  const submit = (event) => {
    event.preventDefault();
    onSave(form);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{isEdit ? 'Edit Exam Schedule' : 'Schedule Exam'}</h2>
            <p className="text-sm text-slate-500">Create subject-wise exam schedules for a class.</p>
          </div>
          <button type="button" onClick={onClose} className="h-9 w-9 rounded-full hover:bg-slate-100 text-slate-500">x</button>
        </div>
        <div className="p-6 grid sm:grid-cols-2 gap-4">
          <label>
            <span className="block text-xs font-semibold text-slate-500 mb-1.5">Exam Name</span>
            <input value={form.examName} onChange={(event) => setForm((prev) => ({ ...prev, examName: event.target.value }))} className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm" />
          </label>
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
            <span className="block text-xs font-semibold text-slate-500 mb-1.5">Exam Type</span>
            <select value={form.examType} onChange={(event) => setForm((prev) => ({ ...prev, examType: event.target.value }))} className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm">
              {['Written', 'Practical', 'Internal', 'Viva'].map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label>
            <span className="block text-xs font-semibold text-slate-500 mb-1.5">Exam Date</span>
            <input type="date" value={form.examDate} onChange={(event) => setForm((prev) => ({ ...prev, examDate: event.target.value }))} className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm" />
          </label>
          <label>
            <span className="block text-xs font-semibold text-slate-500 mb-1.5">Start Time</span>
            <input type="time" value={form.startTime} onChange={(event) => setForm((prev) => ({ ...prev, startTime: event.target.value }))} className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm" />
          </label>
          <label>
            <span className="block text-xs font-semibold text-slate-500 mb-1.5">Duration Minutes</span>
            <input type="number" value={form.durationMinutes} onChange={(event) => setForm((prev) => ({ ...prev, durationMinutes: event.target.value }))} className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm" />
          </label>
          <label>
            <span className="block text-xs font-semibold text-slate-500 mb-1.5">Room / Hall</span>
            <input value={form.roomNo} onChange={(event) => setForm((prev) => ({ ...prev, roomNo: event.target.value }))} className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm" />
          </label>
          <label>
            <span className="block text-xs font-semibold text-slate-500 mb-1.5">Max Marks</span>
            <input type="number" value={form.maxMarks} onChange={(event) => setForm((prev) => ({ ...prev, maxMarks: event.target.value }))} className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm" />
          </label>
          <label>
            <span className="block text-xs font-semibold text-slate-500 mb-1.5">Faculty</span>
            <select value={form.facultyId} onChange={(event) => setForm((prev) => ({ ...prev, facultyId: event.target.value }))} className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm">
              {faculty.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="h-10 px-5 rounded-lg bg-slate-100 text-slate-700 font-semibold text-sm">Cancel</button>
          <button type="submit" className="h-10 px-5 rounded-lg bg-[#33373e] text-white font-semibold text-sm">{isEdit ? 'Save Changes' : 'Schedule Exam'}</button>
        </div>
      </form>
    </div>
  );
}
