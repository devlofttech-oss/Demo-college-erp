import StatusBadge from '../../students/components/StatusBadge';
import { buildReport, buildSemesterReport, buildSubjectReport, formatAttendanceTimeRange, summarizeAttendance } from '../attendanceUtils';

function getTimeRanges(records = []) {
  return [...new Set(records.map(formatAttendanceTimeRange).filter(Boolean))];
}

export default function AttendanceReports({ records, scope }) {
  const grouped = buildReport(records, scope);
  const rows = Object.entries(grouped).map(([label, items]) => ({ label, timeRanges: getTimeRanges(items), ...summarizeAttendance(items) }));
  const subjectRows = Object.entries(buildSubjectReport(records)).map(([label, items]) => ({ label, timeRanges: getTimeRanges(items), ...summarizeAttendance(items) }));
  const semesterRows = Object.entries(buildSemesterReport(records)).map(([label, items]) => ({ label, timeRanges: getTimeRanges(items), ...summarizeAttendance(items) }));

  return (
    <div className="grid xl:grid-cols-[1fr_1fr_.75fr] gap-5">
      <div className="bg-white border border-slate-100 rounded-lg p-5 shadow-sm">
        <h3 className="font-bold mb-4">Subject Wise</h3>
        <div className="space-y-3 mb-5">
          {subjectRows.map((row) => (
            <div key={row.label} className="rounded-lg bg-[#f5f5f6] p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-slate-900">{row.label}</span>
                <span className="text-sm font-bold text-[#33373e]">{row.percentage}%</span>
              </div>
              <div className="mt-3 h-3 rounded-full bg-white overflow-hidden">
                <div className="h-full bg-[#fb9a5b]" style={{ width: `${row.percentage}%` }} />
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs text-slate-500 mt-2">
                <span>Present: {row.present}</span>
                <span>Absent: {row.absent}</span>
                <span>Total: {row.total}</span>
              </div>
              {row.timeRanges.length > 0 && (
                <div className="mt-2 text-xs font-semibold text-slate-500">
                  {row.timeRanges.slice(0, 2).join(', ')}{row.timeRanges.length > 2 ? ` +${row.timeRanges.length - 2}` : ''}
                </div>
              )}
            </div>
          ))}
          {!subjectRows.length && <div className="rounded-lg bg-[#f5f5f6] p-3 text-sm text-slate-500">No subject attendance reports yet.</div>}
        </div>
      </div>

      <div className="bg-white border border-slate-100 rounded-lg p-5 shadow-sm">
        <h3 className="font-bold mb-4">Semester Wise</h3>
        <div className="space-y-3 mb-5">
          {semesterRows.map((row) => (
            <div key={row.label} className="rounded-lg bg-[#f5f5f6] p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-slate-900">{row.label}</span>
                <span className="text-sm font-bold text-[#33373e]">{row.percentage}%</span>
              </div>
              <div className="mt-3 h-3 rounded-full bg-white overflow-hidden">
                <div className="h-full bg-emerald-500" style={{ width: `${row.percentage}%` }} />
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs text-slate-500 mt-2">
                <span>Present: {row.present}</span>
                <span>Absent: {row.absent}</span>
                <span>Total: {row.total}</span>
              </div>
              {row.timeRanges.length > 0 && (
                <div className="mt-2 text-xs font-semibold text-slate-500">
                  {row.timeRanges.slice(0, 2).join(', ')}{row.timeRanges.length > 2 ? ` +${row.timeRanges.length - 2}` : ''}
                </div>
              )}
            </div>
          ))}
          {!semesterRows.length && <div className="rounded-lg bg-[#f5f5f6] p-3 text-sm text-slate-500">No semester attendance reports yet.</div>}
        </div>
      </div>

      <div className="bg-white border border-slate-100 rounded-lg p-5 shadow-sm">
        <h3 className="font-bold mb-4">{scope[0].toUpperCase() + scope.slice(1)} Summary</h3>
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.label} className="rounded-lg bg-[#f5f5f6] p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-semibold">{row.label}</span>
                <StatusBadge value={`${row.percentage}%`} />
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs text-slate-500 mt-2">
                <span>Present: {row.present}</span>
                <span>Absent: {row.absent}</span>
                <span>Total: {row.total}</span>
              </div>
              {row.timeRanges.length > 0 && (
                <div className="mt-2 text-xs font-semibold text-slate-500">
                  {row.timeRanges.slice(0, 2).join(', ')}{row.timeRanges.length > 2 ? ` +${row.timeRanges.length - 2}` : ''}
                </div>
              )}
            </div>
          ))}
          {!rows.length && <div className="rounded-lg bg-[#f5f5f6] p-3 text-sm text-slate-500">No attendance reports yet.</div>}
        </div>
      </div>
    </div>
  );
}
