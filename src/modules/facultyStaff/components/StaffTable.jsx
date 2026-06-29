import { Archive, ArchiveRestore, CalendarCheck, Edit3, UserRound } from 'lucide-react';
import StatusBadge from '../../students/components/StatusBadge';

export default function StaffTable({ staff, canArchive, canEdit, canManageLeave, onArchive, onEdit, onLeave, onRestore, onSelect, selectedId, showActions = true }) {
  const handleRowKeyDown = (event, memberId) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(memberId);
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-separate border-spacing-y-2">
        <thead>
          <tr className="bg-[#e7e7e9] text-left text-slate-900">
            <th className="px-5 py-3 rounded-l-lg">Faculty / Staff</th>
            <th className="px-5 py-3">Department</th>
            <th className="px-5 py-3">Contact</th>
            <th className="px-5 py-3">Status</th>
            {showActions && <th className="px-5 py-3 rounded-r-lg text-right">Action</th>}
          </tr>
        </thead>
        <tbody>
          {staff.map((member) => (
            <tr
              key={member.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(member.id)}
              onKeyDown={(event) => handleRowKeyDown(event, member.id)}
              className={`bg-white shadow-[0_0_0_1px_rgba(226,232,240,0.9)] rounded-lg cursor-pointer transition-colors ${selectedId === member.id ? 'erp-row-selected' : ''}`}
            >
              <td className="px-5 py-4 rounded-l-lg">
                <div className="flex items-center gap-3 text-left">
                  <span className="h-10 w-10 rounded-full bg-[#30343c] text-emerald-300 flex items-center justify-center overflow-hidden">
                    {member.photoUrl ? (
                      <img src={member.photoUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <UserRound size={20} />
                    )}
                  </span>
                  <span>
                    <span className="block font-bold text-slate-900">{member.name}</span>
                    <span className="block text-xs text-slate-500">{member.employeeId} / {member.staffType}</span>
                  </span>
                </div>
              </td>
              <td className="px-5 py-4">
                <div>{member.department}</div>
                <div className="text-xs text-slate-500">{member.designation}</div>
              </td>
              <td className="px-5 py-4">
                <div>{member.phone}</div>
                <div className="text-xs text-slate-500">{member.email}</div>
              </td>
              <td className={`px-5 py-4 ${showActions ? '' : 'rounded-r-lg'}`}><StatusBadge value={member.status} /></td>
              {showActions && (
              <td className="px-5 py-4 rounded-r-lg">
                <div className="flex justify-end gap-2">
                  <button disabled={!canEdit} onClick={(event) => { event.stopPropagation(); onEdit(member); }} className="h-9 w-9 rounded-full border border-slate-200 flex items-center justify-center disabled:opacity-40" title="Edit record">
                    <Edit3 size={15} />
                  </button>
                  <button disabled={!canManageLeave} onClick={(event) => { event.stopPropagation(); onLeave(member); }} className="h-9 w-9 rounded-full border border-slate-200 flex items-center justify-center disabled:opacity-40" title="Leave request">
                    <CalendarCheck size={15} />
                  </button>
                  {member.status !== 'Archived' && (
                    <button disabled={!canArchive} onClick={(event) => { event.stopPropagation(); onArchive(member); }} className="h-9 w-9 rounded-full border border-slate-200 flex items-center justify-center disabled:opacity-40" title="Archive record">
                      <Archive size={15} />
                    </button>
                  )}
                  {member.status === 'Archived' && (
                    <button disabled={!canArchive} onClick={(event) => { event.stopPropagation(); onRestore(member); }} className="h-9 w-9 rounded-full border border-slate-200 flex items-center justify-center disabled:opacity-40" title="Restore record">
                      <ArchiveRestore size={15} />
                    </button>
                  )}
                </div>
              </td>
              )}
            </tr>
          ))}
          {!staff.length && (
            <tr>
              <td colSpan={showActions ? 5 : 4} className="bg-white text-center text-sm text-slate-500 px-5 py-10 shadow-[0_0_0_1px_rgba(226,232,240,0.9)] rounded-lg">
                No faculty or staff records found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
