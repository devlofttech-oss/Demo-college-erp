import { CalendarCheck, CheckCircle, Edit3, FileText, UserRound, XCircle } from 'lucide-react';
import StatusBadge from '../../students/components/StatusBadge';

function DetailItem({ label, value, full = false }) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="font-semibold break-words">{value || 'Not recorded'}</div>
    </div>
  );
}

export default function StaffProfilePanel({
  attendanceRecords,
  canEdit = false,
  canManageLeave,
  canMarkAttendance,
  className = 'xl:w-[32%]',
  leaveRecords,
  onAttendance,
  onEdit,
  onLeaveDecision,
  onOpenDocuments,
  showActions = true,
  showExtendedDetails = true,
  staffMember,
}) {
  const relatedLeaves = leaveRecords.slice(0, 4);
  const relatedAttendance = attendanceRecords.slice(0, 4);

  return (
    <aside className={className}>
      <div className="bg-[#f0f0f2] rounded-lg p-4 mb-5">
        <div className="bg-white rounded-lg p-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-bold text-slate-900">Staff Profile</h2>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {canEdit && (
                <button
                  onClick={() => onEdit?.(staffMember)}
                  className="h-9 px-4 rounded-full bg-[#33373e] text-white font-semibold text-xs flex items-center justify-center gap-2"
                >
                  <Edit3 size={14} /> Edit
                </button>
              )}
              <button
                onClick={() => onOpenDocuments?.(staffMember)}
                className="h-9 px-4 rounded-full bg-[#f5f5f6] text-slate-700 border border-slate-200 font-semibold text-xs flex items-center justify-center gap-2"
              >
                <FileText size={14} /> Documents
              </button>
              <StatusBadge value={staffMember.status} />
            </div>
          </div>
          <div className="flex items-center gap-4 mb-5">
            <div className="h-20 w-20 rounded-full bg-[#30343c] text-emerald-300 flex items-center justify-center overflow-hidden">
              {staffMember.photoUrl ? (
                <img src={staffMember.photoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <UserRound size={38} />
              )}
            </div>
            <div>
              <div className="text-lg font-bold">{staffMember.name}</div>
              <div className="text-sm text-slate-500">{staffMember.designation}</div>
              <div className="text-xs text-slate-500">{staffMember.department}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <DetailItem label="Employee ID" value={staffMember.employeeId} />
            <DetailItem label="Type" value={staffMember.staffType} />
            <DetailItem label="Qualification" value={staffMember.qualification} full />
          </div>
          {showActions && (
          <div className="grid grid-cols-2 gap-2 mt-5">
            {['Present', 'Absent'].map((status) => (
              <button
                key={status}
                onClick={() => onAttendance(status)}
                disabled={!canMarkAttendance}
                className={`h-10 rounded-full text-white font-semibold text-sm disabled:bg-slate-300 disabled:cursor-not-allowed ${status === 'Present' ? 'bg-emerald-600' : 'bg-rose-600'}`}
              >
                Mark {status}
              </button>
            ))}
          </div>
          )}
        </div>
      </div>

      {showExtendedDetails && (
      <div className="bg-white border border-slate-100 rounded-lg p-5 shadow-sm mb-5">
        <h3 className="font-bold mb-4">Extracted Information</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <DetailItem label="Institution" value={staffMember.institution} full />
          <DetailItem label="Specialization" value={staffMember.specialization} />
          <DetailItem label="City" value={staffMember.city} />
          <DetailItem label="Email" value={staffMember.email} full />
          <DetailItem label="Phone" value={staffMember.phone} />
          <DetailItem label="Date of Birth" value={staffMember.dateOfBirth} />
          <DetailItem label="Joining Date" value={staffMember.joiningDate} />
          <DetailItem label="Appointment" value={staffMember.appointmentType} />
          <DetailItem label="Address" value={staffMember.address} full />
          <DetailItem label="Previous Experience" value={staffMember.previousExperience} full />
          <DetailItem label="Publications" value={staffMember.publications} />
          <DetailItem label="Research Projects" value={staffMember.researchProjects} />
        </div>
      </div>
      )}

      {showExtendedDetails && (
      <div className="bg-white border border-slate-100 rounded-lg p-5 shadow-sm mb-5">
        <h3 className="font-bold mb-4">Qualifications</h3>
        {staffMember.qualificationDetails?.length ? (
          <ul className="space-y-2 text-sm text-slate-700">
            {staffMember.qualificationDetails.map((qualification) => (
              <li key={qualification} className="rounded-lg bg-[#f5f5f6] px-3 py-2">{qualification}</li>
            ))}
          </ul>
        ) : (
          <div className="rounded-lg bg-[#f5f5f6] p-3 text-sm text-slate-500">No qualification details recorded.</div>
        )}
      </div>
      )}

      <div className="bg-white border border-slate-100 rounded-lg p-5 shadow-sm mb-5">
        <h3 className="font-bold mb-4">Documents</h3>
        <button
          type="button"
          onClick={() => onOpenDocuments?.(staffMember)}
          className="w-full rounded-lg bg-[#f5f5f6] p-3 text-sm text-left hover:bg-slate-100 transition-colors"
        >
          <div className="font-semibold text-slate-900">{staffMember.documentFileName || 'No source document linked'}</div>
          <div className="text-xs text-slate-500 mt-1">{staffMember.documentStatus || 'Upload pending'}</div>
        </button>
      </div>

      <div className="bg-white border border-slate-100 rounded-lg p-5 shadow-sm mb-5">
        <h3 className="font-bold mb-4">Leave Management</h3>
        <div className="space-y-3">
          {relatedLeaves.map((leave) => (
            <div key={leave.id} className="rounded-lg bg-[#f5f5f6] p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{leave.leaveType}</span>
                <StatusBadge value={leave.status} />
              </div>
              <div className="text-xs text-slate-500 mt-1">{leave.fromDate} to {leave.toDate}</div>
              <div className="text-xs text-slate-600 mt-1">{leave.reason}</div>
              {showActions && leave.status === 'Pending Review' && canManageLeave && (
                <div className="flex gap-2 mt-3">
                  <button onClick={() => onLeaveDecision(leave, 'Approved')} className="h-8 px-3 rounded-md bg-white border border-emerald-200 text-emerald-700 text-xs font-semibold flex items-center gap-1">
                    <CheckCircle size={13} /> Approve
                  </button>
                  <button onClick={() => onLeaveDecision(leave, 'Rejected')} className="h-8 px-3 rounded-md bg-white border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-1">
                    <XCircle size={13} /> Reject
                  </button>
                </div>
              )}
            </div>
          ))}
          {!relatedLeaves.length && <div className="rounded-lg bg-[#f5f5f6] p-3 text-sm text-slate-500">No leave records.</div>}
        </div>
      </div>

      <div className="bg-white border border-slate-100 rounded-lg p-5 shadow-sm">
        <h3 className="font-bold mb-4">Attendance</h3>
        <div className="space-y-3">
          {relatedAttendance.map((attendance) => (
            <div key={attendance.id} className="h-11 rounded-lg bg-[#f5f5f6] px-3 flex items-center justify-between text-sm">
              <span className="flex items-center gap-2"><CalendarCheck size={16} /> {attendance.dateText}</span>
              <StatusBadge value={attendance.status} />
            </div>
          ))}
          {!relatedAttendance.length && <div className="rounded-lg bg-[#f5f5f6] p-3 text-sm text-slate-500">No attendance marked.</div>}
        </div>
      </div>
    </aside>
  );
}
