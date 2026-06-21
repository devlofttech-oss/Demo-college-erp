import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle,
  Download,
  Edit3,
  Eye,
  FileText,
  GraduationCap,
  Plus,
  Search,
  Upload,
  UserRound,
  Users,
  XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  createStudent,
  createStudentAdmission,
  createStudentDocument,
  createStudentPromotion,
  createStudentTransfer,
  updateStudentDocument,
  getStudentInformationData,
  getSettingsData,
  archiveStudent,
  restoreStudent,
  updateStudent,
} from '../../firebase/db';
import { isFirebaseConfigured } from '../../firebase/config';
import { uploadStudentDocumentFile } from '../../firebase/storage';
import { getEnabledModules, getModuleById } from '../moduleRegistry';
import { demoStudents } from './demoStudents';
import DemoModulePage from './components/DemoModulePage';
import Sidebar from './components/Sidebar';
import StatusBadge from './components/StatusBadge';
import StudentModal from './components/StudentModal';
import StudentProfileCard from './components/StudentProfileCard';
import StudentStats from './components/StudentStats';
import StudentTable from './components/StudentTable';
import TopHeader from './components/TopHeader';
import { formatDisplayDate, getNextClassName, latestRecord, relationMatches, validateStudentProfile } from './studentUtils';
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

