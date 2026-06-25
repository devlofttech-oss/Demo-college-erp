import StatusBadge from '../../students/components/StatusBadge';

export default function AttendanceCard({ attendance }) {
  return (
    <div className="bg-white border border-slate-100 rounded-lg p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-slate-900">Attendance Monitoring</h3>
        <div className="text-xl font-bold text-[#33373e]">{attendance.percentage}%</div>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-4 text-sm">
        <div className="border-l-2 border-emerald-400 pl-3"><span className="block text-xs text-slate-500">Present</span><b>{attendance.present}</b></div>
        <div className="border-l-2 border-rose-400 pl-3"><span className="block text-xs text-slate-500">Absent</span><b>{attendance.absent}</b></div>
        <div className="border-l-2 border-slate-300 pl-3"><span className="block text-xs text-slate-500">Leave</span><b>{attendance.leave}</b></div>
      </div>
      <div className="divide-y divide-slate-100 border-t border-slate-100">
        {attendance.recent.slice(0, 4).map((item) => (
          <div key={item.id} className="flex items-center justify-between py-3 text-sm">
            <span>{item.dateText}</span>
            <StatusBadge value={item.status} />
          </div>
        ))}
        {!attendance.recent.length && <div className="text-sm text-slate-500">No attendance records available.</div>}
      </div>
    </div>
  );
}
