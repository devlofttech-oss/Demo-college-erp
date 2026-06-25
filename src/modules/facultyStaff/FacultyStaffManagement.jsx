import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Plus, Search, Users } from 'lucide-react';
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
import { demoAttendanceRecords, demoDepartments, demoLeaveRecords, demoStaffMembers } from './demoFacultyStaff';
import { buildAttendanceKey, formatDisplayDate, relationMatchesStaff, validateLeaveForm, validateStaffForm } from './facultyStaffUtils';
import { defaultRoles, canAccess } from '../userRoles/rolePermissions';
import LeaveModal from './components/LeaveModal';
import StaffModal from './components/StaffModal';
import StaffProfilePanel from './components/StaffProfilePanel';
import StaffTable from './components/StaffTable';

function StaffDetailPage({
  attendanceRecords,
  canManageLeave,
  canMarkAttendance,
  leaveRecords,
  onAttendance,
  onBack,
  onLeaveDecision,
  staffMember,
}) {
  return (
    <div>
      <div className="flex flex-col gap-4 pb-6 border-b border-slate-100 mb-5">
        <button
          type="button"
          onClick={onBack}
          className="h-12 px-5 rounded-lg bg-[#fb8d49] text-white font-extrabold text-base flex items-center gap-2 self-start shadow-lg shadow-orange-200 hover:bg-[#e97934] focus:outline-none focus:ring-4 focus:ring-orange-200"
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
        canManageLeave={canManageLeave}
        canMarkAttendance={canMarkAttendance}
        className="w-full"
        leaveRecords={leaveRecords}
        onAttendance={onAttendance}
        onLeaveDecision={onLeaveDecision}
        showActions={false}
        staffMember={staffMember}
      />
    </div>
  );
}

