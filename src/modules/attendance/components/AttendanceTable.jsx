import { Bell, CheckCircle, XCircle } from 'lucide-react';
import StatusBadge from '../../students/components/StatusBadge';

export default function AttendanceTable({
  canMark,
  canNotify,
  entities,
  mode,
  records,
  selectedDate,
  onMark,
  onNotify,
  onSelect,
  selectedId,
  showActions = true,
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-separate border-spacing-y-2">
        <thead>
          <tr className="bg-[#e7e7e9] text-left text-slate-900">
            <th className="px-5 py-3 rounded-l-lg">{mode === 'students' ? 'Student' : 'Faculty / Staff'}</th>
            <th className="px-5 py-3">Details</th>
            <th className="px-5 py-3">Today Status</th>
            {showActions && <th className="px-5 py-3 rounded-r-lg text-right">Action</th>}
          </tr>
        </thead>
        <tbody>
          {entities.map((entity) => {
            const entityId = entity.studentId || entity.employeeId;
            const record = records.find((item) => item.entityId === entityId && item.dateText === selectedDate);
            return (
              <tr
                key={entity.id}
                onClick={() => onSelect?.(entity.id)}
                className={`bg-white shadow-[0_0_0_1px_rgba(226,232,240,0.9)] rounded-lg cursor-pointer ${selectedId === entity.id ? 'erp-row-selected' : ''}`}
              >
                <td className="px-5 py-4 rounded-l-lg">
                  <div className="font-bold text-slate-900">{entity.name}</div>
                  <div className="text-xs text-slate-500">{entityId}</div>
                </td>
                <td className="px-5 py-4">
                  {mode === 'students' ? (
                    <>
                      <div>{entity.className} - {entity.section}</div>
                      <div className="text-xs text-slate-500">{entity.program}</div>
                    </>
                  ) : (
                    <>
                      <div>{entity.department}</div>
                      <div className="text-xs text-slate-500">{entity.designation}</div>
                    </>
                  )}
                </td>
                <td className={`px-5 py-4 ${showActions ? '' : 'rounded-r-lg'}`}><StatusBadge value={record?.status || 'Not Marked'} /></td>
                {showActions && (
                <td className="px-5 py-4 rounded-r-lg">
                  <div className="flex justify-end gap-2">
                    {['Present', 'Absent'].map((status) => (
                      <button
                        key={status}
                        disabled={!canMark || Boolean(record)}
                        onClick={() => onMark(entity, status)}
                        className="h-9 w-9 rounded-full border border-slate-200 flex items-center justify-center disabled:opacity-40"
                        title={`Mark ${status}`}
                      >
                        {status === 'Present' ? <CheckCircle size={15} /> : <XCircle size={15} />}
                      </button>
                    ))}
                    {mode === 'students' && record?.status === 'Absent' && (
                      <button
                        disabled={!canNotify || record.parentNotified}
                        onClick={() => onNotify(entity, record)}
                        className="h-9 w-9 rounded-full border border-slate-200 flex items-center justify-center disabled:opacity-40"
                        title="Notify parent"
                      >
                        <Bell size={15} />
                      </button>
                    )}
                  </div>
                </td>
                )}
              </tr>
            );
          })}
          {!entities.length && (
            <tr>
              <td colSpan={showActions ? 4 : 3} className="bg-white text-center text-sm text-slate-500 px-5 py-10 shadow-[0_0_0_1px_rgba(226,232,240,0.9)] rounded-lg">
                No records found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
