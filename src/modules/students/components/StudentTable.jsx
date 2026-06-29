import { Archive, ArchiveRestore, Download, Edit3, Eye, UserRound } from 'lucide-react';
import StatusBadge from './StatusBadge';

export default function StudentTable({
  canArchive = true,
  canEdit = true,
  showActions = true,
  students,
  statusFilter,
  onArchive,
  onDownload,
  onEdit,
  onRestore,
  onSelect,
  selectedId,
}) {
  const handleRowKeyDown = (event, studentId) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(studentId);
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-separate border-spacing-y-2">
        <thead>
          <tr className="bg-[#e7e7e9] text-left text-slate-900">
            <th className="px-5 py-3 rounded-l-lg">Student</th>
            <th className="px-5 py-3">Admission / ID</th>
            <th className="px-5 py-3">Class</th>
            <th className="px-5 py-3">Status</th>
            {showActions && <th className="px-5 py-3 rounded-r-lg text-right">Action</th>}
          </tr>
        </thead>
        <tbody>
          {students.map((student) => (
            <tr
              key={student.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(student.id)}
              onKeyDown={(event) => handleRowKeyDown(event, student.id)}
              className={`bg-white shadow-[0_0_0_1px_rgba(226,232,240,0.9)] rounded-lg cursor-pointer transition-colors ${selectedId === student.id ? 'erp-row-selected' : ''}`}
            >
              <td className="px-5 py-4 rounded-l-lg">
                <div className="flex items-center gap-3 text-left">
                  <span className="h-10 w-10 rounded-full bg-[#30343c] text-emerald-300 flex items-center justify-center overflow-hidden">
                    {student.profilePhotoUrl ? (
                      <img src={student.profilePhotoUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <UserRound size={20} />
                    )}
                  </span>
                  <span>
                    <span className="block font-bold text-slate-900">{student.name}</span>
                    <span className="block text-xs text-slate-500">{student.guardianName}</span>
                  </span>
                </div>
              </td>
              <td className="px-5 py-4">
                <div className="font-semibold">{student.admissionNo}</div>
                <div className="text-xs text-slate-500">{student.studentId}</div>
              </td>
              <td className="px-5 py-4">
                <div>{student.className} - {student.section}</div>
                <div className="text-xs text-slate-500">{student.program}</div>
              </td>
              <td className={`px-5 py-4 ${showActions ? '' : 'rounded-r-lg'}`}><StatusBadge value={student.status} /></td>
              {showActions && (
              <td className="px-5 py-4 rounded-r-lg">
                <div className="flex justify-end gap-2">
                  <button onClick={(event) => { event.stopPropagation(); onSelect(student.id); }} className="h-9 w-9 rounded-full border border-slate-200 flex items-center justify-center">
                    <Eye size={15} />
                  </button>
                  {canEdit && (
                    <button
                      onClick={(event) => { event.stopPropagation(); onEdit(student); }}
                      className="h-9 w-9 rounded-full border border-slate-200 flex items-center justify-center"
                      title="Edit profile"
                    >
                      <Edit3 size={15} />
                    </button>
                  )}
                  <button
                    onClick={(event) => { event.stopPropagation(); onDownload(student); }}
                    className="h-9 w-9 rounded-full border border-slate-200 flex items-center justify-center"
                    title="Download record"
                  >
                    <Download size={15} />
                  </button>
                  {canArchive && student.status !== 'Archived' && (
                    <button
                      onClick={(event) => { event.stopPropagation(); onArchive(student); }}
                      className="h-9 w-9 rounded-full border border-slate-200 flex items-center justify-center"
                      title="Archive student"
                    >
                      <Archive size={15} />
                    </button>
                  )}
                  {canArchive && student.status === 'Archived' && (
                    <button
                      onClick={(event) => { event.stopPropagation(); onRestore(student); }}
                      className="h-9 w-9 rounded-full border border-slate-200 flex items-center justify-center"
                      title="Restore student"
                    >
                      <ArchiveRestore size={15} />
                    </button>
                  )}
                </div>
              </td>
              )}
            </tr>
          ))}
          {!students.length && (
            <tr>
              <td colSpan={showActions ? 5 : 4} className="bg-white text-center text-sm text-slate-500 px-5 py-10 shadow-[0_0_0_1px_rgba(226,232,240,0.9)] rounded-lg">
                No {statusFilter === 'archived' ? 'archived' : 'active'} student records found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
