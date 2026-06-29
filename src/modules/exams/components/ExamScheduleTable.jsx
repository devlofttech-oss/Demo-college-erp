import { Edit3 } from 'lucide-react';
import StatusBadge from '../../students/components/StatusBadge';

export default function ExamScheduleTable({ schedules, canEdit, onEdit, onSelect, selectedId, showActions = true }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-separate border-spacing-y-2">
        <thead>
          <tr className="bg-[#e7e7e9] text-left text-slate-900">
            <th className="px-5 py-3 rounded-l-lg">Exam</th>
            <th className="px-5 py-3">Class / Subject</th>
            <th className="px-5 py-3">Date / Marks</th>
            <th className="px-5 py-3">Status</th>
            {showActions && <th className="px-5 py-3 rounded-r-lg text-right">Action</th>}
          </tr>
        </thead>
        <tbody>
          {schedules.map((schedule) => (
            <tr
              key={schedule.id}
              onClick={() => onSelect?.(schedule.id)}
              className={`bg-white shadow-[0_0_0_1px_rgba(226,232,240,0.9)] rounded-lg cursor-pointer ${selectedId === schedule.id ? 'erp-row-selected' : ''}`}
            >
              <td className="px-5 py-4 rounded-l-lg">
                <div className="font-bold text-slate-900">{schedule.examName}</div>
                <div className="text-xs text-slate-500">{schedule.examType || 'Written'} | {schedule.facultyName}</div>
              </td>
              <td className="px-5 py-4">
                <div>{schedule.classKey}</div>
                <div className="text-xs text-slate-500">{schedule.subject}</div>
              </td>
              <td className="px-5 py-4">
                <div>{schedule.examDate}{schedule.startTime ? ` | ${schedule.startTime}` : ''}</div>
                <div className="text-xs text-slate-500">Max: {schedule.maxMarks}{schedule.roomNo ? ` | Hall ${schedule.roomNo}` : ''}</div>
              </td>
              <td className={`px-5 py-4 ${showActions ? '' : 'rounded-r-lg'}`}><StatusBadge value={schedule.status} /></td>
              {showActions && (
              <td className="px-5 py-4 rounded-r-lg text-right">
                <button disabled={!canEdit} onClick={(event) => { event.stopPropagation(); onEdit(schedule); }} className="h-9 w-9 rounded-full border border-slate-200 inline-flex items-center justify-center disabled:opacity-40">
                  <Edit3 size={15} />
                </button>
              </td>
              )}
            </tr>
          ))}
          {!schedules.length && (
            <tr><td colSpan={showActions ? 5 : 4} className="bg-white text-center text-sm text-slate-500 px-5 py-10 shadow-[0_0_0_1px_rgba(226,232,240,0.9)] rounded-lg">No exam schedules found.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
