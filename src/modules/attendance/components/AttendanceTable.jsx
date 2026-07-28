import { memo, useMemo } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';
import { formatAttendanceTimeRange, getAttendanceReportDateText } from '../attendanceUtils';

function AttendanceStatusControl({ canMark, record, entity, onMark, recordEditable = true }) {
  const currentStatus = record?.status || '';
  const statuses = [
    { label: 'Present', icon: <CheckCircle size={15} />, activeClass: 'is-present' },
    { label: 'Absent', icon: <XCircle size={15} />, activeClass: 'is-absent' },
  ];
  const canEditStatus = canMark && recordEditable;

  return (
    <div className="erp-attendance-status-wrap">
      <div className="erp-attendance-status-actions" aria-label="Attendance status">
        {statuses.map((status) => {
          const active = currentStatus === status.label;
          return (
            <button
              key={status.label}
              type="button"
              disabled={!canEditStatus}
              onClick={(event) => {
                event.stopPropagation();
                onMark(entity, status.label);
              }}
              className={`erp-attendance-status-button ${active ? status.activeClass : ''}`}
              aria-pressed={active}
              title={`Mark ${status.label}`}
            >
              {status.icon}
              <span>{status.label}</span>
            </button>
          );
        })}
      </div>
      {!currentStatus && <div className="erp-attendance-status-hint">Not marked</div>}
      {record?.isDraft && <div className="erp-attendance-status-hint">Draft</div>}
      {currentStatus && !recordEditable && <div className="erp-attendance-status-hint">Edit window closed</div>}
    </div>
  );
}

function AttendanceTable({
  canMark,
  draftStatuses = {},
  entities,
  mode,
  records,
  selectedDate,
  isRecordEditable,
  onMark,
  onSelect,
  selectedId,
  showActions = true,
}) {
  const recordsByEntityId = useMemo(() => records.reduce((map, record) => {
    const recordEntityId = record.entityId || record.studentId || record.employeeId;
    if (recordEntityId && getAttendanceReportDateText(record) === selectedDate) {
      map.set(recordEntityId, record);
    }
    return map;
  }, new Map()), [records, selectedDate]);

  return (
    <div className="attendance-table-wrap overflow-x-auto">
      <table className="attendance-table w-full text-sm border-separate border-spacing-y-2">
        <thead>
          <tr className="bg-[#e7e7e9] text-left text-slate-900">
            <th className="px-5 py-3 rounded-l-lg">{mode === 'students' ? 'Student' : 'Faculty / Staff'}</th>
            <th className={`px-5 py-3 ${showActions ? '' : 'rounded-r-lg'}`}>Status</th>
            {showActions && <th className="px-5 py-3 rounded-r-lg text-right">Action</th>}
          </tr>
        </thead>
        <tbody>
          {entities.map((entity) => {
            const entityId = entity.studentId || entity.employeeId;
            const record = recordsByEntityId.get(entityId);
            const draftStatus = draftStatuses[entityId];
            const effectiveRecord = draftStatus ? { ...(record || {}), status: draftStatus, isDraft: true } : record;
            const recordEditable = isRecordEditable ? isRecordEditable(record) : true;
            const timeRange = formatAttendanceTimeRange(effectiveRecord || {});
            return (
              <tr
                key={entity.id}
                onClick={() => onSelect?.(entity.id)}
                className={`bg-white shadow-[0_0_0_1px_rgba(226,232,240,0.9)] rounded-lg cursor-pointer ${selectedId === entity.id ? 'erp-row-selected' : ''}`}
              >
                <td className="px-5 py-4 rounded-l-lg">
                  <div className="font-bold text-slate-900">{entity.name}</div>
                  <div className="text-xs text-slate-500">{entityId}</div>
                  {timeRange && <div className="text-xs font-semibold text-slate-500">{timeRange}</div>}
                </td>
                <td className="px-5 py-4">
                  <AttendanceStatusControl
                    canMark={canMark}
                    entity={entity}
                    mode={mode}
                    record={effectiveRecord}
                    recordEditable={recordEditable}
                    onMark={onMark}
                  />
                </td>
                {showActions && (
                <td className="px-5 py-4 rounded-r-lg">
                  <div className="flex justify-end gap-2" />
                </td>
                )}
              </tr>
            );
          })}
          {!entities.length && (
            <tr>
              <td colSpan={showActions ? 3 : 2} className="bg-white text-center text-sm text-slate-500 px-5 py-10 shadow-[0_0_0_1px_rgba(226,232,240,0.9)] rounded-lg">
                No records found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default memo(AttendanceTable);
