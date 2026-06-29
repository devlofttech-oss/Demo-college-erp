import { useState } from 'react';
import SearchSelect from '../../../components/SearchSelect';

export default function MarksEntryModal({ schedules, students, onClose, onSave }) {
  const [form, setForm] = useState({
    examScheduleId: schedules[0]?.id || '',
    studentRecordId: students[0]?.id || '',
    marksObtained: '',
  });

  const selectedSchedule = schedules.find((item) => item.id === form.examScheduleId);

  const submit = (event) => {
    event.preventDefault();
    onSave({
      ...form,
      maxMarks: selectedSchedule?.maxMarks || 0,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-xl bg-white rounded-xl shadow-2xl border border-slate-200">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Marks Entry</h2>
            <p className="text-sm text-slate-500">Enter student marks for scheduled exams.</p>
          </div>
          <button type="button" onClick={onClose} className="h-9 w-9 rounded-full hover:bg-slate-100 text-slate-500">x</button>
        </div>
        <div className="p-6 grid gap-4">
          <label>
            <span className="block text-xs font-semibold text-slate-500 mb-1.5">Exam</span>
            <select value={form.examScheduleId} onChange={(event) => setForm((prev) => ({ ...prev, examScheduleId: event.target.value }))} className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm">
              {schedules.map((item) => <option key={item.id} value={item.id}>{item.examName} / {item.classKey} / {item.subject}</option>)}
            </select>
          </label>
          <label>
            <span className="block text-xs font-semibold text-slate-500 mb-1.5">Student</span>
            <SearchSelect
              value={form.studentRecordId}
              onChange={(studentRecordId) => setForm((prev) => ({ ...prev, studentRecordId }))}
              options={students.map((item) => ({
                value: item.id,
                label: `${item.name} / ${item.studentId}`,
              }))}
              placeholder="Search student..."
            />
          </label>
          <label>
            <span className="block text-xs font-semibold text-slate-500 mb-1.5">Marks Obtained / {selectedSchedule?.maxMarks || 0}</span>
            <input type="number" value={form.marksObtained} onChange={(event) => setForm((prev) => ({ ...prev, marksObtained: event.target.value }))} className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm" />
          </label>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="h-10 px-5 rounded-lg bg-slate-100 text-slate-700 font-semibold text-sm">Cancel</button>
          <button type="submit" className="h-10 px-5 rounded-lg bg-[#33373e] text-white font-semibold text-sm">Save Marks</button>
        </div>
      </form>
    </div>
  );
}
