import { Archive, ArchiveRestore, Edit3 } from 'lucide-react';
import { getTimeSlotLabel, getTimeSlotOptions, weekDays } from '../timetableUtils';

export default function TimetableGrid({ canArchive, canCreate, canEdit, entries, onArchive, onCreate, onEdit, onRestore, statusView = 'active' }) {
  const isArchiveView = statusView === 'archived';
  const timeSlotOptions = getTimeSlotOptions(entries, { includeArchived: isArchiveView });

  return (
    <div className="overflow-x-auto xl:overflow-visible">
      <table className="w-full table-fixed text-xs border-separate border-spacing-1">
        <thead>
          <tr>
            <th className="bg-[#e7e7e9] text-left px-2 py-2 rounded-lg w-24">Days</th>
            {timeSlotOptions.map((slot) => (
              <th key={slot.label} className="bg-[#e7e7e9] text-left px-2 py-2 rounded-lg">{slot.label}</th>
            ))}
          </tr>
        </thead>
        {timeSlotOptions.length ? (
          <tbody>
          {weekDays.map((day) => (
            <tr key={day}>
              <td className="bg-white px-2 py-2 rounded-lg font-semibold text-slate-700 shadow-[0_0_0_1px_rgba(226,232,240,0.9)]">{day}</td>
              {timeSlotOptions.map((slot) => {
                const dayEntries = entries.filter((entry) => entry.day === day && getTimeSlotLabel(entry) === slot.label);
                return (
                  <td key={`${day}-${slot.label}`} className="bg-white align-top rounded-lg p-2 shadow-[0_0_0_1px_rgba(226,232,240,0.9)]">
                    <div className="space-y-2">
                      {dayEntries.map((entry) => (
                        <div key={entry.id} className="rounded-md bg-[#f5f5f6] p-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900">{entry.subject}</div>
                              <div className="text-xs text-slate-500 mt-1">{entry.classKey}</div>
                              <div className="text-xs text-slate-500">{entry.facultyName}</div>
                              <div className="text-xs text-slate-500">{entry.classroomName}</div>
                            </div>
                          </div>
                          {(canEdit || canArchive) && (
                            <div className="flex gap-2 mt-3">
                              {canEdit && !isArchiveView && (
                                <button onClick={() => onEdit(entry)} className="h-8 px-3 rounded-md bg-white border border-slate-200 text-xs font-semibold flex items-center gap-1">
                                  <Edit3 size={13} /> Edit
                                </button>
                              )}
                              {canArchive && !isArchiveView && (
                                <button onClick={() => onArchive(entry)} className="h-8 px-3 rounded-md bg-white border border-slate-200 text-xs font-semibold flex items-center gap-1">
                                  <Archive size={13} /> Archive
                                </button>
                              )}
                              {isArchiveView && canArchive && (
                                <button onClick={() => onRestore(entry)} className="h-8 px-3 rounded-md bg-white border border-slate-200 text-xs font-semibold flex items-center gap-1">
                                  <ArchiveRestore size={13} /> Restore
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                      {!dayEntries.length && canCreate && !isArchiveView && (
                        <button
                          type="button"
                          onClick={() => onCreate({ day, timeSlot: slot.label, startTime: slot.startTime, endTime: slot.endTime })}
                          className="w-full min-h-16 rounded-md border border-dashed border-slate-200 p-2 text-left text-xs text-slate-400 hover:border-emerald-300 hover:text-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                          title="Add timetable entry"
                        >
                          + Add class
                        </button>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
          </tbody>
        ) : (
          <tbody>
            <tr>
              <td className="bg-white text-center text-sm text-slate-500 px-5 py-10 shadow-[0_0_0_1px_rgba(226,232,240,0.9)] rounded-lg">
                No timetable entries found for the selected course.
              </td>
            </tr>
          </tbody>
        )}
      </table>
    </div>
  );
}
