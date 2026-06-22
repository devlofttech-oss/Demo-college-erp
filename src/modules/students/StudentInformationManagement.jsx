import { useEffect, useMemo, useState } from 'react';
import {
  Download,
  Search,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  createStudent,
  createStudentAdmission,
  createStudentDocument,
  getStudentInformationData,
  getSettingsData,
  archiveStudent,
  restoreStudent,
  updateStudent,
} from '../../firebase/db';
import { isFirebaseConfigured } from '../../firebase/config';
import { getEnabledModules, getModuleById } from '../moduleRegistry';
import { admissionCourses, admissionStudents } from './admissionSeedData';
import DashboardManagement from '../dashboard/DashboardManagement';
import DemoModulePage from './components/DemoModulePage';
import Sidebar from './components/Sidebar';
import StatusBadge from './components/StatusBadge';
import StudentModal from './components/StudentModal';
import StudentProfileCard from './components/StudentProfileCard';
import StudentTable from './components/StudentTable';
import TopHeader from './components/TopHeader';
import { formatDisplayDate, latestRecord, relationMatches, validateStudentProfile } from './studentUtils';
import UserRoleManagement from '../userRoles/UserRoleManagement';
import FacultyStaffManagement from '../facultyStaff/FacultyStaffManagement';
import AttendanceManagement from '../attendance/AttendanceManagement';
import TimetableManagement from '../timetable/TimetableManagement';
import ExaminationResultManagement from '../exams/ExaminationResultManagement';
import FeesManagement from '../fees/FeesManagement';
import FinancialReports from '../financialReports/FinancialReports';
import NoticeBoardManagement from '../notices/NoticeBoardManagement';
import DocumentManagement from '../documents/DocumentManagement';
import ParentPortal from '../parentPortal/ParentPortal';
import { canAccess, defaultRoles } from '../userRoles/rolePermissions';
import AcademicsManagement from '../academics/AcademicsManagement';
import CurriculumManagement from '../curriculum/CurriculumManagement';
import SettingsManagement from '../settings/SettingsManagement';
import { demoInstituteSettings } from '../settings/demoSettings';

