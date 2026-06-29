import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Bell, CalendarDays, CheckCircle, Search, UserCheck, Users, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  createAttendanceNotification,
  createStudentAttendanceRecord,
  createStaffAttendanceRecord,
  getAttendanceManagementData,
  updateStudentAttendanceRecord,
} from '../../firebase/db';
import { isFirebaseConfigured } from '../../firebase/config';
import { canAccess, defaultRoles } from '../userRoles/rolePermissions';
import {
  buildAttendanceKey,
  formatDisplayDate,
  summarizeAttendance,
} from './attendanceUtils';
import {
  demoAttendanceStaff,
  demoAttendanceStudents,
  demoStaffAttendance,
  demoStudentAttendance,
} from './demoAttendance';
import { demoAcademicSubjects } from '../academics/demoAcademics';
import AttendanceReports from './components/AttendanceReports';
import AttendanceTable from './components/AttendanceTable';
import { filterStudentScopedRecords, filterStudentsByCourse } from '../shared/courseFilters';

function getTodayInputValue() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatInputDate(inputDate) {
  return formatDisplayDate(new Date(`${inputDate}T00:00:00`));
}

export default function AttendanceManagement({ currentUser, academicYear = '2026-2027', scopedStudents = [], selectedCourse = null, selectedCourseCode = 'all' }) {
  const [students, setStudents] = useState(isFirebaseConfigured ? [] : demoAttendanceStudents);
  const [staff, setStaff] = useState(isFirebaseConfigured ? [] : demoAttendanceStaff);
  const [studentAttendance, setStudentAttendance] = useState(isFirebaseConfigured ? [] : demoStudentAttendance);
  const [staffAttendance, setStaffAttendance] = useState(isFirebaseConfigured ? [] : demoStaffAttendance);
  const [academicSubjects, setAcademicSubjects] = useState(isFirebaseConfigured ? [] : demoAcademicSubjects);
  const [mode, setMode] = useState('students');
  const [reportScope, setReportScope] = useState('daily');
  const [selectedSubjectCode, setSelectedSubjectCode] = useState('');
  const [search, setSearch] = useState('');
  const [selectedDateInput, setSelectedDateInput] = useState(getTodayInputValue);
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [loadError, setLoadError] = useState('');
  const [activeAttendanceTask, setActiveAttendanceTask] = useState('');
  const [activeAttendanceBranch, setActiveAttendanceBranch] = useState('');
  const [selectedEntityId, setSelectedEntityId] = useState('');

  useEffect(() => {
    const loadAttendance = async () => {
      if (!isFirebaseConfigured) return;
      try {
        const data = await getAttendanceManagementData(academicYear);
        if (data.students.length) setStudents(data.students.filter((student) => student.status !== 'Archived'));
        if (data.staff.length) setStaff(data.staff.filter((member) => member.status !== 'Archived'));
        setStudentAttendance(data.studentAttendance);
        setStaffAttendance(data.staffAttendance);
        setAcademicSubjects(data.academicSubjects || []);
      } catch (error) {
        console.warn('Using demo attendance because Firestore is not reachable.', error);
        setLoadError('Unable to load Firestore attendance records. Showing demo/local records.');
      } finally {
        setLoading(false);
      }
    };
    loadAttendance();
  }, [academicYear]);

  useEffect(() => {
    const currentState = window.history.state || {};
    window.history.replaceState({
      ...currentState,
      attendanceFlow: currentState.attendanceFlow || { task: '', branch: '', mode: 'students', scope: 'daily' },
    }, '');

    const handleHistoryBack = (event) => {
      const flow = event.state?.attendanceFlow;
      if (!flow) {
        setActiveAttendanceTask('');
        setActiveAttendanceBranch('');
        setSelectedEntityId('');
        return;
      }
      setActiveAttendanceTask(flow.task || '');
      setActiveAttendanceBranch(flow.branch || '');
      setMode(flow.mode || 'students');
      setReportScope(flow.scope || 'daily');
      setSelectedEntityId('');
      setSearch('');
    };

    window.addEventListener('popstate', handleHistoryBack);
    return () => window.removeEventListener('popstate', handleHistoryBack);
  }, []);

  const currentRoleId = currentUser?.roleId || 'admin';
  const canMarkStudents = canAccess(defaultRoles, currentRoleId, 'attendance.markStudents');
  const canMarkStaff = canAccess(defaultRoles, currentRoleId, 'attendance.markStaff');
  const canNotifyParents = canAccess(defaultRoles, currentRoleId, 'attendance.notifyParents');
  const canViewReports = canAccess(defaultRoles, currentRoleId, 'attendance.reports');

  const courseStudents = scopedStudents.length ? scopedStudents : filterStudentsByCourse(students, selectedCourseCode, selectedCourse);
  const subjectOptions = useMemo(() => {
    const subjects = academicSubjects
      .filter((subject) => selectedCourseCode === 'all' || subject.courseCode === selectedCourseCode || subject.programName === selectedCourse?.courseName)
      .map((subject) => ({
        code: subject.subjectCode || subject.id || subject.subjectName,
        name: subject.subjectName || subject.name,
      }))
      .filter((subject) => subject.name);
    if (subjects.length) return subjects;
    return [
      { code: 'general', name: selectedCourse?.courseName ? `${selectedCourse.courseName} Attendance` : 'General Attendance' },
    ];
  }, [academicSubjects, selectedCourse, selectedCourseCode]);
  const selectedSubject = subjectOptions.find((subject) => subject.code === selectedSubjectCode) || subjectOptions[0];
  const courseStudentAttendance = filterStudentScopedRecords(studentAttendance, courseStudents, selectedCourseCode, selectedCourse);
  const allModeRecords = mode === 'students' ? courseStudentAttendance : staffAttendance;
  const activeRecords = mode === 'students'
    ? allModeRecords.filter((record) => !selectedSubject?.name || (record.subjectName || record.subject || 'General Attendance') === selectedSubject.name)
    : allModeRecords;
  const selectedDate = formatInputDate(selectedDateInput);
  const selectedDateRecords = activeRecords.filter((record) => record.dateText === selectedDate);
  const activeEntities = useMemo(() => {
    const term = search.trim().toLowerCase();
    const source = mode === 'students' ? courseStudents : staff;
    if (!term) return source;
    return source.filter((entity) =>
      [entity.name, entity.studentId, entity.employeeId, entity.className, entity.department]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(term))
    );
  }, [courseStudents, mode, search, staff]);

  const summary = summarizeAttendance(selectedDateRecords);
  const stats = [
    { label: 'Present', value: summary.present, icon: <CheckCircle size={22} /> },
    { label: 'Absent', value: summary.absent, icon: <XCircle size={22} /> },
    { label: 'Attendance %', value: `${summary.percentage}%`, icon: <CalendarDays size={22} /> },
  ];
  const selectedEntity = selectedEntityId ? activeEntities.find((entity) => entity.id === selectedEntityId) || null : null;
  const selectedEntityKey = selectedEntity?.studentId || selectedEntity?.employeeId || '';
  const selectedRecord = selectedEntityKey
    ? activeRecords.find((record) => record.entityId === selectedEntityKey && record.dateText === selectedDate)
    : null;
  const canMarkActiveMode = mode === 'students' ? canMarkStudents : canMarkStaff;

  const openAttendanceTask = (taskId, nextMode = mode) => {
    setActiveAttendanceTask(taskId);
    setActiveAttendanceBranch('');
    setSelectedEntityId('');
    setSearch('');
    setMode(nextMode);
    window.history.pushState({ ...(window.history.state || {}), attendanceFlow: { task: taskId, branch: '', mode: nextMode, scope: reportScope } }, '');
  };

  const openAttendanceBranch = ({ branchId, nextMode = mode, nextScope = reportScope }) => {
    setActiveAttendanceBranch(branchId);
    setSelectedEntityId('');
    setSearch('');
    setMode(nextMode);
    setReportScope(nextScope);
    window.history.pushState({ ...(window.history.state || {}), attendanceFlow: { task: activeAttendanceTask, branch: branchId, mode: nextMode, scope: nextScope } }, '');
  };

  const goBackOneAttendanceStep = () => {
    const flow = window.history.state?.attendanceFlow;
    if (flow?.branch || flow?.task) {
      window.history.back();
      return;
    }
    if (activeAttendanceBranch) {
      setActiveAttendanceBranch('');
      setSelectedEntityId('');
      return;
    }
    setActiveAttendanceTask('');
  };

  const attendanceTaskOptions = [
    {
      id: 'students',
      title: 'Student Attendance',
      description: 'Mark students and follow up absentees.',
      icon: <Users size={22} />,
      meta: [`${courseStudents.length} students`, canMarkStudents ? 'Mark enabled' : 'View only'],
      onOpen: () => openAttendanceTask('students', 'students'),
    },
    {
      id: 'staff',
      title: 'Staff Attendance',
      description: 'Mark faculty and staff attendance.',
      icon: <UserCheck size={22} />,
      meta: [`${staff.length} staff`, canMarkStaff ? 'Mark enabled' : 'View only'],
      onOpen: () => openAttendanceTask('staff', 'staff'),
    },
    {
      id: 'reports',
      title: 'Reports',
      description: 'Review daily, monthly, and yearly summaries.',
      icon: <CalendarDays size={22} />,
      meta: [`${summary.percentage}%`, canViewReports ? 'Reports enabled' : 'View only'],
      onOpen: () => openAttendanceTask('reports', mode),
    },
  ];

  const attendanceBranchOptions = {
    students: [
      { id: 'mark-students', title: 'Mark Student Attendance', description: 'Select a student, then mark present or absent.', icon: <CheckCircle size={20} />, nextMode: 'students' },
      { id: 'absent-followup', title: 'Absent Follow-up', description: 'Select an absent student, then notify parent.', icon: <Bell size={20} />, nextMode: 'students' },
    ],
    staff: [
      { id: 'mark-staff', title: 'Mark Staff Attendance', description: 'Select a staff member, then mark attendance.', icon: <UserCheck size={20} />, nextMode: 'staff' },
    ],
    reports: [
      { id: 'daily-report', title: 'Daily Report', description: 'View daily attendance summary.', icon: <CalendarDays size={20} />, nextScope: 'daily' },
      { id: 'monthly-report', title: 'Monthly Report', description: 'View monthly attendance summary.', icon: <CalendarDays size={20} />, nextScope: 'monthly' },
      { id: 'yearly-report', title: 'Yearly Report', description: 'View yearly attendance summary.', icon: <CalendarDays size={20} />, nextScope: 'yearly' },
    ],
  };

  const activeTask = attendanceTaskOptions.find((task) => task.id === activeAttendanceTask);
  const activeBranches = attendanceBranchOptions[activeAttendanceTask] || [];
  const activeBranch = activeBranches.find((branch) => branch.id === activeAttendanceBranch);
  const markAttendance = async (entity, status) => {
    const entityId = entity.studentId || entity.employeeId;
    const subjectName = mode === 'students' ? selectedSubject?.name || 'General Attendance' : '';
    const key = buildAttendanceKey(entityId, selectedDate, subjectName);
    const exists = allModeRecords.find((record) => buildAttendanceKey(record.entityId, record.dateText, record.subjectName || record.subject || '') === key);
    if (exists) {
      toast.error('Attendance already marked for selected date.');
      return;
    }

    const payload = {
      entityType: mode === 'students' ? 'Student' : 'Staff',
      entityRecordId: entity.id,
      entityId,
      entityName: entity.name,
      academicYear,
      className: entity.className || '',
      section: entity.section || '',
      department: entity.department || '',
      courseCode: entity.courseCode || selectedCourseCode,
      courseName: entity.courseName || entity.program || selectedCourse?.courseName || '',
      subjectCode: mode === 'students' ? selectedSubject?.code || '' : '',
      subjectName,
      dateText: selectedDate,
      status,
      markedAtText: formatDisplayDate(),
      parentNotified: false,
    };

    try {
      const id = mode === 'students'
        ? await createStudentAttendanceRecord(payload)
        : await createStaffAttendanceRecord(payload);
      const record = { id: id || `local-attendance-${Date.now()}`, ...payload };
      if (mode === 'students') setStudentAttendance((prev) => [record, ...prev]);
      else setStaffAttendance((prev) => [record, ...prev]);
      toast.success(`${payload.entityName} marked ${status.toLowerCase()}`);
    } catch {
      const record = { id: `local-attendance-${Date.now()}`, ...payload };
      if (mode === 'students') setStudentAttendance((prev) => [record, ...prev]);
      else setStaffAttendance((prev) => [record, ...prev]);
      toast.success(`Attendance marked locally. Check Firebase setup to persist it.`);
    }
  };

  const notifyParent = async (student, attendanceRecord) => {
    if (!canNotifyParents) {
      toast.error('You do not have permission to notify parents.');
      return;
    }

    const notification = {
      studentRecordId: student.id,
      studentId: student.studentId,
      studentName: student.name,
      channel: 'Parent Portal',
      academicYear,
      reason: `Absent on ${attendanceRecord.dateText}`,
      status: 'Queued',
      attendanceRecordId: attendanceRecord.id,
      createdAtText: formatDisplayDate(),
    };
    const attendanceUpdate = { parentNotified: true, parentNotifiedAtText: formatDisplayDate() };

    try {
      await createAttendanceNotification(notification);
      await updateStudentAttendanceRecord(attendanceRecord.id, attendanceUpdate);
      setStudentAttendance((prev) => prev.map((record) => record.id === attendanceRecord.id ? { ...record, ...attendanceUpdate } : record));
      toast.success('Parent notification queued');
    } catch {
      setStudentAttendance((prev) => prev.map((record) => record.id === attendanceRecord.id ? { ...record, ...attendanceUpdate } : record));
      toast.success('Parent notification queued locally');
    }
  };

  return (
    <div>
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <div className="text-sm font-bold text-slate-500 mb-2">Academics / <span className="text-[#f39a5f]">Attendance Management</span></div>
          <h1 className="text-2xl font-bold text-slate-900">Attendance Management</h1>
          <p className="text-sm text-slate-500 mt-1">Student and faculty attendance tracking with daily, monthly, and yearly reports.</p>
          {!isFirebaseConfigured && <p className="text-xs text-orange-600 mt-2">Demo mode: add Firebase keys to persist attendance.</p>}
          {loadError && <p className="text-xs text-rose-600 mt-2">{loadError}</p>}
        </div>
        <div className="flex items-center gap-3">
          {mode === 'students' && (
            <select
              value={selectedSubject?.code || ''}
              onChange={(event) => setSelectedSubjectCode(event.target.value)}
              className="h-10 rounded-lg border border-slate-200 px-3 text-sm"
              title="Subject"
            >
              {subjectOptions.map((subject) => (
                <option key={subject.code} value={subject.code}>{subject.name}</option>
              ))}
            </select>
          )}
          <input
            type="date"
            value={selectedDateInput}
            onChange={(event) => event.target.value && setSelectedDateInput(event.target.value)}
            className="h-10 rounded-lg border border-slate-200 px-3 text-sm"
          />
        </div>
      </div>

      {!activeAttendanceTask ? (
      <>
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4 py-5">
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

      <div className="grid md:grid-cols-3 gap-4">
        {attendanceTaskOptions.map((task) => (
          <button key={task.id} onClick={task.onOpen} className="group min-h-40 text-left rounded-lg border border-slate-100 bg-white p-5 shadow-sm hover:-translate-y-1 transition-all">
            <div className="flex items-start justify-between gap-4">
              <div className="h-12 w-12 rounded-lg bg-[#f5f5f6] text-[#34363d] flex items-center justify-center">{task.icon}</div>
              <ArrowRight size={18} className="text-slate-400 group-hover:text-[#fb8d49]" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 mt-5">{task.title}</h2>
            <p className="text-sm text-slate-500 mt-2">{task.description}</p>
            <div className="flex flex-wrap gap-2 mt-4">
              {task.meta.map((item) => (
                <span key={item} className="rounded-full bg-[#f5f5f6] px-3 py-1 text-xs font-semibold text-slate-600">{item}</span>
              ))}
            </div>
          </button>
        ))}
      </div>
      </>
      ) : !activeAttendanceBranch ? (
      <>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 my-5 rounded-lg bg-[#f5f5f6] p-4">
        <div className="flex items-center gap-3">
          <button onClick={goBackOneAttendanceStep} className="erp-back-button h-10 px-4 rounded-lg bg-white border border-slate-200 text-slate-700 font-semibold text-sm flex items-center gap-2">
            <ArrowLeft size={15} /> Back
          </button>
          <div>
            <div className="text-xs font-bold text-slate-500">Attendance / <span className="text-[#fb8d49]">{activeTask?.title}</span></div>
            <h2 className="text-lg font-bold text-slate-900 mt-1">Choose next step</h2>
          </div>
        </div>
      </div>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {activeBranches.map((branch) => (
          <button
            key={branch.id}
            onClick={() => openAttendanceBranch({ branchId: branch.id, nextMode: branch.nextMode || mode, nextScope: branch.nextScope || reportScope })}
            className="group min-h-36 text-left rounded-lg border border-slate-100 bg-white p-5 shadow-sm"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="h-11 w-11 rounded-lg bg-[#f5f5f6] text-[#34363d] flex items-center justify-center">{branch.icon}</div>
              <ArrowRight size={17} className="text-slate-400 group-hover:text-[#fb8d49]" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mt-4">{branch.title}</h3>
            <p className="text-sm text-slate-500 mt-2">{branch.description}</p>
          </button>
        ))}
      </div>
      </>
      ) : (
      <>
      <div className="erp-branch-focus flex flex-col lg:flex-row lg:items-center justify-between gap-4 my-5 rounded-lg bg-[#f5f5f6] p-5 border border-slate-100">
        <div className="flex items-center gap-4 min-w-0">
          <button onClick={goBackOneAttendanceStep} className="erp-back-button h-10 px-4 rounded-lg bg-white border border-slate-200 text-slate-700 font-semibold text-sm flex items-center gap-2 shrink-0">
            <ArrowLeft size={15} /> Back
          </button>
          <div className="erp-branch-icon h-16 w-16 rounded-lg bg-white text-[#fb8d49] flex items-center justify-center shrink-0">{activeBranch?.icon}</div>
          <div className="min-w-0">
            <h2 className="text-2xl font-extrabold text-slate-900">{activeBranch?.title}</h2>
          </div>
        </div>
      </div>

      {activeAttendanceTask === 'reports' ? (
        canViewReports ? (
          <AttendanceReports records={mode === 'students' ? courseStudentAttendance : staffAttendance} scope={reportScope} />
        ) : (
          <div className="bg-white border border-slate-100 rounded-lg p-5 shadow-sm text-sm text-slate-500">You do not have permission to view attendance reports.</div>
        )
      ) : (
      <div className="flex flex-col xl:flex-row gap-5">
        <div className="xl:w-[68%] min-w-0">
          {!canMarkStudents && mode === 'students' && (
            <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 text-sm">
              You can view student attendance but cannot mark it.
            </div>
          )}
          {!canMarkStaff && mode === 'staff' && (
            <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 text-sm">
              You can view staff attendance but cannot mark it.
            </div>
          )}

          <div className="relative mb-4">
            <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search attendance roster..."
              className="w-full h-11 rounded-lg bg-[#f0f0f2] border-0 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-orange-100"
            />
          </div>

          <AttendanceTable
            canMark={mode === 'students' ? canMarkStudents : canMarkStaff}
            canNotify={canNotifyParents}
            entities={activeEntities}
            mode={mode}
            records={activeRecords}
            selectedDate={selectedDate}
            onMark={markAttendance}
            onNotify={notifyParent}
            onSelect={setSelectedEntityId}
            selectedId={selectedEntityId}
            showActions={false}
          />
        </div>

        <aside className="xl:w-[32%] erp-sticky-inspector">
          {selectedEntity ? (
            <div className="erp-selected-detail bg-white border border-slate-100 rounded-lg p-5 shadow-sm">
              <h3 className="font-bold text-slate-900">{selectedEntity.name}</h3>
              <p className="text-xs text-slate-500 mt-1">{selectedEntityKey} | {mode === 'students' ? `${selectedEntity.className} - ${selectedEntity.section}` : selectedEntity.department}</p>
              <div className="rounded-lg bg-[#f5f5f6] p-3 mt-5 text-sm flex items-center justify-between">
                <span>Selected Date</span>
                <b>{selectedDate}</b>
              </div>
              <div className="rounded-lg bg-[#f5f5f6] p-3 mt-3 text-sm flex items-center justify-between">
                <span>Status</span>
                <span className="font-bold">{selectedRecord?.status || 'Not Marked'}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-5">
                {['Present', 'Absent'].map((status) => (
                  <button
                    key={status}
                    disabled={!canMarkActiveMode || Boolean(selectedRecord)}
                    onClick={() => markAttendance(selectedEntity, status)}
                    className="h-10 rounded-lg bg-[#33373e] text-white text-sm font-semibold disabled:bg-slate-300"
                  >
                    {status}
                  </button>
                ))}
              </div>
              {mode === 'students' && selectedRecord?.status === 'Absent' && (
                <button
                  disabled={!canNotifyParents || selectedRecord.parentNotified}
                  onClick={() => notifyParent(selectedEntity, selectedRecord)}
                  className="mt-3 w-full h-10 rounded-full bg-[#fb9a5b] text-white font-semibold text-sm disabled:bg-slate-300"
                >
                  Notify Parent
                </button>
              )}
            </div>
          ) : (
            <div className="bg-white border border-slate-100 rounded-lg p-6 shadow-sm text-sm text-slate-600 min-h-72 flex flex-col items-center justify-center text-center">
              <div className="h-14 w-14 rounded-lg bg-[#f5f5f6] text-[#fb8d49] flex items-center justify-center mb-4">{activeBranch?.icon}</div>
              <h3 className="font-bold text-slate-900 mb-2">Attendance Details</h3>
              <p>{activeEntities.length ? 'Click a row to view attendance actions for the selected person.' : 'No matching roster records found.'}</p>
            </div>
          )}
        </aside>
      </div>
      )}
      </>
      )}
    </div>
  );
}
