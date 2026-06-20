import { useEffect, useMemo, useState } from 'react';
import { Bell, CalendarDays, CheckCircle, Search, Users, XCircle } from 'lucide-react';
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
  demoAttendanceNotifications,
  demoAttendanceStaff,
  demoAttendanceStudents,
  demoStaffAttendance,
  demoStudentAttendance,
} from './demoAttendance';
import AttendanceReports from './components/AttendanceReports';
import AttendanceTable from './components/AttendanceTable';

export default function AttendanceManagement({ currentUser, academicYear = '2026-2027' }) {
  const [students, setStudents] = useState(demoAttendanceStudents);
  const [staff, setStaff] = useState(demoAttendanceStaff);
  const [studentAttendance, setStudentAttendance] = useState(demoStudentAttendance);
  const [staffAttendance, setStaffAttendance] = useState(demoStaffAttendance);
  const [notifications, setNotifications] = useState(demoAttendanceNotifications);
  const [mode, setMode] = useState('students');
  const [reportScope, setReportScope] = useState('daily');
  const [search, setSearch] = useState('');
  const [selectedDate, setSelectedDate] = useState(formatDisplayDate());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    const loadAttendance = async () => {
      try {
        const data = await getAttendanceManagementData(academicYear);
        if (data.students.length) setStudents(data.students.filter((student) => student.status !== 'Archived'));
        if (data.staff.length) setStaff(data.staff.filter((member) => member.status !== 'Archived'));
        setStudentAttendance(data.studentAttendance);
        setStaffAttendance(data.staffAttendance);
        setNotifications(data.notifications);
      } catch (error) {
        console.warn('Using demo attendance because Firestore is not reachable.', error);
        setLoadError('Unable to load Firestore attendance records. Showing demo/local records.');
      } finally {
        setLoading(false);
      }
    };
    loadAttendance();
  }, [academicYear]);

  const currentRoleId = currentUser?.roleId || 'admin';
  const canMarkStudents = canAccess(defaultRoles, currentRoleId, 'attendance.markStudents');
  const canMarkStaff = canAccess(defaultRoles, currentRoleId, 'attendance.markStaff');
  const canNotifyParents = canAccess(defaultRoles, currentRoleId, 'attendance.notifyParents');
  const canViewReports = canAccess(defaultRoles, currentRoleId, 'attendance.reports');

  const activeRecords = mode === 'students' ? studentAttendance : staffAttendance;
  const activeEntities = useMemo(() => {
    const term = search.trim().toLowerCase();
    const source = mode === 'students' ? students : staff;
    if (!term) return source;
    return source.filter((entity) =>
      [entity.name, entity.studentId, entity.employeeId, entity.className, entity.department]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(term))
    );
  }, [mode, search, staff, students]);

  const summary = summarizeAttendance(activeRecords);
  const absentToday = activeRecords.filter((record) => record.dateText === selectedDate && record.status === 'Absent').length;
  const stats = [
    { label: 'Present', value: summary.present, icon: <CheckCircle size={22} /> },
    { label: 'Absent', value: summary.absent, icon: <XCircle size={22} /> },
    { label: 'Attendance %', value: `${summary.percentage}%`, icon: <CalendarDays size={22} /> },
    { label: 'Notifications', value: notifications.length || absentToday, icon: <Bell size={22} /> },
  ];

  const markAttendance = async (entity, status) => {
    const entityId = entity.studentId || entity.employeeId;
    const key = buildAttendanceKey(entityId, selectedDate);
    const exists = activeRecords.find((record) => buildAttendanceKey(record.entityId, record.dateText) === key);
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
      const id = await createAttendanceNotification(notification);
      await updateStudentAttendanceRecord(attendanceRecord.id, attendanceUpdate);
      setNotifications((prev) => [{ id: id || `local-notification-${Date.now()}`, ...notification }, ...prev]);
      setStudentAttendance((prev) => prev.map((record) => record.id === attendanceRecord.id ? { ...record, ...attendanceUpdate } : record));
      toast.success('Parent notification queued');
    } catch {
      setNotifications((prev) => [{ id: `local-notification-${Date.now()}`, ...notification }, ...prev]);
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
          <input
            type="date"
            onChange={(event) => {
              if (!event.target.value) return;
              setSelectedDate(formatDisplayDate(new Date(`${event.target.value}T00:00:00`)));
            }}
            className="h-10 rounded-lg border border-slate-200 px-3 text-sm"
          />
        </div>
      </div>

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
          <div className="flex flex-wrap items-center gap-2 mb-5">
            {[
              ['students', 'Students'],
              ['staff', 'Faculty / Staff'],
            ].map(([value, label]) => (
              <button
                key={value}
                onClick={() => setMode(value)}
                className={`h-10 px-4 rounded-md border text-sm flex items-center gap-2 ${mode === value ? 'bg-[#33373e] text-white border-[#33373e]' : 'bg-white text-slate-600 border-slate-200'}`}
              >
                <Users size={15} /> {label}
              </button>
            ))}
            {['daily', 'monthly', 'yearly'].map((scope) => (
              <button
                key={scope}
                onClick={() => setReportScope(scope)}
                className={`h-10 px-4 rounded-md border text-sm capitalize ${reportScope === scope ? 'bg-[#fb9a5b] text-white border-[#fb9a5b]' : 'bg-white text-slate-600 border-slate-200'}`}
              >
                {scope}
              </button>
            ))}
          </div>

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
          />
        </div>

        {canViewReports ? (
          <AttendanceReports records={activeRecords} scope={reportScope} />
        ) : (
          <aside className="xl:w-[32%]">
            <div className="bg-white border border-slate-100 rounded-lg p-5 shadow-sm text-sm text-slate-500">
              You do not have permission to view attendance reports.
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