function csvValue(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
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
        <div>
          <div className="text-sm font-bold text-slate-500 mb-2">Academics / <span className="text-[#f39a5f]">Student Report</span></div>
          <h1 className="text-2xl font-bold text-slate-900">Student Report</h1>
          <p className="text-sm text-slate-500 mt-1">Academic year {academicYear}: admissions, profiles, documents, and promotions.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={downloadReport} className="h-10 px-5 rounded-lg bg-[#33373e] text-white font-semibold text-sm flex items-center gap-2">
            <Download size={16} /> Download CSV
          </button>
          <button onClick={() => window.print()} className="h-10 px-5 rounded-lg bg-white border border-slate-200 text-slate-700 font-semibold text-sm">
            Print
          </button>
          <button onClick={onBack} className="h-10 px-5 rounded-full bg-[#fb9a5b] text-white font-semibold text-sm">
            Back to Students
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
  const [themeMode, setThemeMode] = useState(() => localStorage.getItem('erpThemeMode') || 'dark');
  const [students, setStudents] = useState(admissionStudents);
  const [courses, setCourses] = useState(admissionCourses);
  const [selectedCourseCode, setSelectedCourseCode] = useState('all');
  const [activePage, setActivePage] = useState('dashboard');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [admissions, setAdmissions] = useState([]);
  const [studentDocuments, setStudentDocuments] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [statusFilter, setStatusFilter] = useState('active');
  const [academicYear, setAcademicYear] = useState('2025-2026');
  const [institute, setInstitute] = useState(demoInstituteSettings);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const currentRoleId = user?.roleId || 'admin';
  const activeModule = getModuleById(activePage);
  const canViewStudents = canAccess(defaultRoles, currentRoleId, 'students.view');
  const canCreateAdmission = canAccess(defaultRoles, currentRoleId, 'students.create');
  const canEditStudents = canAccess(defaultRoles, currentRoleId, 'students.edit');
  const canArchiveStudents = canAccess(defaultRoles, currentRoleId, 'students.archive');
  const accessibleModules = useMemo(() => getEnabledModules()
    .filter((module) => !module.permission || canAccess(defaultRoles, currentRoleId, module.permission)), [currentRoleId]);
  const canOpenActiveModule = activePage === 'reports'
    ? canViewStudents
    : !activeModule?.permission || canAccess(defaultRoles, currentRoleId, activeModule.permission);

  useEffect(() => {
    localStorage.setItem('erpThemeMode', themeMode);
  }, [themeMode]);

  useEffect(() => {
    const currentState = window.history.state || {};
    window.history.replaceState({
      ...currentState,
      studentFlow: currentState.studentFlow || { page: 'dashboard', task: '', branch: '' },
    }, '');

    const handleHistoryBack = (event) => {
      setShowModal(false);
      setEditingStudent(null);
      const flow = event.state?.studentFlow;
      if (!flow) {
        setActivePage('dashboard');
        return;
      }
      setActivePage(flow.page || 'dashboard');
      if (flow.statusFilter) setStatusFilter(flow.statusFilter);
    };

    window.addEventListener('popstate', handleHistoryBack);
    return () => window.removeEventListener('popstate', handleHistoryBack);
  }, []);

  useEffect(() => {
    const isActivePageAllowed = activePage === 'reports'
      ? canViewStudents
      : accessibleModules.some((module) => module.id === activePage);
    if (!isActivePageAllowed) {
      const nextPage = accessibleModules[0]?.id || 'dashboard';
      queueMicrotask(() => setActivePage(nextPage));
    }
  }, [accessibleModules, activePage, canViewStudents]);

  useEffect(() => {
    const loadShellSettings = async () => {
      try {
        const data = await getSettingsData();
        if (data.institute) setInstitute(data.institute);
      } catch (error) {
        console.warn('Using demo institute settings because Firestore is not reachable.', error);
      }
    };
    loadShellSettings();
  }, []);

  useEffect(() => {
    const loadStudentInformation = async () => {
      try {
        const data = await getStudentInformationData(academicYear);
        if (data.students.length || isFirebaseConfigured) {
          setStudents(data.students);
          setSelectedId('');
        }
        setAdmissions(data.admissions);
        setStudentDocuments(data.documents);
        setPromotions(data.promotions);
        setTransfers(data.transfers);
        if (data.admissionBatches?.length) {
          setCourses(data.admissionBatches);
        }
      } catch (error) {
        console.warn('Using demo students because Firestore is not reachable.', error);
        setLoadError('Unable to load Firestore records. Showing demo/local records.');
      }
    };
    loadStudentInformation();
  }, [academicYear]);

  const academicYearOptions = useMemo(() => {
    const years = new Set(['2025-2026', '2026-2027', '2024-2025']);
    [...students, ...admissions, ...studentDocuments, ...promotions, ...transfers].forEach((record) => {
      if (record?.academicYear) years.add(record.academicYear);
    });
    return [...years].sort().reverse();
  }, [admissions, promotions, studentDocuments, students, transfers]);

  const recordBelongsToYear = (record) => record.academicYear === academicYear;
  const yearStudents = useMemo(() => students.filter((student) => student.academicYear === academicYear), [academicYear, students]);
  const courseStudents = useMemo(() => (
    selectedCourseCode === 'all'
      ? yearStudents
      : yearStudents.filter((student) => student.courseCode === selectedCourseCode || student.program === selectedCourseCode)
  ), [selectedCourseCode, yearStudents]);

  const selectedStudent = selectedId ? courseStudents.find((student) => student.id === selectedId) || null : null;
  const selectedAdmissions = admissions.filter((record) => relationMatches(record, selectedStudent) && recordBelongsToYear(record));
  const latestAdmission = latestRecord(selectedAdmissions);

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

    const nextNumber = String(4450 + students.length).padStart(5, '0');
    const selectedAcademicYear = form.academicYear;
    const createdAtText = formatDisplayDate();
    const payload = {
      ...form,
      admissionNo: `ADM-2026-${nextNumber}`,
      studentId: `STU-${nextNumber}`,
      institute: 'COLLEGE NAME',
      academicYear: selectedAcademicYear,
      status: 'Admission Review',
      createdAtText,
    };

    try {
      const id = await createStudent(payload);
      const created = { id: id || `local-${Date.now()}`, ...payload };
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
        status: 'Admission Review',
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
      if (id) {
        const [admissionId, documentId] = await Promise.all([
          createStudentAdmission(admission),
          createStudentDocument(admissionForm),
        ]);
        setAdmissions((prev) => [{ id: admissionId, ...admission }, ...prev]);
        setStudentDocuments((prev) => [{ id: documentId, ...admissionForm }, ...prev]);
      } else {
        setAdmissions((prev) => [{ id: `local-admission-${Date.now()}`, ...admission }, ...prev]);
        setStudentDocuments((prev) => [{ id: `local-document-${Date.now()}`, ...admissionForm }, ...prev]);
      }

      setStudents((prev) => [created, ...prev]);
      setAcademicYear(selectedAcademicYear);
      setSelectedId(created.id);
      toast.success(id ? 'Student admission saved' : 'Student added locally. Add Firebase keys to persist.');
    } catch {
      const local = { id: `local-${Date.now()}`, ...payload };
      const admission = {
        id: `local-admission-${Date.now()}`,
        studentRecordId: local.id,
        studentId: local.studentId,
        admissionNo: local.admissionNo,
        academicYear: selectedAcademicYear,
        idHolder: local.idHolder,
        courseCode: local.courseCode,
        courseName: local.courseName,
        courseYear: local.courseYear,
        admissionType: local.admissionType,
        collegeName: local.collegeName,
        collegeCode: local.collegeCode,
        admissionDate: local.admissionDate,
        seatType: local.seatType,
        actualCategory: local.actualCategory,
        status: 'Admission Review',
        submittedAtText: createdAtText,
      };
      const admissionForm = {
        id: `local-document-${Date.now()}`,
        studentRecordId: local.id,
        studentId: local.studentId,
        documentType: 'Admission Form',
        academicYear: selectedAcademicYear,
        uploadedBy: user?.name || 'Admin',
        fileName: `${local.admissionNo}-admission-form.pdf`,
        verificationStatus: 'Pending Review',
        uploadedAtText: createdAtText,
      };
      setStudents((prev) => [local, ...prev]);
      setAcademicYear(selectedAcademicYear);
      setAdmissions((prev) => [admission, ...prev]);
      setStudentDocuments((prev) => [admissionForm, ...prev]);
      setSelectedId(local.id);
      toast.success('Student added locally. Check Firebase setup to persist it.');
    } finally {
      setShowModal(false);
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

    const updates = {
      ...form,
      updatedAtText: formatDisplayDate(),
    };

    try {
      await updateStudent(editingStudent.id, updates);
      setStudents((prev) => prev.map((student) => (
        student.id === editingStudent.id ? { ...student, ...updates } : student
      )));
      toast.success('Student profile updated');
    } catch {
      setStudents((prev) => prev.map((student) => (
        student.id === editingStudent.id ? { ...student, ...updates } : student
      )));
      toast.success('Student profile updated locally. Check Firebase setup to persist it.');
    } finally {
      setEditingStudent(null);
    }
  };

  const archiveSelectedStudent = async (student) => {
    if (!canArchiveStudents) {
      toast.error('You do not have permission to archive student records.');
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
      setStudents((prev) => prev.map((item) => (
        item.id === student.id ? { ...item, ...updates } : item
      )));
      const nextStudent = students.find((item) => item.id !== student.id && item.status !== 'Archived');
      if (selectedId === student.id && nextStudent) setSelectedId(nextStudent.id);
      toast.success('Student archived locally. Check Firebase setup to persist it.');
    }
  };

  const restoreArchivedStudent = async (student) => {
    if (!canArchiveStudents) {
      toast.error('You do not have permission to restore student records.');
      return;
    }

    const restoredAtText = formatDisplayDate();
    const updates = { status: 'Active', restoredAtText };

    try {
      await restoreStudent(student.id, { restoredAtText });
      setStudents((prev) => prev.map((item) => (
        item.id === student.id ? { ...item, ...updates } : item
      )));
      setSelectedId(student.id);
      setStatusFilter('active');
      toast.success('Student restored');
    } catch {
      setStudents((prev) => prev.map((item) => (
        item.id === student.id ? { ...item, ...updates } : item
      )));
      setSelectedId(student.id);
      setStatusFilter('active');
      toast.success('Student restored locally. Check Firebase setup to persist it.');
    }
  };

  return (
    <div className={`erp-shell ${themeMode === 'light' ? 'light-mode' : ''} min-h-screen bg-white text-slate-900`}>
        <div className="flex min-h-screen">
          <Sidebar
            activePage={activePage}
            collapsed={sidebarCollapsed}
            currentUser={user}
            institute={institute}
            onNavigate={setActivePage}
            onThemeToggle={() => setThemeMode((prev) => (prev === 'dark' ? 'light' : 'dark'))}
            themeMode={themeMode}
          />
          <main className="flex-1 min-w-0 bg-[#f0f1f3] flex flex-col">
            <TopHeader
              academicYear={academicYear}
              academicYears={academicYearOptions}
              courseCode={selectedCourseCode}
              courses={courses}
              institute={institute}
              onAcademicYearChange={setAcademicYear}
              onCourseChange={(courseCode) => {
                setSelectedCourseCode(courseCode);
                setSelectedId('');
              }}
              onMenuToggle={() => setSidebarCollapsed((prev) => !prev)}
              onNavigate={setActivePage}
              user={{ ...user, selectedCollege: { ...user?.selectedCollege, name: institute.name, code: institute.instituteId || institute.code } }}
              onLogout={onLogout}
            />

            <div className="flex-1 p-4 lg:p-5">
              <section className="erp-workspace bg-white min-h-full p-5 lg:p-7">
                {!canOpenActiveModule ? (
                  <div className="rounded-lg bg-[#f5f5f6] p-6 text-sm text-slate-600">
                    You do not have permission to open this module.
                  </div>
                ) : activePage === 'dashboard' ? (
                  <DashboardManagement academicYear={academicYear} currentUser={user} onNavigate={setActivePage} />
                ) : activePage === 'students' ? (
                <>
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                  <div>
                    <div className="text-sm font-bold text-slate-500 mb-2">Academics / <span className="text-[#f39a5f]">Student Information Management</span></div>
                    <h1 className="text-2xl font-bold text-slate-900">Student Information Management</h1>
                    <p className="text-sm text-slate-500 mt-1">List of all students. Click a student to view information and edit details.</p>
                    {!isFirebaseConfigured && <p className="text-xs text-orange-600 mt-2">Demo mode: add Firebase keys to persist records.</p>}
                    {loadError && <p className="text-xs text-rose-600 mt-2">{loadError}</p>}
                  </div>
                </div>

                <>
                <div className="erp-branch-focus flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5 rounded-lg bg-[#f5f5f6] p-5 border border-slate-100">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="erp-branch-icon h-16 w-16 rounded-lg bg-white text-[#fb8d49] flex items-center justify-center shrink-0">
                      <Users size={28} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-500">Students</div>
                      <h2 className="text-2xl font-extrabold text-slate-900 mt-1">
                        {selectedCourseCode === 'all' ? 'All Students' : courses.find((course) => course.courseCode === selectedCourseCode)?.courseName || 'Selected Course'}
                      </h2>
                      <p className="text-sm text-slate-500 mt-1">Click any student name to display full admission information.</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="h-10 px-4 rounded-full bg-white border border-slate-200 text-slate-700 font-bold text-xs flex items-center">
                      Student list
                    </span>
                  </div>
                </div>

                <div className="flex flex-col xl:flex-row gap-5">
                  <div className={`${selectedStudent ? 'xl:w-[34%]' : 'xl:w-full'} min-w-0 transition-all duration-300`}>
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
                        ['active', 'Active Records'],
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
                      onSelect={setSelectedId}
                      onEdit={setEditingStudent}
                      onDownload={(student) => toast.success(`${student.name} record downloaded`)}
                      onArchive={archiveSelectedStudent}
                      onRestore={restoreArchivedStudent}
                    />
                  </div>

                  {selectedStudent && (
                  <aside className="xl:w-[66%]">
                      <div key={selectedStudent.id} className="erp-selected-detail">
                    <StudentProfileCard canEdit={canEditStudents} student={selectedStudent} onEdit={setEditingStudent} />

                    <div className="bg-white border border-slate-100 rounded-lg p-5 shadow-sm">
                      <h3 className="font-bold mb-4">Student Timeline</h3>
                      <div className="grid sm:grid-cols-3 gap-3 text-sm text-slate-600">
                        <div className="rounded-lg bg-[#f5f5f6] p-3">
                          Admission status: {latestAdmission?.status || selectedStudent.status}. Created on {selectedStudent.createdAtText || latestAdmission?.submittedAtText || 'today'}.
                        </div>
                        <div className="rounded-lg bg-[#f5f5f6] p-3">Documents available: {selectedStudent.documents?.length || 0}</div>
                        <div className="rounded-lg bg-[#f5f5f6] p-3">Payment and attendance summaries stay linked to their own modules.</div>
                      </div>
                    </div>
                      </div>
                  </aside>
                  )}
                </div>
                </>
                </>
                ) : activePage === 'reports' ? (
                  <StudentReportView
                    academicYear={academicYear}
                    students={courseStudents}
                    admissions={admissions.filter((item) => item.academicYear === academicYear)}
                    documents={studentDocuments.filter((item) => item.academicYear === academicYear)}
                    promotions={promotions.filter((item) => item.academicYear === academicYear)}
                    onBack={() => setActivePage('students')}
                  />
                ) : activePage === 'faculty-staff' ? (
                  <FacultyStaffManagement currentUser={user} academicYear={academicYear} />
                ) : activePage === 'academics' ? (
                  <AcademicsManagement currentUser={user} academicYear={academicYear} />
                ) : activePage === 'calendar' ? (
                  <CurriculumManagement currentUser={user} academicYear={academicYear} />
                ) : activePage === 'attendance' ? (
                  <AttendanceManagement currentUser={user} academicYear={academicYear} />
                ) : activePage === 'timetable' ? (
                  <TimetableManagement currentUser={user} academicYear={academicYear} />
                ) : activePage === 'examination-results' ? (
                  <ExaminationResultManagement currentUser={user} academicYear={academicYear} />
                ) : activePage === 'fees' ? (
                  <FeesManagement currentUser={user} academicYear={academicYear} />
                ) : activePage === 'financial-reports' ? (
                  <FinancialReports currentUser={user} academicYear={academicYear} />
                ) : activePage === 'notice-board' ? (
                  <NoticeBoardManagement currentUser={user} academicYear={academicYear} />
                ) : activePage === 'document-management' ? (
                  <DocumentManagement currentUser={user} academicYear={academicYear} />
                ) : activePage === 'parent-portal' ? (
                  <ParentPortal currentUser={user} academicYear={academicYear} />
                ) : activePage === 'user-roles' ? (
                  <UserRoleManagement currentUser={user} />
                ) : activePage === 'settings' ? (
                  <SettingsManagement currentUser={user} />
                ) : (
                  <DemoModulePage page={activePage} onOpenStudents={() => setActivePage('students')} />
                )}
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
          courses={courses}
          initialAcademicYear={academicYear}
          initialCourseCode={selectedCourseCode === 'all' ? courses[0]?.courseCode : selectedCourseCode}
          onClose={() => setShowModal(false)}
          onSave={saveStudent}
        />
      )}
      {editingStudent && (
        <StudentModal
          mode="edit"
          academicYearOptions={academicYearOptions}
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