export default function FacultyStaffManagement({ currentUser, academicYear = '2026-2027' }) {
  const [staffMembers, setStaffMembers] = useState(isFirebaseConfigured ? [] : demoStaffMembers);
  const [departments, setDepartments] = useState(isFirebaseConfigured ? [] : demoDepartments);
  const [leaveRecords, setLeaveRecords] = useState(isFirebaseConfigured ? [] : demoLeaveRecords);
  const [attendanceRecords, setAttendanceRecords] = useState(isFirebaseConfigured ? [] : demoAttendanceRecords);
  const [selectedId, setSelectedId] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('active');
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [loadError, setLoadError] = useState('');
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [leaveStaff, setLeaveStaff] = useState(null);

  useEffect(() => {
    const loadFacultyStaff = async () => {
      if (!isFirebaseConfigured) return;
      try {
        const data = await getFacultyStaffData(academicYear);
        setStaffMembers(data.staff || []);
        setDepartments(data.departments || []);
        setSelectedId('');
        setLeaveRecords(data.leaveRecords || []);
        setAttendanceRecords(data.attendanceRecords || []);
      } catch (error) {
        console.warn('Using demo faculty/staff because Firestore is not reachable.', error);
        setLoadError('Unable to load Firestore faculty/staff records. Showing demo/local records.');
      } finally {
        setLoading(false);
      }
    };
    loadFacultyStaff();
  }, [academicYear]);

  const selectedStaff = selectedId ? staffMembers.find((member) => member.id === selectedId) || null : null;
  const selectedLeaves = leaveRecords.filter((record) => relationMatchesStaff(record, selectedStaff));
  const selectedAttendance = attendanceRecords.filter((record) => relationMatchesStaff(record, selectedStaff));

  const filteredStaff = useMemo(() => {
    const term = search.trim().toLowerCase();
    const byStatus = statusFilter === 'archived'
      ? staffMembers.filter((member) => member.status === 'Archived')
      : staffMembers.filter((member) => member.status !== 'Archived');
    const byType = typeFilter === 'All' ? byStatus : byStatus.filter((member) => member.staffType === typeFilter);
    if (!term) return byType;
    return byType.filter((member) =>
      [member.name, member.employeeId, member.department, member.designation, member.staffType]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(term))
    );
  }, [search, staffMembers, statusFilter, typeFilter]);

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
      const created = { id: id || `local-staff-${Date.now()}`, ...payload };
      setStaffMembers((prev) => [created, ...prev]);
      setSelectedId(created.id);
      toast.success(id ? 'Staff record saved' : 'Staff record added locally. Add Firebase keys to persist.');
    } catch {
      const local = { id: `local-staff-${Date.now()}`, ...payload };
      setStaffMembers((prev) => [local, ...prev]);
      setSelectedId(local.id);
      toast.success('Staff record added locally. Check Firebase setup to persist it.');
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
    } catch {
      setStaffMembers((prev) => prev.map((member) => (member.id === editingStaff.id ? { ...member, ...updates } : member)));
      toast.success('Staff record updated locally. Check Firebase setup to persist it.');
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
    } catch {
      setStaffMembers((prev) => prev.map((item) => (item.id === member.id ? { ...item, ...updates } : item)));
      toast.success('Staff record archived locally. Check Firebase setup to persist it.');
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
    } catch {
      setStaffMembers((prev) => prev.map((item) => (item.id === member.id ? { ...item, ...updates } : item)));
      setSelectedId(member.id);
      setStatusFilter('active');
      toast.success('Staff record restored locally. Check Firebase setup to persist it.');
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
      setLeaveRecords((prev) => [{ id: id || `local-leave-${Date.now()}`, ...payload }, ...prev]);
      toast.success('Leave request saved');
    } catch {
      setLeaveRecords((prev) => [{ id: `local-leave-${Date.now()}`, ...payload }, ...prev]);
      toast.success('Leave request saved locally. Check Firebase setup to persist it.');
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
    } catch {
      setLeaveRecords((prev) => prev.map((record) => (record.id === leaveRecord.id ? { ...record, ...updates } : record)));
      toast.success(`Leave ${status.toLowerCase()} locally`);
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
      setAttendanceRecords((prev) => [{ id: id || `local-attendance-${Date.now()}`, ...payload }, ...prev]);
      toast.success(`Attendance marked ${status.toLowerCase()}`);
    } catch {
      setAttendanceRecords((prev) => [{ id: `local-attendance-${Date.now()}`, ...payload }, ...prev]);
      toast.success(`Attendance marked ${status.toLowerCase()} locally`);
    }
  };

  return (
    <div>
      {selectedStaff ? (
        <StaffDetailPage
          attendanceRecords={selectedAttendance}
          canManageLeave={canManageLeave}
          canMarkAttendance={canMarkAttendance}
          leaveRecords={selectedLeaves}
          onAttendance={markAttendance}
          onBack={() => setSelectedId('')}
          onLeaveDecision={decideLeave}
          staffMember={selectedStaff}
        />
      ) : (
      <>
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <div className="text-sm font-bold text-slate-500 mb-2">Academics / <span className="text-[#f39a5f]">Faculty & Staff Management</span></div>
          <h1 className="text-2xl font-bold text-slate-900">Faculty & Staff Management</h1>
          <p className="text-sm text-slate-500 mt-1">Browse faculty and staff records.</p>
          {!isFirebaseConfigured && <p className="text-xs text-orange-600 mt-2">Demo mode: add Firebase keys to persist records.</p>}
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
        <div className="flex flex-wrap gap-2">
          <span className="h-10 px-4 rounded-full bg-white border border-slate-200 text-slate-700 font-bold text-xs flex items-center">
            {loading ? 'Loading...' : `${filteredStaff.length} records`}
          </span>
          {canCreateStaff && (
            <button onClick={() => setShowStaffModal(true)} className="h-10 px-4 rounded-full bg-[#fb9a5b] text-white font-semibold text-sm flex items-center gap-2"><Plus size={16} /> New Record</button>
          )}
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
            onSelect={setSelectedId}
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
