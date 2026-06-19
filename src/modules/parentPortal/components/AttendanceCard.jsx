import StatusBadge from '../../students/components/StatusBadge';

export default function AttendanceCard({ attendance }) {
  return (
    <div className="bg-white border border-slate-100 rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-slate-900">Attendance Monitoring</h3>
        <div className="text-2xl font-bold text-[#33373e]">{attendance.percentage}%</div>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-4 text-xs">
        <div className="rounded-lg bg-[#f5f5f6] p-3">Present<br /><b>{attendance.present}</b></div>
        <div className="rounded-lg bg-[#f5f5f6] p-3">Absent<br /><b>{attendance.absent}</b></div>
        <div className="rounded-lg bg-[#f5f5f6] p-3">Leave<br /><b>{attendance.leave}</b></div>
      </div>
      <div className="space-y-2">
        {attendance.recent.map((item) => (
          <div key={item.id} className="flex items-center justify-between rounded-lg bg-[#f5f5f6] p-3 text-sm">
            <span>{item.dateText}</span>
            <StatusBadge value={item.status} />
          </div>
        ))}
        {!attendance.recent.length && <div className="text-sm text-slate-500">No attendance records available.</div>}
      </div>
    </div>
  );
}
