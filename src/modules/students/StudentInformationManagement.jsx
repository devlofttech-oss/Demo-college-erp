import { Component, Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Bell,
  BookOpen,
  Download,
  FileText,
  HeartPulse,
  Plus,
  Search,
  UserRound,
  Users,
  Wallet,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  createStudent,
  createStudentAdmission,
  createStudentDocument,
  createStudentHealthRecord,
  deleteStudentHealthRecord,
  getInstituteShellData,
  getSettingsData,
  getStudentInformationData,
  archiveStudent,
  restoreStudent,
  updateStudent,
  updateStudentAdmission,
  updateStudentHealthRecord,
} from '../../firebase/db';
import { isFirebaseConfigured } from '../../firebase/config';
import { getEnabledModules, getModuleById, getModuleByPath } from '../moduleRegistry';
import Sidebar from './components/Sidebar';
import StatusBadge from './components/StatusBadge';
import StudentModal from './components/StudentModal';
import StudentHealthRecordTab from './components/StudentHealthRecordTab';
import StudentProfileCard from './components/StudentProfileCard';
import StudentTable from './components/StudentTable';
import TopHeader from './components/TopHeader';
import {
  ACTIVE_STUDENT_STATUS,
  APPROVED_ADMISSION_STATUS,
  PENDING_ADMISSION_STATUS,
  buildCourseOptionsFromStudents,
  canApproveStudentAdmission,
  formatDisplayDate,
  latestRecord,
  normalizeCreatedAdmissionStatus,
  normalizeEditableStudentStatus,
  relationMatches,
  statusRequiresSuperAdminApproval,
  validateStudentProfile,
} from './studentUtils';
import { isHealthRecordManager } from './studentHealthRecordModel';
import { canAccess, defaultRoles } from '../userRoles/rolePermissions';
import { normalizeInstituteSettings } from '../settings/settingsModel';
import { filterStudentScopedRecords, filterStudentsByCourse } from '../shared/courseFilters';
import { getParentLinkedStudents } from '../parentPortal/parentPortalUtils';
import { calculateAssignmentPaymentLedger, formatCurrency, formatManualDueItems, formatPaymentDate, sortPaymentRecordsByDate, totalFeeComponents } from '../fees/feeUtils';

const AcademicsManagement = lazy(() => import('../academics/AcademicsManagement'));
const AttendanceManagement = lazy(() => import('../attendance/AttendanceManagement'));
const CurriculumManagement = lazy(() => import('../curriculum/CurriculumManagement'));
const DashboardManagement = lazy(() => import('../dashboard/DashboardManagement'));
const DocumentManagement = lazy(() => import('../documents/DocumentManagement'));
const ExaminationResultManagement = lazy(() => import('../exams/ExaminationResultManagement'));
const FacultyStaffManagement = lazy(() => import('../facultyStaff/FacultyStaffManagement'));
const FeesManagement = lazy(() => import('../fees/FeesManagement'));
const HostelManagement = lazy(() => import('../hostel/HostelManagement'));
const NoticeBoardManagement = lazy(() => import('../notices/NoticeBoardManagement'));
const ParentPortal = lazy(() => import('../parentPortal/ParentPortal'));
const ReportsManagement = lazy(() => import('../reports/ReportsManagement'));
const SettingsManagement = lazy(() => import('../settings/SettingsManagement'));
const TimetableManagement = lazy(() => import('../timetable/TimetableManagement'));
const UserRoleManagement = lazy(() => import('../userRoles/UserRoleManagement'));

const DEFAULT_ACADEMIC_YEAR = '2025-2026';
const NEXT_ACADEMIC_YEAR = '2026-2027';

