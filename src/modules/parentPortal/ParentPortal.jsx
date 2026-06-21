import { useEffect, useMemo, useState } from 'react';
import { Bell, FileText, GraduationCap, UserRound, Wallet } from 'lucide-react';
import {
  getParentPortalData,
} from '../../firebase/db';
import { isFirebaseConfigured } from '../../firebase/config';
import { canAccess, defaultRoles } from '../userRoles/rolePermissions';
import {
  buildAcademicPerformance,
  buildFeeStatus,
  buildParentAttendance,
  getParentLinkedStudents,
  recordsForStudent,
  visibleParentNotices,
  visibleStudentDocuments,
} from './parentPortalUtils';
import {
  demoParentAttendance,
  demoParentDocuments,
  demoParentFees,
  demoParentMarks,
  demoParentNotices,
  demoParentResults,
  demoParentStudents,
} from './demoParentPortal';
import AttendanceCard from './components/AttendanceCard';
import FeeStatusCard from './components/FeeStatusCard';
import ParentDocumentsPanel from './components/ParentDocumentsPanel';
import ParentNoticePanel from './components/ParentNoticePanel';
import PerformanceCard from './components/PerformanceCard';
import StudentSwitcher from './components/StudentSwitcher';

export default function ParentPortal({ currentUser, academicYear = '2026-2027' }) {
  const [students, setStudents] = useState(demoParentStudents);
  const [attendance, setAttendance] = useState(demoParentAttendance);
  const [marks, setMarks] = useState(demoParentMarks);
  const [results, setResults] = useState(demoParentResults);
  const [fees, setFees] = useState(demoParentFees);
  const [notices, setNotices] = useState(demoParentNotices);
  const [documents, setDocuments] = useState(demoParentDocuments);
  const [selectedId, setSelectedId] = useState(demoParentStudents[0]?.id || '');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    const loadPortal = async () => {
      try {
        const data = await getParentPortalData(academicYear, currentUser);
        if (data.students.length) {
          const linked = getParentLinkedStudents(data.students, currentUser);
          setStudents(linked);
          setSelectedId(linked[0]?.id || '');
        }
        setAttendance(data.studentAttendance);
        setMarks(data.marksEntries);
        setResults(data.studentResults);
        setFees(data.feeAssignments);
        setNotices(data.noticeItems);
        setDocuments(data.managedDocuments);
      } catch (error) {
        console.warn('Using demo parent portal data because Firestore is not reachable.', error);
        setLoadError('Unable to load Firestore parent portal records. Showing demo/local records.');
      } finally {
        setLoading(false);
      }
    };
    loadPortal();
  }, [academicYear, currentUser]);

  const currentRoleId = currentUser?.roleId || 'admin';
  const canView = canAccess(defaultRoles, currentRoleId, 'parentPortal.view');
  const selectedStudent = students.find((student) => student.id === selectedId) || students[0];

  const studentAttendance = useMemo(() => buildParentAttendance(recordsForStudent(attendance, selectedStudent)), [attendance, selectedStudent]);
  const performance = useMemo(() => buildAcademicPerformance(recordsForStudent(marks, selectedStudent), recordsForStudent(results, selectedStudent)), [marks, results, selectedStudent]);
  const feeStatus = useMemo(() => buildFeeStatus(recordsForStudent(fees, selectedStudent)), [fees, selectedStudent]);
  const parentNotices = useMemo(() => visibleParentNotices(notices), [notices]);
  const studentDocuments = useMemo(() => visibleStudentDocuments(documents, selectedStudent), [documents, selectedStudent]);

  const stats = [
    { label: 'Attendance', value: `${studentAttendance.percentage}%`, icon: <UserRound size={22} /> },
    { label: 'Performance', value: `${performance.average}%`, icon: <GraduationCap size={22} /> },
    { label: 'Fee Due', value: feeStatus.totalDue, icon: <Wallet size={22} /> },
    { label: 'Notices', value: parentNotices.length, icon: <Bell size={22} /> },
  ];

  if (!canView) {
    return (
      <div className="rounded-lg bg-[#f5f5f6] p-6 text-sm text-slate-600">
        You do not have permission to view the parent portal.
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <div className="text-sm font-bold text-slate-500 mb-2">Parent Portal / <span className="text-[#f39a5f]">Student Overview</span></div>
          <h1 className="text-2xl font-bold text-slate-900">Parent Portal</h1>
          <p className="text-sm text-slate-500 mt-1">Attendance monitoring, academic performance tracking, fee status, notices, and verified documents.</p>
          {!isFirebaseConfigured && <p className="text-xs text-orange-600 mt-2">Demo mode: add Firebase keys to persist and load parent portal records.</p>}
          {loadError && <p className="text-xs text-rose-600 mt-2">{loadError}</p>}
        </div>
        <StudentSwitcher students={students} selectedId={selectedStudent?.id} onSelect={setSelectedId} />
      </div>

      {selectedStudent ? (
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

          <div className="grid xl:grid-cols-2 gap-5">
            <AttendanceCard attendance={studentAttendance} />
            <PerformanceCard performance={performance} />
            <FeeStatusCard feeStatus={feeStatus} />
            <ParentNoticePanel notices={parentNotices} />
            <div className="xl:col-span-2">
              <ParentDocumentsPanel documents={studentDocuments} />
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-lg bg-[#f5f5f6] p-6 text-sm text-slate-600 mt-5">
          No linked student records were found for this parent account.
        </div>
      )}
    </div>
  );
}