const tabs = [
  { id: 'admissions', label: 'Admissions', icon: <Plus size={15} /> },
  { id: 'profiles', label: 'Profiles', icon: <UserRound size={15} /> },
  { id: 'documents', label: 'Documents', icon: <FileText size={15} /> },
  { id: 'promotion', label: 'Promotion & Transfer', icon: <GraduationCap size={15} /> },
];

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
  const [students, setStudents] = useState(demoStudents);
  const [activePage, setActivePage] = useState('dashboard');
  const [activeTab, setActiveTab] = useState('admissions');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(demoStudents[0].id);
  const [admissions, setAdmissions] = useState([]);
  const [studentDocuments, setStudentDocuments] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [statusFilter, setStatusFilter] = useState('active');
  const [documentUploading, setDocumentUploading] = useState(false);
  const [documentType, setDocumentType] = useState('Admission Form');
  const [academicYear, setAcademicYear] = useState('2026-2027');
  const [institute, setInstitute] = useState(demoInstituteSettings);
  const [promotionDraft, setPromotionDraft] = useState({ toClass: '', reason: '' });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const documentInputRef = useRef(null);
  const currentRoleId = user?.roleId || 'admin';
  const activeModule = getModuleById(activePage);
  const canViewStudents = canAccess(defaultRoles, currentRoleId, 'students.view');
  const canCreateAdmission = canAccess(defaultRoles, currentRoleId, 'students.create');
  const canEditStudents = canAccess(defaultRoles, currentRoleId, 'students.edit');
  const canArchiveStudents = canAccess(defaultRoles, currentRoleId, 'students.archive');
  const canManageStudentDocuments = canAccess(defaultRoles, currentRoleId, 'students.documents');
  const canVerifyStudentDocuments = canAccess(defaultRoles, currentRoleId, 'students.verifyDocuments');
  const canPromoteStudents = canAccess(defaultRoles, currentRoleId, 'students.promote');
  const accessibleModules = useMemo(() => getEnabledModules()
    .filter((module) => !module.permission || canAccess(defaultRoles, currentRoleId, module.permission)), [currentRoleId]);
  const canOpenActiveModule = activePage === 'reports'
    ? canViewStudents
    : !activeModule?.permission || canAccess(defaultRoles, currentRoleId, activeModule.permission);

  useEffect(() => {
    localStorage.setItem('erpThemeMode', themeMode);
  }, [themeMode]);

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
          setSelectedId(data.students[0]?.id || '');
        }
        setAdmissions(data.admissions);
        setStudentDocuments(data.documents);
        setPromotions(data.promotions);
        setTransfers(data.transfers);
      } catch (error) {
        console.warn('Using demo students because Firestore is not reachable.', error);
        setLoadError('Unable to load Firestore records. Showing demo/local records.');
      } finally {
        setLoading(false);
      }
    };
    loadStudentInformation();
  }, [academicYear]);

  const academicYearOptions = useMemo(() => {
    const years = new Set(['2026-2027', '2025-2026', '2024-2025']);
    [...students, ...admissions, ...studentDocuments, ...promotions, ...transfers].forEach((record) => {
      if (record?.academicYear) years.add(record.academicYear);
    });
    return [...years].sort().reverse();
  }, [admissions, promotions, studentDocuments, students, transfers]);

  const recordBelongsToYear = (record) => record.academicYear === academicYear;
  const yearStudents = useMemo(() => students.filter((student) => student.academicYear === academicYear), [academicYear, students]);

  const selectedStudent = yearStudents.find((student) => student.id === selectedId) || yearStudents[0] || null;
  const suggestedPromotionClass = getNextClassName(selectedStudent?.className || '');
  const selectedAdmissions = admissions.filter((record) => relationMatches(record, selectedStudent) && recordBelongsToYear(record));
  const selectedDocuments = studentDocuments.filter((record) => relationMatches(record, selectedStudent) && recordBelongsToYear(record));
  const selectedPromotions = promotions.filter((record) => relationMatches(record, selectedStudent) && recordBelongsToYear(record));
  const selectedTransfers = transfers.filter((record) => relationMatches(record, selectedStudent) && recordBelongsToYear(record));
  const latestAdmission = latestRecord(selectedAdmissions);
  const latestPromotion = latestRecord(selectedPromotions);
  const latestTransfer = latestRecord(selectedTransfers);
  const selectedDocumentLabels = selectedDocuments.length
    ? selectedDocuments
    : selectedStudent?.documents || [];

  const filteredStudents = useMemo(() => {
    const term = search.trim().toLowerCase();
    const visibleStudents = statusFilter === 'archived'
      ? yearStudents.filter((student) => student.status === 'Archived')
      : yearStudents.filter((student) => student.status !== 'Archived');
    if (!term) return visibleStudents;
    return visibleStudents.filter((student) =>
      [student.name, student.studentId, student.admissionNo, student.className, student.program]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(term))
    );
  }, [search, statusFilter, yearStudents]);

  const stats = [
    { label: 'Admissions', value: admissions.filter((item) => item.academicYear === academicYear).length || yearStudents.filter((s) => s.status !== 'Archived').length, icon: <Users size={22} /> },
    { label: 'Profiles Completed', value: yearStudents.filter((s) => s.status !== 'Archived' && s.email && s.guardianName && s.idHolder).length, icon: <UserRound size={22} /> },
    { label: 'Documents Stored', value: studentDocuments.filter((item) => item.academicYear === academicYear).length || yearStudents.reduce((sum, s) => sum + (s.documents?.length || 0), 0), icon: <FileText size={22} /> },
  ];

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

  const uploadDocument = async (event) => {
    if (!canManageStudentDocuments) {
      toast.error('You do not have permission to upload student documents.');
      event.target.value = '';
      return;
    }

    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !selectedStudent) return;

    setDocumentUploading(true);
    const uploadedAtText = formatDisplayDate();
    try {
      const fileData = await uploadStudentDocumentFile({ student: selectedStudent, file });
      const payload = {
        studentRecordId: selectedStudent.id,
        studentId: selectedStudent.studentId,
        documentType: documentType.trim() || 'Uploaded Document',
        academicYear,
        uploadedBy: user?.name || 'Admin',
        verificationStatus: 'Pending Review',
        uploadedAtText,
        ...fileData,
      };
      const id = await createStudentDocument(payload);
      setStudentDocuments((prev) => [{ id: id || `local-document-${Date.now()}`, ...payload }, ...prev]);
      toast.success('Document uploaded');
    } catch {
      const payload = {
        studentRecordId: selectedStudent.id,
        studentId: selectedStudent.studentId,
        documentType: documentType.trim() || 'Uploaded Document',
        academicYear,
        uploadedBy: user?.name || 'Admin',
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type || 'application/octet-stream',
        verificationStatus: 'Pending Review',
        uploadedAtText,
      };
      const id = await createStudentDocument(payload);
      setStudentDocuments((prev) => [{ id: id || `local-document-${Date.now()}`, ...payload }, ...prev]);
      toast.success('Document metadata saved. Check Firebase Storage setup for file upload.');
    } finally {
      setDocumentUploading(false);
    }
  };

  const updateDocumentVerification = async (documentRecord, verificationStatus) => {
    if (typeof documentRecord === 'string') return;
    const updates = {
      verificationStatus,
      verifiedAtText: formatDisplayDate(),
    };

    try {
      await updateStudentDocument(documentRecord.id, updates);
      setStudentDocuments((prev) => prev.map((item) => (
        item.id === documentRecord.id ? { ...item, ...updates } : item
      )));
      toast.success(`Document marked ${verificationStatus.toLowerCase()}`);
    } catch {
      setStudentDocuments((prev) => prev.map((item) => (
        item.id === documentRecord.id ? { ...item, ...updates } : item
      )));
      toast.success(`Document marked ${verificationStatus.toLowerCase()} locally`);
    }
  };

  const promoteStudent = async () => {
    if (!canPromoteStudents) {
      toast.error('You do not have permission to promote or transfer students.');
      return;
    }

    if (!selectedStudent) {
      toast.error('Select a student before promotion.');
      return;
    }
    const fromClass = selectedStudent.className;
    const toClass = promotionDraft.toClass.trim() || suggestedPromotionClass;
    if (!toClass) {
      toast.error('Target class is required.');
      return;
    }
    const actionDateText = formatDisplayDate();
    const updates = { className: toClass };
    const promotion = {
      studentRecordId: selectedStudent.id,
      studentId: selectedStudent.studentId,
      fromClass,
      toClass,
      academicYear,
      status: 'Promoted',
      approvedBy: 'Academic Office',
      approvedAtText: actionDateText,
    };
    const transfer = {
      studentRecordId: selectedStudent.id,
      studentId: selectedStudent.studentId,
      transferType: 'Internal Class Transfer',
      reason: promotionDraft.reason.trim() || `Promoted from ${fromClass} to ${toClass}`,
      status: 'Not Requested',
      academicYear,
      requestedAtText: actionDateText,
      certificateUrl: '',
    };

    setStudents((prev) => prev.map((student) => student.id === selectedStudent.id ? { ...student, ...updates } : student));
    try {
      const [promotionId, transferId] = await Promise.all([
        createStudentPromotion(promotion),
        createStudentTransfer(transfer),
        updateStudent(selectedStudent.id, updates),
      ]);
      setPromotions((prev) => [{ id: promotionId || `local-promotion-${Date.now()}`, ...promotion }, ...prev]);
      setTransfers((prev) => [{ id: transferId || `local-transfer-${Date.now()}`, ...transfer }, ...prev]);
      toast.success('Promotion status updated');
    } catch {
      setPromotions((prev) => [{ id: `local-promotion-${Date.now()}`, ...promotion }, ...prev]);
      setTransfers((prev) => [{ id: `local-transfer-${Date.now()}`, ...transfer }, ...prev]);
      toast.success('Promotion updated locally. Check Firebase setup to persist it.');
    } finally {
      setPromotionDraft({ toClass: getNextClassName(toClass), reason: '' });
    }
  };

  return (
    <div className={`erp-shell ${themeMode === 'light' ? 'light-mode' : ''} min-h-screen bg-white text-slate-900`}>
        <div className="flex min-h-screen">
          <Sidebar activePage={activePage} collapsed={sidebarCollapsed} currentUser={user} institute={institute} onNavigate={setActivePage} />
          <main className="flex-1 min-w-0 bg-[#f0f1f3] flex flex-col">
            <TopHeader
              academicYear={academicYear}
              academicYears={academicYearOptions}
              institute={institute}
              onAcademicYearChange={setAcademicYear}
              onMenuToggle={() => setSidebarCollapsed((prev) => !prev)}
              onNavigate={setActivePage}
              onThemeToggle={() => setThemeMode((prev) => (prev === 'dark' ? 'light' : 'dark'))}
              themeMode={themeMode}
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
                <>
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                  <div>
                    <div className="text-sm font-bold text-slate-500 mb-2">Academics / <span className="text-[#f39a5f]">Student Information Management</span></div>
                    <h1 className="text-2xl font-bold text-slate-900">Student Information Management</h1>
                    <p className="text-sm text-slate-500 mt-1">Admissions, profiles, documents, promotion and transfer management.</p>
                    {!isFirebaseConfigured && <p className="text-xs text-orange-600 mt-2">Demo mode: add Firebase keys to persist records.</p>}
                    {loadError && <p className="text-xs text-rose-600 mt-2">{loadError}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setActivePage('reports')}
                      className="h-10 px-5 rounded-lg bg-[#33373e] text-white font-semibold text-sm flex items-center gap-2"
                    >
                      <Eye size={16} /> View Report
                    </button>
                    {canCreateAdmission && (
                      <button onClick={() => setShowModal(true)} className="h-10 px-5 rounded-full bg-[#fb9a5b] text-white font-semibold text-sm flex items-center gap-2">
                        <Plus size={16} /> New Admission
                      </button>
                    )}
                  </div>
                </div>

                <StudentStats loading={loading} stats={stats} />

                <div className="flex flex-col xl:flex-row gap-5">
                  <div className="xl:w-[70%] min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-5">
                      {tabs.map(({ id, label, icon }) => (
                        <button
                          key={id}
                          onClick={() => setActiveTab(id)}
                          className={`h-10 px-4 rounded-md border text-sm flex items-center gap-2 ${
                            activeTab === id
                              ? 'bg-[#33373e] text-white border-[#33373e]'
                              : 'bg-white text-slate-600 border-slate-200'
                          }`}
                        >
                          {icon} {label}
                        </button>
                      ))}
                    </div>

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

                  <aside className="xl:w-[30%]">
                    {selectedStudent ? (
                      <>
                    <StudentProfileCard canEdit={canEditStudents} student={selectedStudent} onEdit={setEditingStudent} />

                    <div className="bg-white border border-slate-100 rounded-lg p-5 shadow-sm">
                      <h3 className="font-bold mb-4">
                        {activeTab === 'documents' ? 'Document Repository' : activeTab === 'promotion' ? 'Promotion & Transfer' : 'Module Actions'}
                      </h3>
                      {activeTab === 'documents' && (
                        <div className="space-y-3">
                          {selectedDocumentLabels.map((item) => {
                            const label = typeof item === 'string' ? item : item.fileName || item.documentType || 'Student Document';
                            const status = typeof item === 'string' ? 'Active' : item.verificationStatus || 'Pending Review';
                            return (
                            <div key={label} className="rounded-lg bg-[#f5f5f6] px-3 py-2 text-sm">
                              <div className="flex items-center justify-between gap-3">
                                <span className="flex items-center gap-2 min-w-0">
                                  <FileText size={16} className="shrink-0" />
                                  <span className="truncate">{label}</span>
                                </span>
                                <StatusBadge value={status} />
                              </div>
                              {typeof item !== 'string' && (
                                <div className="flex items-center gap-2 mt-2">
                                  {item.fileUrl && (
                                    <a
                                      href={item.fileUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="h-8 px-3 rounded-md bg-white border border-slate-200 text-xs font-semibold flex items-center gap-1"
                                    >
                                      <Download size={13} /> Open
                                    </a>
                                  )}
                                  {canVerifyStudentDocuments && (
                                    <>
                                      <button
                                        onClick={() => updateDocumentVerification(item, 'Verified')}
                                        className="h-8 px-3 rounded-md bg-white border border-emerald-200 text-emerald-700 text-xs font-semibold flex items-center gap-1"
                                      >
                                        <CheckCircle size={13} /> Verify
                                      </button>
                                      <button
                                        onClick={() => updateDocumentVerification(item, 'Rejected')}
                                        className="h-8 px-3 rounded-md bg-white border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-1"
                                      >
                                        <XCircle size={13} /> Reject
                                      </button>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                            );
                          })}
                          {!selectedDocumentLabels.length && (
                            <div className="rounded-lg bg-[#f5f5f6] px-3 py-4 text-sm text-slate-500">
                              No documents uploaded for this student yet.
                            </div>
                          )}
                          {canManageStudentDocuments && (
                            <>
                              <label className="block">
                                <span className="text-xs font-semibold text-slate-500 mb-1.5 block">Document Type</span>
                                <input
                                  value={documentType}
                                  onChange={(event) => setDocumentType(event.target.value)}
                                  placeholder="Aadhaar Card, Transfer Certificate, Marks Card..."
                                  className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-[#fb9a5b] focus:ring-2 focus:ring-orange-100"
                                />
                              </label>
                              <input
                                ref={documentInputRef}
                                type="file"
                                className="hidden"
                                onChange={uploadDocument}
                              />
                              <button
                                onClick={() => documentInputRef.current?.click()}
                                disabled={documentUploading}
                                className="w-full h-10 rounded-full bg-[#fb9a5b] text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:bg-slate-300 disabled:cursor-not-allowed"
                              >
                                <Upload size={16} /> {documentUploading ? 'Uploading...' : 'Upload Document'}
                              </button>
                            </>
                          )}
                        </div>
                      )}
                      {activeTab === 'promotion' && (
                        <div className="space-y-3 text-sm">
                          <div className="flex items-center justify-between h-11 rounded-lg bg-[#f5f5f6] px-3">
                            <span>Promotion Status</span>
                            <StatusBadge value={latestPromotion?.status || selectedStudent.promotionStatus || 'Pending Review'} />
                          </div>
                          <div className="flex items-center justify-between h-11 rounded-lg bg-[#f5f5f6] px-3">
                            <span>Transfer Status</span>
                            <StatusBadge value={latestTransfer?.status || selectedStudent.transferStatus || 'Not Requested'} />
                          </div>
                          {canPromoteStudents && (
                            <>
                              <label className="block">
                                <span className="text-xs font-semibold text-slate-500 mb-1.5 block">Promote To</span>
                                <input
                                  value={promotionDraft.toClass || suggestedPromotionClass}
                                  onChange={(event) => setPromotionDraft((prev) => ({ ...prev, toClass: event.target.value }))}
                                  className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-[#fb9a5b] focus:ring-2 focus:ring-orange-100"
                                />
                              </label>
                              <label className="block">
                                <span className="text-xs font-semibold text-slate-500 mb-1.5 block">Reason / Note</span>
                                <textarea
                                  value={promotionDraft.reason}
                                  onChange={(event) => setPromotionDraft((prev) => ({ ...prev, reason: event.target.value }))}
                                  className="w-full min-h-20 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#fb9a5b] focus:ring-2 focus:ring-orange-100"
                                  placeholder={`Promoted from ${selectedStudent.className}`}
                                />
                              </label>
                              <button onClick={promoteStudent} className="w-full h-10 rounded-full bg-[#fb9a5b] text-white font-semibold">
                                Promote / Update Transfer
                              </button>
                            </>
                          )}
                        </div>
                      )}
                      {!['documents', 'promotion'].includes(activeTab) && (
                        <div className="space-y-3 text-sm text-slate-600">
                          <div className="rounded-lg bg-[#f5f5f6] p-3">
                            Admission status: {latestAdmission?.status || selectedStudent.status}. Created on {selectedStudent.createdAtText || latestAdmission?.submittedAtText || 'today'}.
                          </div>
                          <div className="rounded-lg bg-[#f5f5f6] p-3">Profile management keeps guardian, class, contact, and academic details together.</div>
                          {canCreateAdmission && (
                            <button onClick={() => setShowModal(true)} className="w-full h-10 rounded-full bg-[#fb9a5b] text-white font-semibold">Create Another Admission</button>
                          )}
                        </div>
                      )}
                    </div>
                      </>
                    ) : (
                      <div className="bg-white border border-slate-100 rounded-lg p-5 shadow-sm text-sm text-slate-600">
                        <h3 className="font-bold text-slate-900 mb-2">No Students Found</h3>
                        <p>No student records are available for academic year {academicYear}.</p>
                        {canCreateAdmission && (
                          <button onClick={() => setShowModal(true)} className="mt-4 w-full h-10 rounded-full bg-[#fb9a5b] text-white font-semibold">
                            New Admission
                          </button>
                        )}
                      </div>
                    )}
                  </aside>
                </div>
                </>
                ) : activePage === 'reports' ? (
                  <StudentReportView
                    academicYear={academicYear}
                    students={yearStudents}
                    admissions={admissions.filter((item) => item.academicYear === academicYear)}
                    documents={studentDocuments.filter((item) => item.academicYear === academicYear)}
                    promotions={promotions.filter((item) => item.academicYear === academicYear)}
                    onBack={() => setActivePage('dashboard')}
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
                  <DemoModulePage page={activePage} onOpenStudents={() => setActivePage('dashboard')} />
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
      {showModal && <StudentModal academicYearOptions={academicYearOptions} initialAcademicYear={academicYear} onClose={() => setShowModal(false)} onSave={saveStudent} />}
      {editingStudent && (
        <StudentModal
          mode="edit"
          academicYearOptions={academicYearOptions}
          initialAcademicYear={academicYear}
          initialStudent={editingStudent}
          onClose={() => setEditingStudent(null)}
          onSave={saveStudentProfile}
        />
      )}
    </div>
  );
}