function csvValue(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

class ModuleErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, resetKey: props.resetKey };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  static getDerivedStateFromProps(props, state) {
    if (props.resetKey !== state.resetKey) {
      return { error: null, resetKey: props.resetKey };
    }
    return null;
  }

  componentDidCatch(error) {
    console.error('Module render failed', error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-lg bg-rose-50 border border-rose-100 p-6 text-sm text-rose-700">
          <h2 className="font-bold text-rose-900 mb-2">This module could not be opened.</h2>
          <p>Please refresh the page. If it keeps happening, share the browser console error with support.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

function ModuleLoadingState() {
  return (
    <div className="rounded-lg border border-slate-100 bg-white p-6 text-sm font-semibold text-slate-500">
      Loading module...
    </div>
  );
}

function getPageFromPath(pathname) {
  return getModuleByPath(pathname)?.id || 'dashboard';
}

function StudentReportView({ academicYear, admissions, documents, promotions, students, onBack }) {
  const activeStudents = students.filter((student) => student.status !== 'Archived');
  const archivedStudents = students.filter((student) => student.status === 'Archived');
  const verifiedDocuments = documents.filter((item) => item.verificationStatus === 'Verified');
  const classBreakdown = Object.entries(students.reduce((summary, student) => {
    const classKey = `${student.className || 'Unassigned'} - ${student.section || '-'}`;
    summary[classKey] = (summary[classKey] || 0) + 1;
    return summary;
  }, {}));

  const downloadReport = () => {
    const rows = [
      ['Student Name', 'Student ID', 'Admission No', 'Class', 'Program', 'Guardian', 'ID Holder', 'Status', 'Created On'],
      ...students.map((student) => [
        student.name,
        student.studentId,
        student.admissionNo,
        `${student.className || ''} ${student.section || ''}`.trim(),
        student.program,
        student.guardianName,
        student.idHolder,
        student.status,
        student.createdAtText,
      ]),
    ];
    const csv = rows.map((row) => row.map(csvValue).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `student-report-${academicYear}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Student report downloaded');
  };

  return (
    <div>
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="erp-back-button h-10 px-4 rounded-lg bg-white border border-slate-200 text-slate-700 font-semibold text-sm flex items-center gap-2">
            <ArrowLeft size={15} /> Back
          </button>
          <div>
            <div className="text-sm font-bold text-slate-500 mb-2">Academics / <span className="text-[#f39a5f]">Student Report</span></div>
            <h1 className="text-2xl font-bold text-slate-900">Student Report</h1>
            <p className="text-sm text-slate-500 mt-1">Academic year {academicYear}: admissions, profiles, documents, and promotions.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={downloadReport} className="h-10 px-5 rounded-lg bg-[#33373e] text-white font-semibold text-sm flex items-center gap-2">
            <Download size={16} /> Download CSV
          </button>
          <button onClick={() => window.print()} className="h-10 px-5 rounded-lg bg-white border border-slate-200 text-slate-700 font-semibold text-sm">
            Print
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-4 py-5">
        {[
          ['Students', students.length],
          ['Active', activeStudents.length],
          ['Archived', archivedStudents.length],
          ['Admissions', admissions.length],
          ['Documents', documents.length],
          ['Verified Docs', verifiedDocuments.length],
          ['Promotions', promotions.length],
          ['Classes', classBreakdown.length],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg bg-[#f5f5f6] p-4">
            <div className="text-xs font-semibold text-slate-500">{label}</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{value}</div>
          </div>
        ))}
      </div>

      <div className="grid xl:grid-cols-[1fr_2fr] gap-5">
        <div className="rounded-lg border border-slate-100 bg-white p-5 shadow-sm">
          <h2 className="font-bold text-slate-900 mb-4">Class Summary</h2>
          <div className="space-y-2 text-sm">
            {classBreakdown.map(([classKey, count]) => (
              <div key={classKey} className="flex items-center justify-between rounded-lg bg-[#f5f5f6] px-3 py-2">
                <span>{classKey}</span>
                <span className="font-bold">{count}</span>
              </div>
            ))}
            {!classBreakdown.length && <div className="text-slate-500">No student records for this academic year.</div>}
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-100 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-[#e7e7e9] text-left text-slate-900">
              <tr>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Admission / ID</th>
                <th className="px-4 py-3">Class</th>
                <th className="px-4 py-3">ID Holder</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-semibold">{student.name}<div className="text-xs font-normal text-slate-500">{student.guardianName}</div></td>
                  <td className="px-4 py-3">{student.admissionNo}<div className="text-xs text-slate-500">{student.studentId}</div></td>
                  <td className="px-4 py-3">{student.className} - {student.section}<div className="text-xs text-slate-500">{student.program}</div></td>
                  <td className="px-4 py-3">{student.idHolder || '-'}</td>
                  <td className="px-4 py-3"><StatusBadge value={student.status} /></td>
                </tr>
              ))}
              {!students.length && (
                <tr><td colSpan="5" className="px-4 py-10 text-center text-slate-500">No student records found for {academicYear}.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function StudentInformationManagement({ user, onLogout }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [themeMode, setThemeMode] = useState(() => localStorage.getItem('erpThemeMode') || 'dark');
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [selectedCourseCode, setSelectedCourseCode] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [admissions, setAdmissions] = useState([]);
  const [studentDocuments, setStudentDocuments] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [marksEntries, setMarksEntries] = useState([]);
  const [studentResults, setStudentResults] = useState([]);
  const [feeAssignments, setFeeAssignments] = useState([]);
  const [feeCollections, setFeeCollections] = useState([]);
  const [studentHealthRecords, setStudentHealthRecords] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [focusedStudentContext, setFocusedStudentContext] = useState(null);
  const [statusFilter, setStatusFilter] = useState('active');
  const [academicYear, setAcademicYear] = useState(DEFAULT_ACADEMIC_YEAR);
  const [institute, setInstitute] = useState({});
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const currentRoleId = user?.roleId || 'admin';
  const activePage = getPageFromPath(location.pathname);
  const activeModule = getModuleById(activePage);
  const canCreateAdmission = canAccess(defaultRoles, currentRoleId, 'students.create');
  const canEditStudents = canAccess(defaultRoles, currentRoleId, 'students.edit');
  const canArchiveStudents = canAccess(defaultRoles, currentRoleId, 'students.archive');
  const canViewReportsModule = canAccess(defaultRoles, currentRoleId, 'reports.view');
  const accessibleModules = useMemo(() => getEnabledModules()
    .filter((module) => !module.permission || canAccess(defaultRoles, currentRoleId, module.permission)), [currentRoleId]);
  const canOpenActiveModule = activePage === 'reports'
    ? canViewReportsModule
    : !activeModule?.permission || canAccess(defaultRoles, currentRoleId, activeModule.permission);
  const activeSubmenuId = activePage === 'reports'
    ? location.state?.reportCategory || ''
    : activePage === 'attendance'
      ? location.state?.attendanceSubmenu || ''
      : '';
  const navigateToModule = useCallback((moduleId, options = {}) => {
    const nextModule = getModuleById(moduleId);
    setFocusedStudentContext(options.state?.studentContext || null);
    setSelectedId('');
    setSearch('');
    navigate(nextModule?.path || '/dashboard', options);
  }, [navigate]);

  useEffect(() => {
    localStorage.setItem('erpThemeMode', themeMode);
  }, [themeMode]);

  useEffect(() => {
    const currentState = window.history.state || {};
    const currentPage = getPageFromPath(location.pathname);
    window.history.replaceState({
      ...currentState,
      studentFlow: currentState.studentFlow?.page === currentPage
        ? currentState.studentFlow
        : { page: currentPage, task: '', branch: '' },
    }, '');

    const handleHistoryBack = (event) => {
      setShowModal(false);
      setEditingStudent(null);
      const flow = event.state?.studentFlow;
      if (!flow) {
        setSelectedId('');
        return;
      }
      setSelectedId(flow.selectedId || '');
      if (flow.statusFilter) setStatusFilter(flow.statusFilter);
    };

    window.addEventListener('popstate', handleHistoryBack);
    return () => window.removeEventListener('popstate', handleHistoryBack);
  }, [location.pathname]);

  useEffect(() => {
    const isActivePageAllowed = activePage === 'reports'
      ? canViewReportsModule
      : accessibleModules.some((module) => module.id === activePage);
    if (!isActivePageAllowed) {
      const nextPage = currentRoleId === 'parent' && accessibleModules.some((module) => module.id === 'parent-portal')
        ? 'parent-portal'
        : accessibleModules[0]?.id || 'dashboard';
      queueMicrotask(() => navigateToModule(nextPage, { replace: true }));
    }
  }, [accessibleModules, activePage, canViewReportsModule, currentRoleId, navigateToModule]);

  useEffect(() => {
    const loadShellSettings = async () => {
      if (!isFirebaseConfigured) return;
      try {
        const [instituteData, settingsData] = await Promise.all([
          getInstituteShellData().catch(() => null),
          getSettingsData().catch(() => null),
        ]);
        if (instituteData) setInstitute(normalizeInstituteSettings(instituteData));
        if (settingsData?.academicYear?.name) {
          setAcademicYear((prev) => prev || settingsData.academicYear.name);
        }
      } catch (error) {
        console.error('Unable to load live institute settings.', error);
      }
    };
    loadShellSettings();
  }, []);

  useEffect(() => {
    const updateInstituteFromSettings = (event) => {
      if (event.detail) setInstitute(normalizeInstituteSettings(event.detail));
    };
    window.addEventListener('institute-settings-updated', updateInstituteFromSettings);
    return () => window.removeEventListener('institute-settings-updated', updateInstituteFromSettings);
  }, []);

  useEffect(() => {
    const loadStudentInformation = async () => {
      if (!isFirebaseConfigured) {
        setLoadError('Live Firebase data is not configured.');
        return;
      }
      try {
        const data = await getStudentInformationData(academicYear);
        const nextStudents = data.students || [];
        const nextAdmissions = data.admissions || [];
        const nextDocuments = data.documents || [];
        const nextPromotions = data.promotions || [];
        const nextTransfers = data.transfers || [];
        const nextAttendanceRecords = data.attendanceRecords || [];
        const nextMarksEntries = data.marksEntries || [];
        const nextStudentResults = data.studentResults || [];
        const nextFeeAssignments = data.feeAssignments || [];
        const nextFeeCollections = data.feeCollections || [];
        const nextStudentHealthRecords = data.studentHealthRecords || [];
        setStudents(nextStudents);
        setSelectedId('');
        setAdmissions(nextAdmissions);
        setStudentDocuments(nextDocuments);
        setPromotions(nextPromotions);
        setTransfers(nextTransfers);
        setAttendanceRecords(nextAttendanceRecords);
        setMarksEntries(nextMarksEntries);
        setStudentResults(nextStudentResults);
        setFeeAssignments(nextFeeAssignments);
        setFeeCollections(nextFeeCollections);
        setStudentHealthRecords(nextStudentHealthRecords);
        setCourses(buildCourseOptionsFromStudents(nextStudents, data.admissionBatches || []));
        if (!academicYear) {
          const liveYears = [
            ...nextStudents,
            ...nextAdmissions,
            ...nextDocuments,
            ...nextPromotions,
            ...nextTransfers,
            ...nextAttendanceRecords,
            ...nextMarksEntries,
            ...nextStudentResults,
            ...nextFeeAssignments,
            ...nextFeeCollections,
            ...nextStudentHealthRecords,
          ]
            .map((record) => record?.academicYear)
            .filter(Boolean)
            .sort()
            .reverse();
          if (liveYears.length) setAcademicYear(liveYears[0]);
        }
        setLoadError('');
      } catch (error) {
        console.error('Unable to load live student records.', error);
        setLoadError('Unable to load live student records.');
      }
    };
    loadStudentInformation();
  }, [academicYear]);

  const academicYearOptions = useMemo(() => [DEFAULT_ACADEMIC_YEAR, NEXT_ACADEMIC_YEAR], []);

  const recordBelongsToYear = (record) => !academicYear || record.academicYear === academicYear;
  const yearStudents = useMemo(() => (
    academicYear ? students.filter((student) => student.academicYear === academicYear) : students
  ), [academicYear, students]);
  const parentLinkedStudents = useMemo(
    () => currentRoleId === 'parent' ? getParentLinkedStudents(yearStudents, user) : [],
    [currentRoleId, user, yearStudents]
  );
  const parentCourseOptions = useMemo(
    () => buildCourseOptionsFromStudents(parentLinkedStudents, []),
    [parentLinkedStudents]
  );
  const headerCourses = currentRoleId === 'parent' ? parentCourseOptions : courses;
  const roleScopedYearStudents = currentRoleId === 'parent' ? parentLinkedStudents : yearStudents;
  const selectedIsLinkedParentCourse = parentCourseOptions.some((course) => course.courseCode === selectedCourseCode);
  const effectiveSelectedCourseCode = currentRoleId === 'parent' && parentCourseOptions.length && (selectedCourseCode === 'all' || !selectedIsLinkedParentCourse)
    ? parentCourseOptions[0].courseCode
    : selectedCourseCode;
  const selectedCourse = useMemo(
    () => [...courses, ...parentCourseOptions].find((course) => course.courseCode === effectiveSelectedCourseCode) || null,
    [courses, effectiveSelectedCourseCode, parentCourseOptions]
  );
  const courseStudents = useMemo(
    () => filterStudentsByCourse(roleScopedYearStudents, effectiveSelectedCourseCode, selectedCourse),
    [roleScopedYearStudents, effectiveSelectedCourseCode, selectedCourse]
  );
  const focusedStudent = focusedStudentContext
    ? courseStudents.find((student) => relationMatches(focusedStudentContext, student)) || null
    : null;
  const moduleScopedStudents = focusedStudent ? [focusedStudent] : courseStudents;
  const courseScopedAdmissions = useMemo(
    () => filterStudentScopedRecords(admissions.filter((item) => !academicYear || item.academicYear === academicYear), courseStudents, effectiveSelectedCourseCode, selectedCourse),
    [academicYear, admissions, courseStudents, effectiveSelectedCourseCode, selectedCourse]
  );
  const courseScopedDocuments = useMemo(
    () => filterStudentScopedRecords(studentDocuments.filter((item) => !academicYear || item.academicYear === academicYear), courseStudents, effectiveSelectedCourseCode, selectedCourse),
    [academicYear, courseStudents, effectiveSelectedCourseCode, selectedCourse, studentDocuments]
  );
  const courseScopedPromotions = useMemo(
    () => filterStudentScopedRecords(promotions.filter((item) => !academicYear || item.academicYear === academicYear), courseStudents, effectiveSelectedCourseCode, selectedCourse),
    [academicYear, courseStudents, effectiveSelectedCourseCode, promotions, selectedCourse]
  );
  const courseScopedAttendanceRecords = useMemo(
    () => filterStudentScopedRecords(attendanceRecords.filter((item) => !academicYear || item.academicYear === academicYear), courseStudents, effectiveSelectedCourseCode, selectedCourse),
    [academicYear, attendanceRecords, courseStudents, effectiveSelectedCourseCode, selectedCourse]
  );
  const courseScopedMarksEntries = useMemo(
    () => filterStudentScopedRecords(marksEntries.filter((item) => !academicYear || item.academicYear === academicYear), courseStudents, effectiveSelectedCourseCode, selectedCourse),
    [academicYear, courseStudents, effectiveSelectedCourseCode, marksEntries, selectedCourse]
  );
  const courseScopedStudentResults = useMemo(
    () => filterStudentScopedRecords(studentResults.filter((item) => !academicYear || item.academicYear === academicYear), courseStudents, effectiveSelectedCourseCode, selectedCourse),
    [academicYear, courseStudents, effectiveSelectedCourseCode, selectedCourse, studentResults]
  );

  const selectedStudent = selectedId ? courseStudents.find((student) => student.id === selectedId) || null : null;
  const selectedAdmissions = admissions.filter((record) => relationMatches(record, selectedStudent) && recordBelongsToYear(record));
  const selectedDocuments = studentDocuments.filter((record) => relationMatches(record, selectedStudent) && recordBelongsToYear(record));
  const selectedPromotions = promotions.filter((record) => relationMatches(record, selectedStudent) && recordBelongsToYear(record));
  const selectedTransfers = transfers.filter((record) => relationMatches(record, selectedStudent) && recordBelongsToYear(record));
  const selectedAttendanceRecords = attendanceRecords.filter((record) => relationMatches(record, selectedStudent) && recordBelongsToYear(record));
  const selectedMarksEntries = marksEntries.filter((record) => relationMatches(record, selectedStudent) && recordBelongsToYear(record));
  const selectedResults = studentResults.filter((record) => relationMatches(record, selectedStudent) && recordBelongsToYear(record));
  const selectedFeeAssignments = feeAssignments.filter((record) => relationMatches(record, selectedStudent) && recordBelongsToYear(record));
  const selectedFeeCollections = feeCollections.filter((record) => relationMatches(record, selectedStudent) && recordBelongsToYear(record));
  const selectedHealthRecords = studentHealthRecords.filter((record) => relationMatches(record, selectedStudent) && recordBelongsToYear(record));
  const latestAdmission = latestRecord(selectedAdmissions);
  const selectedHealthRecord = latestRecord(selectedHealthRecords);

  const filteredStudents = useMemo(() => {
    const term = search.trim().toLowerCase();
    const visibleStudents = statusFilter === 'archived'
      ? courseStudents.filter((student) => student.status === 'Archived')
      : courseStudents.filter((student) => student.status !== 'Archived');
    if (!term) return visibleStudents;
    return visibleStudents.filter((student) =>
      [student.name, student.studentId, student.admissionNo, student.className, student.program, student.courseName, student.sourcePdf]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(term))
    );
  }, [courseStudents, search, statusFilter]);

  const selectStudent = (studentId) => {
    setSelectedId(studentId);
    window.history.replaceState({
      ...(window.history.state || {}),
      studentFlow: { page: activePage, selectedId: '', statusFilter },
    }, '');
    window.history.pushState({
      ...(window.history.state || {}),
      studentFlow: { page: activePage, selectedId: studentId, statusFilter },
    }, '');
  };

  const goBackOneStudentStep = () => {
    if (window.history.state?.studentFlow?.selectedId || window.history.state?.studentFlow?.page === 'reports') {
      window.history.back();
      return;
    }
    setSelectedId('');
    navigateToModule('students');
  };

  const openOwnerDocuments = useCallback((owner) => {
    navigateToModule('document-management', {
      state: { documentOwner: owner },
    });
  }, [navigateToModule]);

  const buildStudentContext = useCallback((student) => ({
    id: student.id,
    studentRecordId: student.id,
    studentId: student.studentId,
    name: student.name,
    courseCode: student.courseCode,
    courseName: student.courseName || student.program,
  }), []);

  const openStudentModule = useCallback((moduleId, student, extraState = {}) => {
    const studentContext = buildStudentContext(student);
    if (student.courseCode && student.courseCode !== selectedCourseCode) {
      setSelectedCourseCode(student.courseCode);
    }
    navigateToModule(moduleId, {
      state: {
        ...extraState,
        studentContext,
      },
    });
  }, [buildStudentContext, navigateToModule, selectedCourseCode]);

  const openStudentDocuments = useCallback((student) => {
    const studentContext = buildStudentContext(student);
    openStudentModule('document-management', student, {
      documentOwner: {
        ownerId: student.studentId,
        ownerName: student.name,
        ownerRecordId: student.id,
        ownerType: 'Student',
        studentContext,
      },
    });
  }, [buildStudentContext, openStudentModule]);

  const saveStudent = async (form) => {
    if (!canCreateAdmission) {
      toast.error('You do not have permission to create new admissions.');
      return;
    }

    const validationMessage = validateStudentProfile(form);
    if (validationMessage) {
      toast.error(validationMessage);
      return;
    }
    if (!isFirebaseConfigured) {
      toast.error('Live Firebase data is not configured.');
      return;
    }

    const nextNumber = String(students.length + 1).padStart(5, '0');
    const selectedAcademicYear = form.academicYear;
    if (!selectedAcademicYear) {
      toast.error('Academic year is required.');
      return;
    }
    const createdAtText = formatDisplayDate();
    const pendingStatus = normalizeCreatedAdmissionStatus();
    const yearToken = selectedAcademicYear.replace(/\D/g, '') || String(new Date().getFullYear());
    const payload = {
      ...form,
      admissionNo: `ADM-${yearToken}-${nextNumber}`,
      studentId: `STU-${nextNumber}`,
      institute: institute.name || user?.selectedCollege?.name || '',
      academicYear: selectedAcademicYear,
      status: pendingStatus,
      admissionApprovalStatus: pendingStatus,
      createdAtText,
    };

    try {
      const id = await createStudent(payload);
      if (!id) throw new Error('Missing student id.');
      const created = { id, ...payload };
      const admission = {
        studentRecordId: created.id,
        studentId: created.studentId,
        admissionNo: created.admissionNo,
        academicYear: selectedAcademicYear,
        idHolder: created.idHolder,
        courseCode: created.courseCode,
        courseName: created.courseName,
        courseYear: created.courseYear,
        admissionType: created.admissionType,
        collegeName: created.collegeName,
        collegeCode: created.collegeCode,
        admissionDate: created.admissionDate,
        seatType: created.seatType,
        actualCategory: created.actualCategory,
        status: pendingStatus,
        submittedAtText: createdAtText,
      };
      const admissionForm = {
        studentRecordId: created.id,
        studentId: created.studentId,
        documentType: 'Admission Form',
        academicYear: selectedAcademicYear,
        uploadedBy: user?.name || 'Admin',
        fileName: `${created.admissionNo}-admission-form.pdf`,
        verificationStatus: 'Pending Review',
        uploadedAtText: createdAtText,
      };
      const [admissionId, documentId] = await Promise.all([
        createStudentAdmission(admission),
        createStudentDocument(admissionForm),
      ]);
      if (!admissionId || !documentId) throw new Error('Missing admission support record id.');

      setStudents((prev) => [created, ...prev]);
      setAdmissions((prev) => [{ id: admissionId, ...admission }, ...prev]);
      setStudentDocuments((prev) => [{ id: documentId, ...admissionForm }, ...prev]);
      setAcademicYear(selectedAcademicYear);
      setSelectedId(created.id);
      toast.success('Student admission sent for Super Admin approval');
      setShowModal(false);
    } catch (error) {
      console.error('Unable to save live student admission.', error);
      toast.error('Student admission was not saved to live data.');
    }
  };

  const saveStudentProfile = async (form) => {
    if (!editingStudent) return;
    if (!canEditStudents) {
      toast.error('You do not have permission to edit student profiles.');
      return;
    }
    const validationMessage = validateStudentProfile(form);
    if (validationMessage) {
      toast.error(validationMessage);
      return;
    }
    if (!isFirebaseConfigured) {
      toast.error('Live Firebase data is not configured.');
      return;
    }

    const statusChanged = form.status !== editingStudent.status;
    const normalizedStatus = normalizeEditableStudentStatus(form.status, currentRoleId);
    if (statusChanged && normalizedStatus !== form.status) {
      toast.error('Only Super Admin can approve or admit a student.');
      return;
    }

    const updates = {
      ...form,
      status: statusChanged ? normalizedStatus : form.status,
      updatedAtText: formatDisplayDate(),
    };

    try {
      await updateStudent(editingStudent.id, updates);
      setStudents((prev) => prev.map((student) => (
        student.id === editingStudent.id ? { ...student, ...updates } : student
      )));
      toast.success('Student profile updated');
      setEditingStudent(null);
    } catch {
      toast.error('Student profile was not saved to live data.');
    }
  };

  const approveStudentAdmission = async (student) => {
    if (!canApproveStudentAdmission(currentRoleId)) {
      toast.error('Only Super Admin can approve admissions.');
      return;
    }
    if (!isFirebaseConfigured) {
      toast.error('Live Firebase data is not configured.');
      return;
    }

    const approvedAtText = formatDisplayDate();
    const studentUpdates = {
      status: ACTIVE_STUDENT_STATUS,
      admissionApprovalStatus: APPROVED_ADMISSION_STATUS,
      approvedBy: user?.name || 'Super Admin',
      approvedAtText,
    };
    const admission = latestRecord(admissions.filter((record) => relationMatches(record, student) && record.academicYear === student.academicYear));
    const admissionUpdates = {
      status: APPROVED_ADMISSION_STATUS,
      approvedBy: user?.name || 'Super Admin',
      approvedAtText,
    };

    try {
      await Promise.all([
        updateStudent(student.id, studentUpdates),
        admission?.id ? updateStudentAdmission(admission.id, admissionUpdates) : Promise.resolve(),
      ]);
      setStudents((prev) => prev.map((item) => item.id === student.id ? { ...item, ...studentUpdates } : item));
      if (admission?.id) {
        setAdmissions((prev) => prev.map((item) => item.id === admission.id ? { ...item, ...admissionUpdates } : item));
      }
      toast.success('Student admission approved');
    } catch {
      toast.error('Student admission was not approved in live data.');
    }
  };

  const archiveSelectedStudent = async (student) => {
    if (!canArchiveStudents) {
      toast.error('You do not have permission to archive student records.');
      return;
    }
    if (!isFirebaseConfigured) {
      toast.error('Live Firebase data is not configured.');
      return;
    }

    const archivedAtText = formatDisplayDate();
    const updates = { status: 'Archived', archivedAtText };

    try {
      await archiveStudent(student.id, { archivedAtText });
      setStudents((prev) => prev.map((item) => (
        item.id === student.id ? { ...item, ...updates } : item
      )));
      const nextStudent = students.find((item) => item.id !== student.id && item.status !== 'Archived');
      if (selectedId === student.id && nextStudent) setSelectedId(nextStudent.id);
      toast.success('Student archived');
    } catch {
      toast.error('Student was not archived in live data.');
    }
  };

  const restoreArchivedStudent = async (student) => {
    if (!canArchiveStudents) {
      toast.error('You do not have permission to restore student records.');
      return;
    }
    if (!isFirebaseConfigured) {
      toast.error('Live Firebase data is not configured.');
      return;
    }

    const restoredAtText = formatDisplayDate();
    const restoredStatus = canApproveStudentAdmission(currentRoleId) ? ACTIVE_STUDENT_STATUS : PENDING_ADMISSION_STATUS;
    const updates = { status: restoredStatus, restoredAtText };

    try {
      await restoreStudent(student.id, updates);
      setStudents((prev) => prev.map((item) => (
        item.id === student.id ? { ...item, ...updates } : item
      )));
      setSelectedId(student.id);
      setStatusFilter('active');
      toast.success('Student restored');
    } catch {
      toast.error('Student was not restored in live data.');
    }
  };

  const saveStudentHealthRecord = async (form, existingRecord = null) => {
    if (!selectedStudent) return false;
    if (!isHealthRecordManager(currentRoleId)) {
      toast.error('Only Admin and Super Admin can upload or edit health records.');
      return false;
    }
    if (!isFirebaseConfigured) {
      toast.error('Live Firebase data is not configured.');
      return false;
    }

    const savedAtText = formatDisplayDate();
    const payload = {
      ...form,
      studentRecordId: selectedStudent.id,
      studentId: selectedStudent.studentId,
      studentName: selectedStudent.name,
      academicYear: form.identification?.academicYear || academicYear || selectedStudent.academicYear || '',
      courseCode: selectedStudent.courseCode || '',
      courseName: selectedStudent.courseName || selectedStudent.program || '',
      updatedBy: user?.name || 'Admin',
      updatedAtText: savedAtText,
    };

    try {
      if (existingRecord?.id) {
        await updateStudentHealthRecord(existingRecord.id, payload);
        setStudentHealthRecords((prev) => prev.map((record) => (
          record.id === existingRecord.id ? { ...record, ...payload } : record
        )));
        toast.success('Student health record updated');
      } else {
        const createPayload = {
          ...payload,
          uploadedBy: user?.name || 'Admin',
          uploadedAtText: savedAtText,
        };
        const id = await createStudentHealthRecord(createPayload);
        if (!id) throw new Error('Missing health record id.');
        setStudentHealthRecords((prev) => [{ id, ...createPayload }, ...prev]);
        toast.success('Student health record uploaded');
      }
      return true;
    } catch (error) {
      console.error('Unable to save student health record.', error);
      toast.error('Student health record was not saved to live data.');
      return false;
    }
  };

  const removeStudentHealthRecord = async (record) => {
    if (!record?.id) return false;
    if (!isHealthRecordManager(currentRoleId)) {
      toast.error('Only Admin and Super Admin can delete health records.');
      return false;
    }
    if (!isFirebaseConfigured) {
      toast.error('Live Firebase data is not configured.');
      return false;
    }

    try {
      await deleteStudentHealthRecord(record.id);
      setStudentHealthRecords((prev) => prev.filter((item) => item.id !== record.id));
      toast.success('Student health record deleted');
      return true;
    } catch (error) {
      console.error('Unable to delete student health record.', error);
      toast.error('Student health record was not deleted from live data.');
      return false;
    }
  };

  return (
    <div className={`erp-shell ${themeMode === 'light' ? 'light-mode' : ''} h-screen overflow-hidden bg-white text-slate-900`}>
        <div className="flex h-screen overflow-hidden">
          <Sidebar
            activePage={activePage}
            activeSubmenuId={activeSubmenuId}
            collapsed={sidebarCollapsed}
            currentUser={user}
            institute={institute}
            onNavigate={navigateToModule}
            onThemeToggle={() => setThemeMode((prev) => (prev === 'dark' ? 'light' : 'dark'))}
            onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
            themeMode={themeMode}
          />
          <main className="flex-1 min-w-0 h-screen overflow-hidden bg-[#f0f1f3] flex flex-col">
            <TopHeader
              academicYear={academicYear}
              academicYears={academicYearOptions}
              courseCode={effectiveSelectedCourseCode}
              courses={headerCourses}
              institute={institute}
              onAcademicYearChange={setAcademicYear}
              onCourseChange={(courseCode) => {
                setSelectedCourseCode(courseCode);
                setSelectedId('');
              }}
              user={{ ...user, selectedCollege: { ...user?.selectedCollege, name: institute.name, code: institute.instituteId || institute.code } }}
              onLogout={onLogout}
            />

            <div className="erp-main-scroll flex-1 min-h-0 overflow-y-auto p-4 lg:p-5">
              <section className="erp-workspace bg-white min-h-full p-5 lg:p-7">
                <ModuleErrorBoundary resetKey={activePage}>
                <Suspense fallback={<ModuleLoadingState />}>
                {!canOpenActiveModule ? (
                  <div className="rounded-lg bg-[#f5f5f6] p-6 text-sm text-slate-600">
                    You do not have permission to open this module.
                  </div>
                ) : activePage === 'dashboard' ? (
                  <DashboardManagement academicYear={academicYear} currentUser={user} selectedCourse={selectedCourse} selectedCourseCode={effectiveSelectedCourseCode} scopedStudents={courseStudents} onNavigate={navigateToModule} />
                ) : activePage === 'students' ? (
                selectedStudent ? (
                  <StudentDetailPage
                    academicYear={academicYear}
                    attendanceRecords={selectedAttendanceRecords}
                    canApprove={canApproveStudentAdmission(currentRoleId)}
                    canEdit={canEditStudents}
                    canManageHealthRecord={isHealthRecordManager(currentRoleId)}
                    currentRoleId={currentRoleId}
                    documents={selectedDocuments}
                    feeAssignments={selectedFeeAssignments}
                    feeCollections={selectedFeeCollections}
                    healthRecord={selectedHealthRecord}
                    latestAdmission={latestAdmission}
                    marksEntries={selectedMarksEntries}
                    onApprove={approveStudentAdmission}
                    onDeleteHealthRecord={removeStudentHealthRecord}
                    onEdit={setEditingStudent}
                    onSaveHealthRecord={saveStudentHealthRecord}
                    promotions={selectedPromotions}
                    results={selectedResults}
                    student={selectedStudent}
                    transfers={selectedTransfers}
                    onBack={goBackOneStudentStep}
                    onOpenDocuments={openStudentDocuments}
                  />
                ) : (
                <>
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                  <div>
                    <div className="text-sm font-bold text-slate-500 mb-2">Academics / <span className="text-[#f39a5f]">Student Information Management</span></div>
                    <h1 className="text-2xl font-bold text-slate-900">Student Information Management</h1>
                    {!isFirebaseConfigured && <p className="text-xs text-orange-600 mt-2">Live Firebase data is not configured.</p>}
                    {loadError && <p className="text-xs text-rose-600 mt-2">{loadError}</p>}
                  </div>
                  {canCreateAdmission && (
                    <button
                      type="button"
                      onClick={() => setShowModal(true)}
                      className="h-10 px-5 rounded-lg bg-[#fb8d49] text-white font-semibold text-sm flex items-center justify-center gap-2"
                    >
                      <Plus size={16} /> New Admission
                    </button>
                  )}
                </div>

                <div className="erp-branch-focus flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5 rounded-lg bg-[#f5f5f6] p-5 border border-slate-100">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="erp-branch-icon h-16 w-16 rounded-lg bg-white text-[#fb8d49] flex items-center justify-center shrink-0">
                      <Users size={28} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-500">Students</div>
                      <h2 className="text-2xl font-extrabold text-slate-900 mt-1">
                        {effectiveSelectedCourseCode === 'all' ? 'All Students' : [...courses, ...parentCourseOptions].find((course) => course.courseCode === effectiveSelectedCourseCode)?.courseName || 'Selected Course'}
                      </h2>
                      <p className="text-sm text-slate-500 mt-1">Browse active and archived records.</p>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="min-w-0">
                    <div className="relative mb-4">
                      <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by student name, ID, admission no, class..."
                        className="w-full h-11 rounded-lg bg-[#f0f0f2] border-0 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-orange-100"
                      />
                    </div>
                    <div className="flex items-center gap-2 mb-4">
                      {[
                        ['active', 'Active & Pending'],
                        ['archived', 'Archived'],
                      ].map(([value, label]) => (
                        <button
                          key={value}
                          onClick={() => setStatusFilter(value)}
                          className={`h-9 px-4 rounded-md border text-xs font-semibold ${
                            statusFilter === value
                              ? 'bg-[#33373e] text-white border-[#33373e]'
                              : 'bg-white text-slate-600 border-slate-200'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    <StudentTable
                      canArchive={canArchiveStudents}
                      canEdit={canEditStudents}
                      showActions={false}
                      students={filteredStudents}
                      statusFilter={statusFilter}
                      selectedId={selectedId}
                      onSelect={selectStudent}
                      onEdit={setEditingStudent}
                      onArchive={archiveSelectedStudent}
                      onRestore={restoreArchivedStudent}
                    />
                  </div>

                </div>
                </>
                )
                ) : activePage === 'reports' ? (
                  <ReportsManagement
                    key={`reports-${location.state?.reportCategory || 'default'}`}
                    academicYear={academicYear}
                    admissions={courseScopedAdmissions}
                    attendanceRecords={courseScopedAttendanceRecords}
                    currentUser={user}
                    documents={courseScopedDocuments}
                    marksEntries={courseScopedMarksEntries}
                    promotions={courseScopedPromotions}
                    scopedStudents={courseStudents}
                    selectedCourse={selectedCourse}
                    selectedCourseCode={effectiveSelectedCourseCode}
                    initialCategoryId={location.state?.reportCategory}
                    studentResults={courseScopedStudentResults}
                  />
                ) : activePage === 'faculty-staff' ? (
                  <FacultyStaffManagement
                    currentUser={user}
                    academicYear={academicYear}
                    selectedCourse={selectedCourse}
                    selectedCourseCode={effectiveSelectedCourseCode}
                    scopedStudents={courseStudents}
                    onOpenDocuments={openOwnerDocuments}
                  />
                ) : activePage === 'academics' ? (
                  <AcademicsManagement currentUser={user} academicYear={academicYear} selectedCourse={selectedCourse} selectedCourseCode={effectiveSelectedCourseCode} />
                ) : activePage === 'calendar' ? (
                  <CurriculumManagement currentUser={user} academicYear={academicYear} selectedCourse={selectedCourse} selectedCourseCode={effectiveSelectedCourseCode} />
                ) : activePage === 'attendance' ? (
                  <AttendanceManagement
                    key={`attendance-${location.state?.attendanceSubmenu || 'home'}`}
                    currentUser={user}
                    academicYear={academicYear}
                    initialBranch={location.state?.attendanceBranch}
                    initialMode={location.state?.attendanceMode}
                    initialTask={location.state?.attendanceTask}
                    selectedCourse={selectedCourse}
                    selectedCourseCode={effectiveSelectedCourseCode}
                    scopedStudents={moduleScopedStudents}
                  />
                ) : activePage === 'timetable' ? (
                  <TimetableManagement currentUser={user} academicYear={academicYear} selectedCourse={selectedCourse} selectedCourseCode={effectiveSelectedCourseCode} scopedStudents={courseStudents} />
                ) : activePage === 'examination-results' ? (
                  <ExaminationResultManagement
                    key={`exams-${location.state?.examTask || 'home'}-${location.state?.examBranch || ''}`}
                    currentUser={user}
                    academicYear={academicYear}
                    initialBranch={location.state?.examBranch}
                    initialTask={location.state?.examTask}
                    selectedCourse={selectedCourse}
                    selectedCourseCode={effectiveSelectedCourseCode}
                    scopedStudents={moduleScopedStudents}
                  />
                ) : activePage === 'fees' ? (
                  <FeesManagement
                    key={`fees-${location.state?.feeTask || 'home'}-${location.state?.feeBranch || ''}`}
                    currentUser={user}
                    academicYear={academicYear}
                    initialBranch={location.state?.feeBranch}
                    initialTask={location.state?.feeTask}
                    selectedCourse={selectedCourse}
                    selectedCourseCode={effectiveSelectedCourseCode}
                    scopedStudents={moduleScopedStudents}
                  />
                ) : activePage === 'hostel-management' ? (
                  <HostelManagement currentUser={user} academicYear={academicYear} selectedCourse={selectedCourse} selectedCourseCode={effectiveSelectedCourseCode} scopedStudents={moduleScopedStudents} />
                ) : activePage === 'communication' ? (
                  <NoticeBoardManagement
                    key={`communication-${location.state?.communicationTask || 'home'}`}
                    currentUser={user}
                    academicYear={academicYear}
                    initialTask={location.state?.communicationTask}
                    selectedCourse={selectedCourse}
                    selectedCourseCode={effectiveSelectedCourseCode}
                  />
                ) : activePage === 'document-management' ? (
                  <DocumentManagement
                    currentUser={user}
                    academicYear={academicYear}
                    selectedCourse={selectedCourse}
                    selectedCourseCode={effectiveSelectedCourseCode}
                    scopedStudents={moduleScopedStudents}
                    ownerFilter={location.state?.documentOwner}
                  />
                ) : activePage === 'parent-portal' ? (
                  <ParentPortal currentUser={user} academicYear={academicYear} selectedCourse={selectedCourse} selectedCourseCode={effectiveSelectedCourseCode} />
                ) : activePage === 'user-roles' ? (
                  <UserRoleManagement currentUser={user} />
                ) : activePage === 'settings' ? (
                  <SettingsManagement
                    currentUser={user}
                    activeAcademicYear={academicYear}
                    selectedCourse={selectedCourse}
                    selectedCourseCode={effectiveSelectedCourseCode}
                  />
                ) : (
                  <div className="rounded-lg bg-[#f5f5f6] p-6 text-sm text-slate-600">
                    This module is not available.
                  </div>
                )}
                </Suspense>
                </ModuleErrorBoundary>
              </section>
            </div>

            <footer className="h-14 bg-white border-t border-slate-200 px-6 flex items-center justify-center text-xs text-slate-500">
              <span>
                Designed & Developed by{' '}
                <a
                  href="https://www.devlofttech.com"
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold text-[#fb8d49] hover:underline"
                >
                  Devloft Technologies
                </a>
              </span>
            </footer>
          </main>
        </div>
      {showModal && (
        <StudentModal
          academicYearOptions={academicYearOptions}
          canApproveAdmission={canApproveStudentAdmission(currentRoleId)}
          courses={courses}
          initialAcademicYear={academicYear}
          initialCourseCode={effectiveSelectedCourseCode === 'all' ? courses[0]?.courseCode : effectiveSelectedCourseCode}
          onClose={() => setShowModal(false)}
          onSave={saveStudent}
        />
      )}
      {editingStudent && (
        <StudentModal
          mode="edit"
          academicYearOptions={academicYearOptions}
          canApproveAdmission={canApproveStudentAdmission(currentRoleId)}
          courses={courses}
          initialAcademicYear={academicYear}
          initialStudent={editingStudent}
          onClose={() => setEditingStudent(null)}
          onSave={saveStudentProfile}
        />
      )}
    </div>
  );
}

function StudentDetailPage({
  academicYear = '',
  attendanceRecords = [],
  canApprove = false,
  canEdit,
  canManageHealthRecord = false,
  currentRoleId = '',
  documents = [],
  feeAssignments = [],
  feeCollections = [],
  healthRecord = null,
  latestAdmission,
  marksEntries = [],
  onApprove,
  onBack,
  onDeleteHealthRecord,
  onEdit,
  onOpenDocuments,
  onSaveHealthRecord,
  promotions = [],
  results = [],
  student,
  transfers = [],
}) {
  const [showAllDetails, setShowAllDetails] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const verifiedDocs = documents.filter((item) => item.verificationStatus === 'Verified' || item.verificationStatus === 'Source PDF').length;
  const pendingDocs = documents.filter((item) => item.verificationStatus === 'Pending Review').length;
  const generalAttendanceRecords = attendanceRecords.filter((item) => !(item.subjectName || item.subject));
  const subjectAttendanceRecords = attendanceRecords.filter((item) => item.subjectName || item.subject);
  const generalPresentRecords = generalAttendanceRecords.filter((item) => item.status === 'Present').length;
  const generalAbsentRecords = generalAttendanceRecords.filter((item) => item.status === 'Absent').length;
  const generalLeaveRecords = generalAttendanceRecords.filter((item) => ['Leave', 'On Leave'].includes(item.status)).length;
  const generalAttendancePercentage = generalAttendanceRecords.length ? Math.round((generalPresentRecords / generalAttendanceRecords.length) * 100) : 0;
  const examRecordCount = marksEntries.length + results.length;
  const examPercentages = [...marksEntries, ...results].map((item) => Number(item.percentage || 0)).filter((value) => value > 0);
  const examAverage = examPercentages.length ? Math.round(examPercentages.reduce((sum, value) => sum + value, 0) / examPercentages.length) : 0;
  const feeCollectionsByAssignment = feeCollections.reduce((map, item) => {
    if (!item.assignmentId) return map;
    map[item.assignmentId] = [...(map[item.assignmentId] || []), item];
    return map;
  }, {});
  const paymentRows = feeAssignments.map((item, index) => {
    const ledger = calculateAssignmentPaymentLedger(item, feeCollectionsByAssignment[item.id] || []);
    const componentTotal = totalFeeComponents(item);
    const total = componentTotal > 0 ? componentTotal : Number(item.totalAmount || 0);
    const paid = Number(ledger.paidAmount || 0);
    const adjusted = Number(ledger.adjustmentAmount || 0);
    const due = Number(ledger.dueAmount || 0);
    return {
      id: item.id || `fee-${index}`,
      label: item.feeStructureName || item.structureName || item.classKey || `Fee Assignment ${index + 1}`,
      helper: [
        item.dueDate ? `Due date: ${item.dueDate}` : item.academicYear || 'Fee assignment',
        formatManualDueItems(item.manualDueItems) ? `Pending: ${formatManualDueItems(item.manualDueItems)}` : '',
      ].filter(Boolean).join(' | '),
      value: formatCurrency(due),
      valueTone: due > 0 ? 'danger' : 'success',
      percentage: total ? Math.min(100, Math.round(((paid + adjusted) / total) * 100)) : 0,
      status: ledger.status || item.status || (due > 0 ? 'Due' : 'Paid'),
      statusTone: due > 0 ? 'danger' : 'success',
      total,
      paid,
      adjusted,
      due,
    };
  });
  const feeAssigned = paymentRows.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const feePaid = paymentRows.reduce((sum, item) => sum + Number(item.paid || 0), 0);
  const feeAdjusted = paymentRows.reduce((sum, item) => sum + Number(item.adjusted || 0), 0);
  const feeDue = paymentRows.reduce((sum, item) => sum + Number(item.due || 0), 0);
  const feeCollected = feeCollections.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const feeCompletion = feeAssigned ? Math.min(100, Math.round(((feePaid + feeAdjusted) / feeAssigned) * 100)) : 0;
  const admissionStatus = latestAdmission?.status || student.status || PENDING_ADMISSION_STATUS;
  const canShowApproval = canApprove
    && student.status !== 'Archived'
    && !statusRequiresSuperAdminApproval(student.status)
    && !statusRequiresSuperAdminApproval(latestAdmission?.status || '');
  const summaryTabs = [
    { id: 'profile', label: 'Profile', icon: <UserRound size={14} />, active: activeTab === 'profile' },
    { id: 'attendance', label: 'Attendance', value: `${generalAttendancePercentage}%`, icon: <Bell size={14} />, active: activeTab === 'attendance' },
    { id: 'exams', label: 'Exams', value: `${examRecordCount}`, icon: <BookOpen size={14} />, active: activeTab === 'exams' },
    { id: 'payment', label: 'Payment', icon: <Wallet size={14} />, active: activeTab === 'payment' },
    { id: 'documents', label: 'Docs', value: `${documents.length}`, icon: <FileText size={14} />, active: activeTab === 'documents' },
    { id: 'health', label: 'Health Record', value: healthRecord ? 'Uploaded' : 'Empty', icon: <HeartPulse size={14} />, active: activeTab === 'health' },
  ];

  const attendanceSubjectRows = Object.values(subjectAttendanceRecords.reduce((map, record) => {
    const subject = record.subjectName || record.subject;
    if (!subject) return map;
    const row = map[subject] || { subject, total: 0, present: 0, absent: 0, leave: 0 };
    row.total += 1;
    if (record.status === 'Present') row.present += 1;
    if (record.status === 'Absent') row.absent += 1;
    if (['Leave', 'On Leave'].includes(record.status)) row.leave += 1;
    map[subject] = row;
    return map;
  }, {})).map((row) => ({
    ...row,
    percentage: row.total ? Math.round((row.present / row.total) * 100) : 0,
  }));

  const examRows = [
    ...marksEntries.map((item, index) => {
      const maxMarks = Number(item.maxMarks || 0);
      const marksObtained = Number(item.marksObtained || 0);
      const percentage = Number(item.percentage || (maxMarks ? Math.round((marksObtained / maxMarks) * 100) : 0));
      return {
        id: item.id || `mark-${index}`,
        label: item.subject || item.subjectName || item.examName || `Marks Entry ${index + 1}`,
        helper: item.examName || item.title || item.enteredAtText || 'Marks entry',
        value: maxMarks ? `${marksObtained}/${maxMarks}` : `${percentage}%`,
        percentage,
        status: item.grade || item.status || '-',
      };
    }),
    ...results.map((item, index) => {
      const percentage = Number(item.percentage || 0);
      const totalMax = Number(item.totalMax || item.maxMarks || 0);
      const totalObtained = Number(item.totalObtained || item.marksObtained || 0);
      return {
        id: item.id || `result-${index}`,
        label: item.examName || item.subject || `Result ${index + 1}`,
        helper: item.generatedAtText || item.classKey || 'Generated result',
        value: totalMax ? `${totalObtained}/${totalMax}` : `${percentage}%`,
        percentage,
        status: item.grade || item.status || '-',
      };
    }),
  ];

  const paymentHistoryRows = sortPaymentRecordsByDate(feeCollections)
    .map((item, index) => {
      const installmentNo = Number(item.installmentNo || 0);
      const installmentCount = Number(item.installmentCount || 0);
      const installmentLabel = installmentNo
        ? `Installment ${installmentNo}${installmentCount ? `/${installmentCount}` : ''}`
        : `Installment ${index + 1}`;
      const paymentDate = formatPaymentDate(item.paymentDate || item.createdAtText);
      const manualDueItems = formatManualDueItems(item.manualDueItems);
      const paidDueItems = formatManualDueItems(item.paidDueItems);
      return {
        id: item.id || `collection-${index}`,
        label: [installmentLabel, item.feeStructureName || item.entryMode].filter(Boolean).join(' - '),
        helper: [
          paymentDate && paymentDate !== '-' ? `Date: ${paymentDate}` : 'Payment record',
          item.paymentMode ? `Mode: ${item.paymentMode}` : '',
          item.creditedToAccount ? `Account: ${item.creditedToAccount}` : '',
          item.referenceNo ? `Ref: ${item.referenceNo}` : '',
          Number(item.dueAfterPayment || 0) > 0 ? `Due after: ${formatCurrency(item.dueAfterPayment)}` : '',
          Number(item.agentFeePaidAmount || 0) > 0 ? `Agent payout: ${formatCurrency(item.agentFeePaidAmount)}` : '',
          paidDueItems ? `Paid items: ${paidDueItems}` : '',
          manualDueItems ? `Pending: ${manualDueItems}` : '',
        ].filter(Boolean).join(' | '),
        value: formatCurrency(item.amount),
        status: item.status || 'Posted',
      };
    });

  const documentRows = documents.map((item, index) => ({
    id: item.id || `document-${index}`,
    label: item.documentType || item.archiveTitle || item.fileName || `Document ${index + 1}`,
    helper: item.category || item.fileName || item.uploadedAtText || 'Student document',
    value: item.verificationStatus || 'Pending Review',
    percentage: item.verificationStatus === 'Verified' || item.verificationStatus === 'Source PDF' ? 100 : 0,
    status: item.verificationStatus || 'Pending Review',
  }));

  const statDetails = {
    attendance: {
      title: 'Attendance Stats',
      helper: `${generalAttendancePercentage}% general attendance. Subject-wise records remain separate below.`,
      items: [
        ['General Present', generalPresentRecords],
        ['General Absent', generalAbsentRecords],
        ['General Leave', generalLeaveRecords],
        ['General Records', generalAttendanceRecords.length],
        ['Subject Records', subjectAttendanceRecords.length],
        ['All Records', attendanceRecords.length],
      ],
    },
    exams: {
      title: 'Exam Stats',
      helper: examRecordCount ? `${examAverage}% average across available marks/results.` : 'No marks or result records available.',
      items: [
        ['Marks Entries', marksEntries.length],
        ['Results', results.length],
        ['Average', examRecordCount ? `${examAverage}%` : '0%'],
        ['Records', examRecordCount],
      ],
    },
    payment: {
      title: 'Payment Stats',
      helper: feeDue ? `${formatCurrency(feeDue)} due across ${feeAssignments.length} assignment${feeAssignments.length === 1 ? '' : 's'}.` : 'No fee due recorded.',
      items: [
        ['Assigned', formatCurrency(feeAssigned)],
        ['Paid', formatCurrency(feePaid)],
        ['Adjusted', formatCurrency(feeAdjusted)],
        ['Collected', formatCurrency(feeCollected)],
        ['Due', formatCurrency(feeDue)],
      ],
    },
    documents: {
      title: 'Document Stats',
      helper: `${verifiedDocs}/${documents.length || 0} documents verified.`,
      items: [
        ['Total', documents.length],
        ['Verified', verifiedDocs],
        ['Pending', pendingDocs],
        ['Other', Math.max(0, documents.length - verifiedDocs - pendingDocs)],
      ],
    },
  };

  const handleSummaryTabSelect = (tabId) => {
    if (summaryTabs.some((tab) => tab.id === tabId)) setActiveTab(tabId);
  };

  const getPaymentMetricTone = (label) => {
    if (['Paid', 'Collected'].includes(label)) return 'success';
    if (label === 'Due') return 'danger';
    return '';
  };

  const getToneClass = (tone, fallback = 'text-slate-900') => {
    if (tone === 'success') return 'erp-student-payment-value-success';
    if (tone === 'danger') return 'erp-student-payment-value-danger';
    return fallback;
  };

  const renderMetricGrid = (items, context = '') => (
    <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
      {items.map(([label, value]) => (
        <div key={label} className={`rounded-lg border border-slate-100 bg-white p-3 ${context === 'payment' ? 'erp-student-payment-metric' : ''}`}>
          <div className="text-xs font-semibold text-slate-500">{label}</div>
          <div className={`mt-1 text-lg font-extrabold ${context === 'payment' ? getToneClass(getPaymentMetricTone(label)) : 'text-slate-900'}`}>{value}</div>
        </div>
      ))}
    </div>
  );

  const renderProgressRow = (row, color = '#00c46f') => (
    <div key={row.id || row.label} className="rounded-lg border border-slate-100 bg-white p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="font-bold text-slate-900">{row.label}</div>
          <div className="text-xs text-slate-500 mt-1">{row.helper}</div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className={`font-extrabold ${getToneClass(row.valueTone)}`}>{row.value}</span>
          <span className={`rounded-full bg-[#f5f5f6] px-3 py-1 text-xs font-bold ${getToneClass(row.statusTone, 'text-slate-600')}`}>{row.status}</span>
        </div>
      </div>
      <div className="mt-3 h-3 rounded-full bg-[#f5f5f6] overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, Number(row.percentage || 0)))}%`, background: color }} />
      </div>
      <div className="mt-2 text-right text-xs font-bold text-slate-500">{Math.min(100, Math.max(0, Number(row.percentage || 0)))}%</div>
    </div>
  );

  const renderEmptyState = (message) => (
    <div className="rounded-lg border border-dashed border-slate-200 bg-white p-6 text-sm font-semibold text-slate-500">
      {message}
    </div>
  );

  const renderProfileContent = () => (
    <>
      <div className="grid xl:grid-cols-[1.1fr_.9fr] gap-5 mb-5">
        <section className="bg-white border border-slate-100 rounded-lg p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="font-bold text-slate-900">Parent Portal View</h3>
            <span className="rounded-full bg-[#f5f5f6] px-3 py-1 text-xs font-bold text-slate-600">View only</span>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            {[
              ['Guardian', student.guardianName],
              ['Phone', student.phone],
              ['Email', student.email],
              ['Course', student.courseName || student.program],
              ['Class', `${student.className || '-'} - ${student.section || '-'}`],
              ['Academic Year', student.academicYear],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-[#f5f5f6] p-3">
                <div className="text-xs text-slate-500">{label}</div>
                <div className="font-semibold text-slate-900 mt-1 break-words">{value || '-'}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white border border-slate-100 rounded-lg p-5 shadow-sm">
          <h3 className="font-bold text-slate-900 mb-4">Documents & Movement</h3>
          <div className="space-y-3 text-sm">
            {[
              ['Verified Documents', verifiedDocs, '#22c55e'],
              ['Pending Documents', Math.max(0, documents.length - verifiedDocs), '#f59e0b'],
              ['Promotions', promotions.length, '#2563eb'],
              ['Transfers', transfers.length, '#ef4444'],
            ].map(([label, value, color]) => (
              <div key={label}>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-600">{label}</span>
                  <b>{value}</b>
                </div>
                <div className="mt-1 h-2 rounded-full bg-[#f5f5f6] overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, Number(value) * 25)}%`, background: color }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <button
        type="button"
        onClick={() => setShowAllDetails((open) => !open)}
        className="mb-5 h-12 px-6 rounded-lg bg-[#00ff88] text-[#02100d] border border-emerald-300 font-extrabold text-sm shadow-[0_0_22px_rgba(0,255,136,0.35)] hover:bg-emerald-300 focus:outline-none focus:ring-4 focus:ring-emerald-200"
      >
        {showAllDetails ? 'Hide all details' : 'View all details'}
      </button>

      <div className="bg-white border border-slate-100 rounded-lg p-5 shadow-sm">
        <h3 className="font-bold mb-4">Student Timeline</h3>
        <div className="grid sm:grid-cols-3 gap-3 text-sm text-slate-600">
          <div className="rounded-lg bg-[#f5f5f6] p-3">
            Admission status: {admissionStatus}. Created on {student.createdAtText || latestAdmission?.submittedAtText || 'today'}.
          </div>
          <div className="rounded-lg bg-[#f5f5f6] p-3">Documents available: {documents.length}</div>
          <div className="rounded-lg bg-[#f5f5f6] p-3">Parent portal information is shown here as read-only student context.</div>
        </div>
      </div>
    </>
  );

  const renderActiveTabContent = () => {
    if (activeTab === 'profile') return renderProfileContent();
    if (activeTab === 'health') {
      return (
        <StudentHealthRecordTab
          academicYear={academicYear}
          canManage={canManageHealthRecord}
          currentRoleId={currentRoleId}
          healthRecord={healthRecord}
          onDelete={onDeleteHealthRecord}
          onSave={onSaveHealthRecord}
          student={student}
        />
      );
    }

    const selectedStat = statDetails[activeTab] || statDetails.attendance;

    return (
      <section className="rounded-lg border border-emerald-500/30 bg-emerald-950/10 p-5 shadow-[0_0_24px_rgba(16,185,129,0.08)]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="font-bold text-slate-900">{selectedStat.title}</h3>
            <p className="text-sm text-slate-500 mt-1">{selectedStat.helper}</p>
          </div>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
            In-page stats
          </span>
        </div>
        {renderMetricGrid(selectedStat.items, activeTab)}

        {activeTab === 'attendance' && (
          <div className="mt-5 grid xl:grid-cols-[.7fr_1.3fr] gap-4">
            <div className="rounded-lg border border-slate-100 bg-white p-5">
              <div className="text-sm font-bold text-slate-900 mb-4">General Attendance</div>
              <div
                className="mx-auto h-36 w-36 rounded-full flex items-center justify-center"
                style={{ background: `conic-gradient(#00c46f ${generalAttendancePercentage * 3.6}deg, #f5f5f6 0deg)` }}
              >
                <div className="h-24 w-24 rounded-full bg-white flex flex-col items-center justify-center">
                  <span className="text-3xl font-extrabold text-slate-900">{generalAttendancePercentage}%</span>
                  <span className="text-xs font-semibold text-slate-500">Present</span>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-lg bg-[#f5f5f6] p-2"><b className="block text-slate-900">{generalPresentRecords}</b>Present</div>
                <div className="rounded-lg bg-[#f5f5f6] p-2"><b className="block text-slate-900">{generalAbsentRecords}</b>Absent</div>
                <div className="rounded-lg bg-[#f5f5f6] p-2"><b className="block text-slate-900">{generalLeaveRecords}</b>Leave</div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="text-sm font-bold text-slate-900">Subject-wise Attendance</div>
              {attendanceSubjectRows.length
                ? attendanceSubjectRows.map((row) => renderProgressRow({
                  id: row.subject,
                  label: row.subject,
                  helper: `Present ${row.present} | Absent ${row.absent} | Leave ${row.leave} | Total ${row.total}`,
                  value: `${row.percentage}%`,
                  percentage: row.percentage,
                  status: row.total ? `${row.present}/${row.total}` : '0/0',
                }, '#00c46f'))
                : renderEmptyState('No subject-wise attendance records available.')}
            </div>
          </div>
        )}

        {activeTab === 'exams' && (
          <div className="mt-5 space-y-3">
            <div className="text-sm font-bold text-slate-900">Subject-wise Exam Performance</div>
            {examRows.length
              ? examRows.map((row) => renderProgressRow(row, '#2563eb'))
              : renderEmptyState('No exam marks or result records available.')}
          </div>
        )}

        {activeTab === 'payment' && (
          <div className="mt-5 space-y-4">
            <div className="grid xl:grid-cols-[.7fr_1.3fr] gap-4">
              <div className="rounded-lg border border-slate-100 bg-white p-5">
                <div className="text-sm font-bold text-slate-900 mb-4">Payment Progress</div>
                <div className="h-3 rounded-full bg-[#f5f5f6] overflow-hidden">
                  <div className="h-full rounded-full bg-[#00c46f]" style={{ width: `${feeCompletion}%` }} />
                </div>
                <div className="mt-3 text-3xl font-extrabold text-slate-900">{feeCompletion}%</div>
                <div className="text-sm text-slate-500">Paid or adjusted against assigned fees.</div>
              </div>
              <div className="space-y-3">
                <div className="text-sm font-bold text-slate-900">Fee Assignments</div>
                {paymentRows.length
                  ? paymentRows.map((row) => renderProgressRow({
                    ...row,
                    helper: `${row.helper} | Total ${formatCurrency(row.total)} | Paid ${formatCurrency(row.paid)} | Adjusted ${formatCurrency(row.adjusted)}`,
                  }, row.due > 0 ? '#f59e0b' : '#00c46f'))
                  : renderEmptyState('No fee assignment records available.')}
              </div>
            </div>
            <div className="space-y-3">
              <div className="text-sm font-bold text-slate-900">Payment Records</div>
              {paymentHistoryRows.length
                ? paymentHistoryRows.map((row) => (
                  <div key={row.id || row.label} className="rounded-lg border border-slate-100 bg-white p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="font-bold text-slate-900">{row.label}</div>
                        <div className="text-xs text-slate-500 mt-1">{row.helper}</div>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="font-extrabold text-emerald-700">{row.value}</span>
                        <span className="rounded-full bg-[#f5f5f6] px-3 py-1 text-xs font-bold text-slate-600">{row.status}</span>
                      </div>
                    </div>
                  </div>
                ))
                : renderEmptyState('No payment records available.')}
            </div>
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="mt-5 space-y-3">
            <div className="text-sm font-bold text-slate-900">Document Information</div>
            {documentRows.length
              ? documentRows.map((row) => (
                <div key={row.id || row.label} className="rounded-lg border border-slate-100 bg-white p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="font-bold text-slate-900">{row.label}</div>
                      <div className="text-xs text-slate-500 mt-1">{row.helper}</div>
                    </div>
                    <span className="rounded-full bg-[#f5f5f6] px-3 py-1 text-xs font-bold text-slate-600">{row.status}</span>
                  </div>
                </div>
              ))
              : renderEmptyState('No student document records available.')}
          </div>
        )}
      </section>
    );
  };

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
          <div className="text-sm font-bold text-slate-500 mb-2">Academics / <span className="text-[#f39a5f]">Student Details</span></div>
          <h1 className="text-2xl font-bold text-slate-900">{student.name}</h1>
          <p className="text-sm text-slate-500 mt-1">{student.admissionNo} / {student.studentId}</p>
        </div>
      </div>

      <StudentProfileCard
        canEdit={canEdit}
        onApprove={onApprove}
        onEdit={onEdit}
        onOpenDocuments={() => onOpenDocuments?.(student)}
        onSummaryTabSelect={handleSummaryTabSelect}
        showApprove={canShowApproval}
        showExtendedDetails={showAllDetails}
        showProfileDetails={activeTab === 'profile'}
        showSummaryTabs
        summaryTabs={summaryTabs}
        student={student}
      />

      {renderActiveTabContent()}
    </div>
  );
}



