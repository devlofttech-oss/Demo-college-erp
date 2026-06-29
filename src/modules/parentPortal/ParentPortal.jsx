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
  demoAcademicSubjects,
} from '../academics/demoAcademics';
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
import { filterStudentsByCourse } from '../shared/courseFilters';

export default function ParentPortal({ currentUser, academicYear = '2026-2027', selectedCourse = null, selectedCourseCode = 'all' }) {
  const [students, setStudents] = useState(isFirebaseConfigured ? [] : demoParentStudents);
  const [attendance, setAttendance] = useState(isFirebaseConfigured ? [] : demoParentAttendance);
  const [marks, setMarks] = useState(isFirebaseConfigured ? [] : demoParentMarks);
  const [results, setResults] = useState(isFirebaseConfigured ? [] : demoParentResults);
  const [fees, setFees] = useState(isFirebaseConfigured ? [] : demoParentFees);
  const [notices, setNotices] = useState(isFirebaseConfigured ? [] : demoParentNotices);
  const [documents, setDocuments] = useState(isFirebaseConfigured ? [] : demoParentDocuments);
  const [academicSubjects, setAcademicSubjects] = useState(isFirebaseConfigured ? [] : demoAcademicSubjects);
  const [selectedId, setSelectedId] = useState(isFirebaseConfigured ? '' : demoParentStudents[0]?.id || '');
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    const loadPortal = async () => {
      if (!isFirebaseConfigured) return;
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
        setAcademicSubjects(data.academicSubjects || []);
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
  const canViewAllStudents = canAccess(defaultRoles, currentRoleId, 'parentPortal.viewAll');
  const courseStudents = useMemo(() => filterStudentsByCourse(students, selectedCourseCode, selectedCourse), [selectedCourse, selectedCourseCode, students]);
  const visibleStudents = useMemo(() => getParentLinkedStudents(courseStudents, currentUser), [courseStudents, currentUser]);
  const selectedStudent = visibleStudents.find((student) => student.id === selectedId) || visibleStudents[0];

  const studentAttendance = useMemo(() => buildParentAttendance(recordsForStudent(attendance, selectedStudent), selectedStudent, academicSubjects), [academicSubjects, attendance, selectedStudent]);
  const performance = useMemo(() => buildAcademicPerformance(recordsForStudent(marks, selectedStudent), recordsForStudent(results, selectedStudent)), [marks, results, selectedStudent]);
  const feeStatus = useMemo(() => buildFeeStatus(recordsForStudent(fees, selectedStudent)), [fees, selectedStudent]);
  const parentNotices = useMemo(() => visibleParentNotices(notices), [notices]);
  const studentDocuments = useMemo(() => visibleStudentDocuments(documents, selectedStudent), [documents, selectedStudent]);

  const overviewItems = [
    { label: 'Attendance', value: `${studentAttendance.percentage}%`, icon: <UserRound size={18} /> },
    { label: 'Performance', value: `${performance.average}%`, icon: <GraduationCap size={18} /> },
    { label: 'Fee Due', value: feeStatus.totalDue, icon: <Wallet size={18} /> },
    { label: 'Notices', value: parentNotices.length, icon: <Bell size={18} /> },
    { label: 'Documents', value: studentDocuments.length, icon: <FileText size={18} /> },
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
      <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-5 pb-6 border-b border-slate-100">
        <div className="max-w-2xl">
          <div className="text-sm font-bold text-slate-500 mb-2">Parent Portal / <span className="text-[#f39a5f]">Student Overview</span></div>
          <h1 className="text-2xl font-bold text-slate-900">Parent Portal</h1>
          <p className="text-sm text-slate-500 mt-1">A focused view of attendance, academics, fees, notices, and verified documents.</p>
          {!isFirebaseConfigured && <p className="text-xs text-orange-600 mt-2">Demo mode: add Firebase keys to persist and load parent portal records.</p>}
          {loadError && <p className="text-xs text-rose-600 mt-2">{loadError}</p>}
        </div>
        {canViewAllStudents && (
          <StudentSwitcher students={visibleStudents} selectedId={selectedStudent?.id} onSelect={setSelectedId} />
        )}
      </div>

      {selectedStudent ? (
        <>
          <section className="my-5 rounded-lg border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-5">
              <div className="min-w-0 flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-[#30343c] text-emerald-300 flex items-center justify-center overflow-hidden shrink-0">
                  {selectedStudent.profilePhotoUrl ? (
                    <img src={selectedStudent.profilePhotoUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <UserRound size={30} />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold uppercase text-slate-500">Selected Student</div>
                  <h2 className="mt-1 text-2xl font-extrabold text-slate-900">{selectedStudent.name}</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {[selectedStudent.studentId, selectedStudent.className, selectedStudent.section].filter(Boolean).join(' | ')}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 xl:min-w-[680px]">
                {overviewItems.map(({ label, value, icon }) => (
                  <div key={label} className="rounded-lg bg-[#f5f5f6] px-4 py-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                      <span className="text-[#34363d]">{icon}</span>
                      {label}
                    </div>
                    <div className="mt-2 text-xl font-bold text-slate-900">{loading ? '...' : value}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <div className="grid xl:grid-cols-[1.35fr_0.9fr] gap-5">
            <div className="space-y-5">
              <PerformanceCard performance={performance} />
              <AttendanceCard attendance={studentAttendance} />
            </div>
            <div className="space-y-5">
              <FeeStatusCard feeStatus={feeStatus} />
              <ParentNoticePanel notices={parentNotices} />
              <ParentDocumentsPanel documents={studentDocuments} />
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-lg bg-[#f5f5f6] p-6 text-sm text-slate-600 mt-5">
          {canViewAllStudents
            ? 'No student records were found for parent portal review.'
            : 'No linked student record was found for this parent account.'}
        </div>
      )}
    </div>
  );
}
