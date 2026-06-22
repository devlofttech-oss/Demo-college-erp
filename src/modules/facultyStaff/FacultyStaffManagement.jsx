import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Building2, CalendarCheck, Plus, Search, UserRound, Users } from 'lucide-react';
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

export default function FacultyStaffManagement({ currentUser, academicYear = '2026-2027' }) {
  const [staffMembers, setStaffMembers] = useState(demoStaffMembers);
  const [departments, setDepartments] = useState(demoDepartments);
  const [leaveRecords, setLeaveRecords] = useState(demoLeaveRecords);
  const [attendanceRecords, setAttendanceRecords] = useState(demoAttendanceRecords);
  const [selectedId, setSelectedId] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('active');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [leaveStaff, setLeaveStaff] = useState(null);
  const [activeStaffTask, setActiveStaffTask] = useState('');
  const [activeStaffBranch, setActiveStaffBranch] = useState('');

  useEffect(() => {
    const loadFacultyStaff = async () => {
      try {
        const data = await getFacultyStaffData(academicYear);
        if (data.staff.length) {
          setStaffMembers(data.staff);
          setSelectedId('');
        }
        if (data.departments.length) setDepartments(data.departments);
        setLeaveRecords(data.leaveRecords);
        setAttendanceRecords(data.attendanceRecords);
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

  const stats = [
    { label: 'Total Active', value: staffMembers.filter((member) => member.status !== 'Archived').length, icon: <Users size={22} /> },
    { label: 'Faculty', value: staffMembers.filter((member) => member.staffType === 'Faculty' && member.status !== 'Archived').length, icon: <UserRound size={22} /> },
    { label: 'Staff', value: staffMembers.filter((member) => member.staffType === 'Staff' && member.status !== 'Archived').length, icon: <UserRound size={22} /> },
    { label: 'Departments', value: departments.length, icon: <Building2 size={22} /> },
  ];
  const currentRoleId = currentUser?.roleId || 'admin';
  const canCreateStaff = canAccess(defaultRoles, currentRoleId, 'staff.create');
  const canEditStaff = canAccess(defaultRoles, currentRoleId, 'staff.edit');
  const canArchiveStaff = canAccess(defaultRoles, currentRoleId, 'staff.archive');
  const canManageLeave = canAccess(defaultRoles, currentRoleId, 'staff.leave');
  const canMarkAttendance = canAccess(defaultRoles, currentRoleId, 'staff.attendance');

  useEffect(() => {
    const currentState = window.history.state || {};
    window.history.replaceState({
      ...currentState,
      staffFlow: currentState.staffFlow || { task: '', branch: '' },
    }, '');
    const handleHistoryBack = (event) => {
      const flow = event.state?.staffFlow;
      setShowStaffModal(false);
      setEditingStaff(null);
      setLeaveStaff(null);
      setActiveStaffTask(flow?.task || '');
      setActiveStaffBranch(flow?.branch || '');
      setSelectedId('');
      setSearch('');
    };
    window.addEventListener('popstate', handleHistoryBack);
    return () => window.removeEventListener('popstate', handleHistoryBack);
  }, []);

  const openStaffTask = (taskId) => {
    setActiveStaffTask(taskId);
    setActiveStaffBranch('');
    setSelectedId('');
    setSearch('');
    window.history.pushState({ ...(window.history.state || {}), staffFlow: { task: taskId, branch: '' } }, '');
  };

  const openStaffBranch = (branch) => {
    setActiveStaffBranch(branch.id);
    setSelectedId('');
    setSearch('');
    if (branch.typeFilter) setTypeFilter(branch.typeFilter);
    if (branch.statusFilter) setStatusFilter(branch.statusFilter);
    window.history.pushState({ ...(window.history.state || {}), staffFlow: { task: activeStaffTask, branch: branch.id } }, '');
    if (branch.openStaff) setShowStaffModal(true);
  };

  const goBackOneStaffStep = () => {
    if (window.history.state?.staffFlow) {
      window.history.back();
      return;
    }
    if (activeStaffBranch) {
      setActiveStaffBranch('');
      setSelectedId('');
      return;
    }
    setActiveStaffTask('');
  };

  const staffTaskOptions = [
    { id: 'records', title: 'Staff Records', description: 'Create, edit, archive, and restore records.', icon: <Users size={22} />, meta: [`${staffMembers.length} records`, canCreateStaff ? 'Create enabled' : 'View only'] },
    { id: 'leave', title: 'Leave', description: 'Request, approve, or reject staff leave.', icon: <CalendarCheck size={22} />, meta: [`${leaveRecords.length} records`, canManageLeave ? 'Manage enabled' : 'View only'] },
    { id: 'attendance', title: 'Attendance', description: 'Mark staff attendance.', icon: <UserRound size={22} />, meta: [`${attendanceRecords.length} records`, canMarkAttendance ? 'Mark enabled' : 'View only'] },
  ];

  const staffBranchOptions = {
    records: [
      { id: 'new-record', title: 'New Record', description: 'Open staff record form.', icon: <Plus size={20} />, disabled: !canCreateStaff, openStaff: true },
      { id: 'active-records', title: 'Active Records', description: 'Select a staff member to view or edit.', icon: <Users size={20} />, statusFilter: 'active', typeFilter: 'All' },
      { id: 'archived-records', title: 'Archived Records', description: 'Select a record to restore.', icon: <Users size={20} />, statusFilter: 'archived', typeFilter: 'All' },
    ],
    leave: [
      { id: 'leave-request', title: 'Leave Request', description: 'Select staff member, then create leave.', icon: <CalendarCheck size={20} />, statusFilter: 'active' },
      { id: 'leave-review', title: 'Leave Review', description: 'Select staff member to approve or reject leave.', icon: <CalendarCheck size={20} />, statusFilter: 'active' },
    ],
    attendance: [
      { id: 'mark-attendance', title: 'Mark Attendance', description: 'Select staff member, then mark attendance.', icon: <UserRound size={20} />, statusFilter: 'active' },
    ],
  };

  const activeTask = staffTaskOptions.find((task) => task.id === activeStaffTask);
  const activeBranches = staffBranchOptions[activeStaffTask] || [];
  const activeBranch = activeBranches.find((branch) => branch.id === activeStaffBranch);
  const branchAccentText = activeStaffTask === 'leave' ? 'Leave work' : activeStaffTask === 'attendance' ? 'Attendance work' : 'Record work';

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
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <div className="text-sm font-bold text-slate-500 mb-2">Academics / <span className="text-[#f39a5f]">Faculty & Staff Management</span></div>
          <h1 className="text-2xl font-bold text-slate-900">Faculty & Staff Management</h1>
          <p className="text-sm text-slate-500 mt-1">Faculty and staff records, leave, and attendance. Department setup lives in Settings.</p>
          {!isFirebaseConfigured && <p className="text-xs text-orange-600 mt-2">Demo mode: add Firebase keys to persist records.</p>}
          {loadError && <p className="text-xs text-rose-600 mt-2">{loadError}</p>}
        </div>
      </div>

      {!activeStaffTask ? (
      <>
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 py-5">
        {stats.map(({ label, value, icon }) => (
          <div key={label} className="bg-[#f5f5f6] rounded-lg p-4 flex items-center gap-4">
            <div className="h-12 w-12 bg-white rounded-lg flex items-center justify-center text-[#34363d] shadow-sm">{icon}</div>
            <div>
              <div className="text-xs text-slate-500">{label}</div>
              <div className="text-xl font-bold text-slate-900">{loading ? '...' : value}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        {staffTaskOptions.map((task) => (
          <button key={task.id} onClick={() => openStaffTask(task.id)} className="group min-h-40 text-left rounded-lg border border-slate-100 bg-white p-5 shadow-sm hover:-translate-y-1 transition-all">
            <div className="flex items-start justify-between gap-4">
              <div className="h-12 w-12 rounded-lg bg-[#f5f5f6] text-[#34363d] flex items-center justify-center">{task.icon}</div>
              <ArrowRight size={18} className="text-slate-400 group-hover:text-[#fb8d49]" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 mt-5">{task.title}</h2>
            <p className="text-sm text-slate-500 mt-2">{task.description}</p>
            <div className="flex flex-wrap gap-2 mt-4">
              {task.meta.map((item) => <span key={item} className="rounded-full bg-[#f5f5f6] px-3 py-1 text-xs font-semibold text-slate-600">{item}</span>)}
            </div>
          </button>
        ))}
      </div>
      </>
      ) : !activeStaffBranch ? (
      <>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 my-5 rounded-lg bg-[#f5f5f6] p-4">
        <div>
          <div className="text-xs font-bold text-slate-500">Faculty & Staff / <span className="text-[#fb8d49]">{activeTask?.title}</span></div>
          <h2 className="text-lg font-bold text-slate-900 mt-1">Choose next step</h2>
        </div>
        <button onClick={goBackOneStaffStep} className="h-10 px-4 rounded-lg bg-white border border-slate-200 text-slate-700 font-semibold text-sm flex items-center gap-2">
          <ArrowLeft size={15} /> Back
        </button>
      </div>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {activeBranches.map((branch) => (
          <button key={branch.id} onClick={() => openStaffBranch(branch)} disabled={branch.disabled} className="group min-h-36 text-left rounded-lg border border-slate-100 bg-white p-5 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed">
            <div className="flex items-start justify-between gap-4">
              <div className="h-11 w-11 rounded-lg bg-[#f5f5f6] text-[#34363d] flex items-center justify-center">{branch.icon}</div>
              <ArrowRight size={17} className="text-slate-400 group-hover:text-[#fb8d49]" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mt-4">{branch.title}</h3>
            <p className="text-sm text-slate-500 mt-2">{branch.disabled ? 'Not available right now.' : branch.description}</p>
          </button>
        ))}
      </div>
      </>
      ) : (
      <>
      <div className="erp-branch-focus flex flex-col lg:flex-row lg:items-center justify-between gap-4 my-5 rounded-lg bg-[#f5f5f6] p-5 border border-slate-100">
        <div className="flex items-center gap-4 min-w-0">
          <div className="erp-branch-icon h-16 w-16 rounded-lg bg-white text-[#fb8d49] flex items-center justify-center shrink-0">{activeBranch?.icon}</div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-slate-500">Faculty & Staff / {activeTask?.title}</div>
            <h2 className="text-2xl font-extrabold text-slate-900 mt-1">{activeBranch?.title}</h2>
            <p className="text-sm text-slate-500 mt-1">{activeBranch?.description}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="h-10 px-4 rounded-full bg-white border border-slate-200 text-slate-700 font-bold text-xs flex items-center">{branchAccentText}</span>
          {activeStaffBranch === 'new-record' && canCreateStaff && (
            <button onClick={() => setShowStaffModal(true)} className="h-10 px-4 rounded-full bg-[#fb9a5b] text-white font-semibold text-sm flex items-center gap-2"><Plus size={16} /> Open Form</button>
          )}
          <button onClick={goBackOneStaffStep} className="h-10 px-4 rounded-lg bg-white border border-slate-200 text-slate-700 font-semibold text-sm flex items-center gap-2">
            <ArrowLeft size={15} /> Back
          </button>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-5">
        <div className="xl:w-[68%] min-w-0">
          {activeStaffTask === 'records' && (
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
          )}
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
          <div className="relative mb-4">
            <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, employee ID, department..." className="w-full h-11 rounded-lg bg-[#f0f0f2] border-0 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-orange-100" />
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

        {selectedStaff ? (
          <div className="erp-selected-detail xl:w-[32%]">
            <StaffProfilePanel
              staffMember={selectedStaff}
              leaveRecords={selectedLeaves}
              attendanceRecords={selectedAttendance}
              canManageLeave={canManageLeave}
              canMarkAttendance={canMarkAttendance}
              onAttendance={markAttendance}
              onLeaveDecision={decideLeave}
              className="w-full"
            />
            <div className="grid grid-cols-2 gap-2">
              {activeStaffTask === 'records' && (
                <>
                  <button onClick={() => setEditingStaff(selectedStaff)} disabled={!canEditStaff} className="h-10 rounded-lg bg-[#33373e] text-white text-sm font-semibold disabled:bg-slate-300">Edit</button>
                  <button onClick={() => selectedStaff.status === 'Archived' ? restoreStaff(selectedStaff) : archiveStaff(selectedStaff)} disabled={!canArchiveStaff} className="h-10 rounded-lg bg-[#33373e] text-white text-sm font-semibold disabled:bg-slate-300">{selectedStaff.status === 'Archived' ? 'Restore' : 'Archive'}</button>
                </>
              )}
              {activeStaffTask === 'leave' && (
                <button onClick={() => setLeaveStaff(selectedStaff)} disabled={!canManageLeave} className="col-span-2 h-10 rounded-full bg-[#fb9a5b] text-white text-sm font-semibold disabled:bg-slate-300">Create Leave Request</button>
              )}
            </div>
          </div>
        ) : (
          <aside className="xl:w-[32%]">
            <div className="bg-white border border-slate-100 rounded-lg p-6 shadow-sm text-sm text-slate-600 min-h-72 flex flex-col items-center justify-center text-center">
              <div className="h-14 w-14 rounded-lg bg-[#f5f5f6] text-[#fb8d49] flex items-center justify-center mb-4">{activeBranch?.icon}</div>
              <h3 className="font-bold text-slate-900 mb-2">Staff Details</h3>
              <p>{filteredStaff.length ? 'Click a staff row to view details and available actions.' : 'No matching staff records found.'}</p>
            </div>
          </aside>
        )}
      </div>
      </>
      )}

      {showStaffModal && <StaffModal departments={departments} onClose={() => setShowStaffModal(false)} onSave={saveStaff} />}
      {editingStaff && <StaffModal mode="edit" initialStaff={editingStaff} departments={departments} onClose={() => setEditingStaff(null)} onSave={updateStaff} />}
      {leaveStaff && <LeaveModal staffMember={leaveStaff} onClose={() => setLeaveStaff(null)} onSave={saveLeave} />}
    </div>
  );
}
