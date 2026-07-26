import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Search, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  archiveStaffMember,
  createStaffAttendanceRecord,
  createStaffLeaveRecord,
  createStaffMember,
  getFacultyStaffData,
  restoreStaffMember,
  updateStaffLeaveRecord,
  updateStaffMember,
} from '../../firebase/db';
import { isFirebaseConfigured } from '../../firebase/config';
import { buildAttendanceKey, formatDisplayDate, relationMatchesStaff, validateLeaveForm, validateStaffForm } from './facultyStaffUtils';
import { defaultRoles, canAccess } from '../userRoles/rolePermissions';
import LeaveModal from './components/LeaveModal';
import StaffModal from './components/StaffModal';
import StaffProfilePanel from './components/StaffProfilePanel';
import StaffTable from './components/StaffTable';
import { formatAttendanceTimeRange } from '../attendance/attendanceUtils';
import { filterByCourse } from '../shared/courseFilters';

function StaffDetailPage({
  attendanceRecords,
  canEdit,
  canManageLeave,
  canMarkAttendance,
  leaveRecords,
  onAttendance,
  onBack,
  onEdit,
  onLeaveDecision,
  onOpenDocuments,
  staffMember,
  teachingRecords = [],
  timetableEntries,
}) {
  const [showAllDetails, setShowAllDetails] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState('overview');
  const attendanceTotal = attendanceRecords.length;
  const presentCount = attendanceRecords.filter((item) => item.status === 'Present').length;
  const attendanceRate = attendanceTotal ? Math.round((presentCount / attendanceTotal) * 100) : 0;
  const topicRows = [...teachingRecords]
    .filter((record) => record.topic || record.subjectName)
    .sort((first, second) => Date.parse(second.markedAtIso || second.dateText || '') - Date.parse(first.markedAtIso || first.dateText || ''));

  return (
    <div>
      <div className="flex flex-col gap-4 pb-6 border-b border-slate-100 mb-5">
        <button
          type="button"
          onClick={onBack}
          className="erp-back-button h-12 px-5 rounded-lg bg-[#fb8d49] text-white font-extrabold text-base flex items-center gap-2 self-start shadow-lg shadow-orange-200 hover:bg-[#e97934] focus:outline-none focus:ring-4 focus:ring-orange-200"
        >
          <ArrowLeft size={20} /> Back
        </button>
        <div>
          <div className="text-sm font-bold text-slate-500 mb-2">Academics / <span className="text-[#f39a5f]">Staff Details</span></div>
          <h1 className="text-2xl font-bold text-slate-900">{staffMember.name}</h1>
          <p className="text-sm text-slate-500 mt-1">{staffMember.employeeId} / {staffMember.staffType}</p>
        </div>
      </div>

      <StaffProfilePanel
        attendanceRecords={attendanceRecords}
        canEdit={canEdit}
        canManageLeave={canManageLeave}
        canMarkAttendance={canMarkAttendance}
        className="w-full"
        leaveRecords={leaveRecords}
        onAttendance={onAttendance}
        onEdit={onEdit}
        onLeaveDecision={onLeaveDecision}
        onOpenDocuments={onOpenDocuments}
        showActions={false}
        showExtendedDetails={showAllDetails}
        staffMember={staffMember}
      />
      <div className="mb-5 flex flex-wrap gap-2">
        {[
          ['overview', 'Overview'],
          ['topics', 'Topics Taken'],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setActiveDetailTab(value)}
            className={`h-10 px-4 rounded-lg border text-sm font-bold ${activeDetailTab === value ? 'bg-[#33373e] text-white border-[#33373e]' : 'bg-white text-slate-600 border-slate-200'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeDetailTab === 'topics' ? (
        <section className="bg-white border border-slate-100 rounded-lg p-5 shadow-sm mb-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="font-bold text-slate-900">Topics Taken</h3>
            <span className="text-xs font-bold text-slate-500">{topicRows.length} class session{topicRows.length === 1 ? '' : 's'}</span>
          </div>
          {topicRows.length ? (
            <div className="overflow-x-auto rounded-lg border border-slate-100">
              <table className="w-full text-sm">
                <thead className="bg-[#f5f5f6] text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Date</th>
                    <th className="px-4 py-3 text-left font-semibold">Time</th>
                    <th className="px-4 py-3 text-left font-semibold">Semester / Class</th>
                    <th className="px-4 py-3 text-left font-semibold">Subject</th>
                    <th className="px-4 py-3 text-left font-semibold">Topic</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {topicRows.map((record) => (
                    <tr key={record.id}>
                      <td className="px-4 py-3 font-semibold text-slate-800">{record.dateText || '-'}</td>
                      <td className="px-4 py-3 text-slate-600">{formatAttendanceTimeRange(record) || '-'}</td>
                      <td className="px-4 py-3 text-slate-600">{record.semester || record.className || '-'}</td>
                      <td className="px-4 py-3 text-slate-600">{record.subjectName || '-'}</td>
                      <td className="px-4 py-3 text-slate-700">{record.topic || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-lg bg-[#f5f5f6] p-4 text-sm text-slate-500">No saved topic sessions for this faculty member yet.</div>
          )}
        </section>
      ) : (
      <>
      <div className="grid xl:grid-cols-[1fr_1fr] gap-5 mb-5">
        <section className="bg-white border border-slate-100 rounded-lg p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="font-bold text-slate-900">Attendance Graph</h3>
            <span className="text-xl font-extrabold text-[#33373e]">{attendanceRate}%</span>
          </div>
          <div className="h-3 rounded-full bg-[#f5f5f6] overflow-hidden">
            <div className="h-full bg-emerald-500" style={{ width: `${attendanceRate}%` }} />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-lg bg-[#f5f5f6] p-3">Present<br /><b>{presentCount}</b></div>
            <div className="rounded-lg bg-[#f5f5f6] p-3">Absent<br /><b>{attendanceRecords.filter((item) => item.status === 'Absent').length}</b></div>
            <div className="rounded-lg bg-[#f5f5f6] p-3">Records<br /><b>{attendanceTotal}</b></div>
          </div>
        </section>
        <section className="bg-white border border-slate-100 rounded-lg p-5 shadow-sm">
          <h3 className="font-bold text-slate-900 mb-4">Timetable</h3>
          <div className="space-y-3">
            {timetableEntries.slice(0, 5).map((entry) => (
              <div key={entry.id} className="rounded-lg bg-[#f5f5f6] p-3 text-sm">
                <div className="font-semibold text-slate-900">{entry.subject}</div>
                <div className="text-xs text-slate-500 mt-1">{entry.day} | {entry.timeSlot} | {entry.classKey}</div>
              </div>
            ))}
            {!timetableEntries.length && <div className="rounded-lg bg-[#f5f5f6] p-3 text-sm text-slate-500">No timetable entries assigned.</div>}
          </div>
        </section>
      </div>
      <button
        type="button"
        onClick={() => setShowAllDetails((open) => !open)}
        className="mb-5 h-10 px-5 rounded-lg bg-[#33373e] text-white font-semibold text-sm"
      >
        {showAllDetails ? 'Hide all details' : 'View all details'}
      </button>
      </>
      )}
    </div>
  );
}

export default function FacultyStaffManagement({ currentUser, academicYear = '', onOpenDocuments, selectedCourse = null, selectedCourseCode = 'all' }) {
  const [staffMembers, setStaffMembers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [leaveRecords, setLeaveRecords] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [studentAttendanceRecords, setStudentAttendanceRecords] = useState([]);
  const [timetableEntries, setTimetableEntries] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('active');
  const [loadError, setLoadError] = useState('');
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [leaveStaff, setLeaveStaff] = useState(null);

  useEffect(() => {
    const currentState = window.history.state || {};
    window.history.replaceState({
      ...currentState,
      facultyFlow: { selectedId: '' },
    }, '');

    const handleHistoryBack = (event) => {
      setSelectedId(event.state?.facultyFlow?.selectedId || '');
      setShowStaffModal(false);
      setEditingStaff(null);
      setLeaveStaff(null);
    };

    window.addEventListener('popstate', handleHistoryBack);
    return () => window.removeEventListener('popstate', handleHistoryBack);
  }, []);

  useEffect(() => {
    const loadFacultyStaff = async () => {
      if (!isFirebaseConfigured) {
        setLoadError('Live Firebase data is not configured.');
        return;
      }
      try {
        const data = await getFacultyStaffData(academicYear);
        setStaffMembers(data.staff || []);
        setDepartments(data.departments || []);
        setSelectedId('');
        setLeaveRecords(data.leaveRecords || []);
        setAttendanceRecords(data.attendanceRecords || []);
        setStudentAttendanceRecords(data.studentAttendanceRecords || []);
        setTimetableEntries(data.timetableEntries || []);
        setLoadError('');
      } catch (error) {
        console.warn('Unable to load live faculty/staff data.', error);
        setLoadError('Unable to load live faculty/staff records.');
      }
    };
    loadFacultyStaff();
  }, [academicYear]);

  const courseStaffMembers = filterByCourse(staffMembers, selectedCourseCode, selectedCourse);
  const selectedStaff = selectedId ? courseStaffMembers.find((member) => member.id === selectedId) || null : null;
  const selectedLeaves = leaveRecords.filter((record) => relationMatchesStaff(record, selectedStaff));
  const selectedAttendance = attendanceRecords.filter((record) => relationMatchesStaff(record, selectedStaff));
  const selectedTimetableEntries = timetableEntries.filter((entry) => (
    entry.facultyId === selectedStaff?.id || entry.facultyName === selectedStaff?.name
  ));
  const selectedTeachingRecords = studentAttendanceRecords.filter((record) => (
    record.facultyRecordId === selectedStaff?.id ||
    record.facultyId === selectedStaff?.employeeId ||
    record.facultyName === selectedStaff?.name
  ));

  const selectStaff = (staffId) => {
    setSelectedId(staffId);
    window.history.replaceState({ ...(window.history.state || {}), facultyFlow: { selectedId: '' } }, '');
    window.history.pushState({ ...(window.history.state || {}), facultyFlow: { selectedId: staffId } }, '');
  };

  const goBackOneFacultyStep = () => {
    if (window.history.state?.facultyFlow?.selectedId) {
      setSelectedId('');
      window.history.replaceState({ ...(window.history.state || {}), facultyFlow: { selectedId: '' } }, '');
      return;
    }
    setSelectedId('');
  };

  const filteredStaff = useMemo(() => {
    const term = search.trim().toLowerCase();
    const byStatus = statusFilter === 'archived'
      ? courseStaffMembers.filter((member) => member.status === 'Archived')
      : courseStaffMembers.filter((member) => member.status !== 'Archived');
    const byType = typeFilter === 'All' ? byStatus : byStatus.filter((member) => member.staffType === typeFilter);
    if (!term) return byType;
    return byType.filter((member) =>
      [member.name, member.employeeId, member.department, member.designation, member.staffType]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(term))
    );
  }, [courseStaffMembers, search, statusFilter, typeFilter]);

  const currentRoleId = currentUser?.roleId || 'admin';
  const canCreateStaff = canAccess(defaultRoles, currentRoleId, 'staff.create');
  const canEditStaff = canAccess(defaultRoles, currentRoleId, 'staff.edit');
  const canArchiveStaff = canAccess(defaultRoles, currentRoleId, 'staff.archive');
  const canManageLeave = canAccess(defaultRoles, currentRoleId, 'staff.leave');
  const canMarkAttendance = canAccess(defaultRoles, currentRoleId, 'staff.attendance');

  const saveStaff = async (form) => {
    if (!canCreateStaff) {
      toast.error('You do not have permission to create staff records.');
      return;
    }
    const validationMessage = validateStaffForm(form);
    if (validationMessage) {
      toast.error(validationMessage);
      return;
    }

    const createdAtText = formatDisplayDate();
    const payload = {
      ...form,
      name: form.name.trim(),
      employeeId: form.employeeId.trim(),
      designation: form.designation.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      qualification: form.qualification.trim(),
      status: 'Active',
      createdAtText,
    };

    try {
      const id = await createStaffMember(payload);
      if (!id) throw new Error('Live staff record was not created.');
      const created = { id, ...payload };
      setStaffMembers((prev) => [created, ...prev]);
      setSelectedId(created.id);
      toast.success('Staff record saved');
    } catch (error) {
      console.error('Unable to create live staff record.', error);
      toast.error('Staff record was not saved to live data.');
    } finally {
      setShowStaffModal(false);
    }
  };

  const updateStaff = async (form) => {
    if (!editingStaff) return;
    if (!canEditStaff) {
      toast.error('You do not have permission to edit staff records.');
      return;
    }
    const validationMessage = validateStaffForm(form);
    if (validationMessage) {
      toast.error(validationMessage);
      return;
    }
    const updates = {
      ...form,
      name: form.name.trim(),
      designation: form.designation.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      qualification: form.qualification.trim(),
      updatedAtText: formatDisplayDate(),
    };

    try {
      await updateStaffMember(editingStaff.id, updates);
      setStaffMembers((prev) => prev.map((member) => (member.id === editingStaff.id ? { ...member, ...updates } : member)));
      toast.success('Staff record updated');
    } catch (error) {
      console.error('Unable to update live staff record.', error);
      toast.error('Staff record was not saved to live data.');
    } finally {
      setEditingStaff(null);
    }
  };

  const archiveStaff = async (member) => {
    if (!canArchiveStaff) {
      toast.error('You do not have permission to archive staff records.');
      return;
    }
    const updates = { status: 'Archived', archivedAtText: formatDisplayDate() };
    try {
      await archiveStaffMember(member.id, updates);
      setStaffMembers((prev) => prev.map((item) => (item.id === member.id ? { ...item, ...updates } : item)));
      const next = staffMembers.find((item) => item.id !== member.id && item.status !== 'Archived');
      if (selectedId === member.id && next) setSelectedId(next.id);
      toast.success('Staff record archived');
    } catch (error) {
      console.error('Unable to archive live staff record.', error);
      toast.error('Staff record archive was not saved to live data.');
    }
  };

  const restoreStaff = async (member) => {
    if (!canArchiveStaff) {
      toast.error('You do not have permission to restore staff records.');
      return;
    }
    const updates = { status: 'Active', restoredAtText: formatDisplayDate() };
    try {
      await restoreStaffMember(member.id, updates);
      setStaffMembers((prev) => prev.map((item) => (item.id === member.id ? { ...item, ...updates } : item)));
      setSelectedId(member.id);
      setStatusFilter('active');
      toast.success('Staff record restored');
    } catch (error) {
      console.error('Unable to restore live staff record.', error);
      toast.error('Staff record restore was not saved to live data.');
    }
  };

  const saveLeave = async (form) => {
    if (!leaveStaff) return;
    if (!canManageLeave) {
      toast.error('You do not have permission to manage leave.');
      return;
    }
    const validationMessage = validateLeaveForm(form);
    if (validationMessage) {
      toast.error(validationMessage);
      return;
    }

    const payload = {
      staffRecordId: leaveStaff.id,
      employeeId: leaveStaff.employeeId,
      ...form,
      reason: form.reason.trim(),
      status: 'Pending Review',
      requestedAtText: formatDisplayDate(),
    };

    try {
      const id = await createStaffLeaveRecord(payload);
      if (!id) throw new Error('Live leave request was not created.');
      setLeaveRecords((prev) => [{ id, ...payload }, ...prev]);
      toast.success('Leave request saved');
    } catch (error) {
      console.error('Unable to create live leave request.', error);
      toast.error('Leave request was not saved to live data.');
    } finally {
      setLeaveStaff(null);
    }
  };

  const decideLeave = async (leaveRecord, status) => {
    if (!canManageLeave) {
      toast.error('You do not have permission to manage leave.');
      return;
    }
    const updates = { status, decidedAtText: formatDisplayDate() };
    try {
      await updateStaffLeaveRecord(leaveRecord.id, updates);
      setLeaveRecords((prev) => prev.map((record) => (record.id === leaveRecord.id ? { ...record, ...updates } : record)));
      toast.success(`Leave ${status.toLowerCase()}`);
    } catch (error) {
      console.error('Unable to update live leave request.', error);
      toast.error('Leave decision was not saved to live data.');
    }
  };

  const markAttendance = async (status) => {
    if (!canMarkAttendance) {
      toast.error('You do not have permission to mark attendance.');
      return;
    }
    const dateText = formatDisplayDate();
    const duplicate = attendanceRecords.find((record) => buildAttendanceKey(selectedStaff, dateText) === `${record.employeeId}-${record.dateText}`);
    if (duplicate) {
      toast.error('Attendance already marked for today.');
      return;
    }

    const payload = {
      staffRecordId: selectedStaff.id,
      employeeId: selectedStaff.employeeId,
      academicYear,
      dateText,
      status,
      markedAtText: dateText,
    };

    try {
      const id = await createStaffAttendanceRecord(payload);
      if (!id) throw new Error('Live staff attendance record was not created.');
      setAttendanceRecords((prev) => [{ id, ...payload }, ...prev]);
      toast.success(`Attendance marked ${status.toLowerCase()}`);
    } catch (error) {
      console.error('Unable to create live staff attendance.', error);
      toast.error('Staff attendance was not saved to live data.');
    }
  };

  return (
    <div>
      {selectedStaff ? (
        <StaffDetailPage
          attendanceRecords={selectedAttendance}
          canEdit={canEditStaff}
          canManageLeave={canManageLeave}
          canMarkAttendance={canMarkAttendance}
          leaveRecords={selectedLeaves}
          onAttendance={markAttendance}
          onBack={goBackOneFacultyStep}
          onEdit={() => setEditingStaff(selectedStaff)}
          onLeaveDecision={decideLeave}
          onOpenDocuments={() => onOpenDocuments?.({
            ownerId: selectedStaff.employeeId,
            ownerName: selectedStaff.name,
            ownerRecordId: selectedStaff.id,
            ownerType: 'Staff',
          })}
          staffMember={selectedStaff}
          teachingRecords={selectedTeachingRecords}
          timetableEntries={selectedTimetableEntries}
        />
      ) : (
      <>
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <div className="text-sm font-bold text-slate-500 mb-2">Academics / <span className="text-[#f39a5f]">Faculty & Staff Management</span></div>
          <h1 className="text-2xl font-bold text-slate-900">Faculty & Staff Management</h1>
          {!isFirebaseConfigured && <p className="text-xs text-rose-600 mt-2">Live Firebase data is not configured.</p>}
          {loadError && <p className="text-xs text-rose-600 mt-2">{loadError}</p>}
        </div>
      </div>

      <div className="erp-branch-focus flex flex-col lg:flex-row lg:items-center justify-between gap-4 my-5 rounded-lg bg-[#f5f5f6] p-5 border border-slate-100">
        <div className="flex items-center gap-4 min-w-0">
          <div className="erp-branch-icon h-16 w-16 rounded-lg bg-white text-[#fb8d49] flex items-center justify-center shrink-0"><Users size={28} /></div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-slate-500">Faculty & Staff</div>
            <h2 className="text-2xl font-extrabold text-slate-900 mt-1">All Faculty & Staff</h2>
            <p className="text-sm text-slate-500 mt-1">Browse active and archived records.</p>
          </div>
        </div>
      </div>

      <div>
        <div className="min-w-0">
          <div className="relative mb-4">
            <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, employee ID, department..." className="w-full h-11 rounded-lg bg-[#f0f0f2] border-0 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-orange-100" />
          </div>
          <div className="flex flex-wrap items-center gap-2 mb-5">
            {['All', 'Faculty', 'Staff'].map((type) => (
              <button
                key={type}
                onClick={() => setTypeFilter(type)}
                className={`h-10 px-4 rounded-md border text-sm ${typeFilter === type ? 'bg-[#33373e] text-white border-[#33373e]' : 'bg-white text-slate-600 border-slate-200'}`}
              >
                {type}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 mb-4">
            {[
              ['active', 'Active Records'],
              ['archived', 'Archived'],
            ].map(([value, label]) => (
              <button
                key={value}
                onClick={() => setStatusFilter(value)}
                className={`h-9 px-4 rounded-md border text-xs font-semibold ${statusFilter === value ? 'bg-[#33373e] text-white border-[#33373e]' : 'bg-white text-slate-600 border-slate-200'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <StaffTable
            staff={filteredStaff}
            selectedId={selectedId}
            canArchive={canArchiveStaff}
            canEdit={canEditStaff}
            canManageLeave={canManageLeave}
            onSelect={selectStaff}
            onEdit={setEditingStaff}
            onLeave={setLeaveStaff}
            onArchive={archiveStaff}
            onRestore={restoreStaff}
            showActions={false}
          />
        </div>
      </div>
      </>
      )}

      {showStaffModal && <StaffModal departments={departments} onClose={() => setShowStaffModal(false)} onSave={saveStaff} />}
      {editingStaff && <StaffModal mode="edit" initialStaff={editingStaff} departments={departments} onClose={() => setEditingStaff(null)} onSave={updateStaff} />}
      {leaveStaff && <LeaveModal staffMember={leaveStaff} onClose={() => setLeaveStaff(null)} onSave={saveLeave} />}
    </div>
  );
}
