import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle,
  Download,
  Edit3,
  Eye,
  FileText,
  GraduationCap,
  IdCard,
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
  createStudentIdCard,
  createStudentPromotion,
  createStudentTransfer,
  updateStudentDocument,
  getStudentInformationData,
  archiveStudent,
  restoreStudent,
  updateStudent,
} from '../../firebase/db';
import { isFirebaseConfigured } from '../../firebase/config';
import { uploadStudentDocumentFile } from '../../firebase/storage';
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

const tabs = [
  { id: 'admissions', label: 'Admissions', icon: <Plus size={15} /> },
  { id: 'profiles', label: 'Profiles', icon: <UserRound size={15} /> },
  { id: 'documents', label: 'Documents', icon: <FileText size={15} /> },
  { id: 'ids', label: 'ID Cards', icon: <IdCard size={15} /> },
  { id: 'promotion', label: 'Promotion & Transfer', icon: <GraduationCap size={15} /> },
];
export default function StudentInformationManagement({ user, onLogout }) {
  const [students, setStudents] = useState(demoStudents);
  const [activePage, setActivePage] = useState('dashboard');
  const [activeTab, setActiveTab] = useState('admissions');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(demoStudents[0].id);
  const [admissions, setAdmissions] = useState([]);
  const [studentDocuments, setStudentDocuments] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [idCards, setIdCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [statusFilter, setStatusFilter] = useState('active');
  const [documentUploading, setDocumentUploading] = useState(false);
  const [promotionDraft, setPromotionDraft] = useState({ toClass: '', reason: '' });
  const documentInputRef = useRef(null);

  useEffect(() => {
    const loadStudentInformation = async () => {
      try {
        const data = await getStudentInformationData();
        if (data.students.length) {
          setStudents(data.students);
          setSelectedId(data.students[0].id);
        }
        setAdmissions(data.admissions);
        setStudentDocuments(data.documents);
        setPromotions(data.promotions);
        setTransfers(data.transfers);
        setIdCards(data.idCards);
      } catch (error) {
        console.warn('Using demo students because Firestore is not reachable.', error);
        setLoadError('Unable to load Firestore records. Showing demo/local records.');
      } finally {
        setLoading(false);
      }
    };
    loadStudentInformation();
  }, []);

  const selectedStudent = students.find((student) => student.id === selectedId) || students[0];
  const suggestedPromotionClass = getNextClassName(selectedStudent?.className || '');
  const selectedAdmissions = admissions.filter((record) => relationMatches(record, selectedStudent));
  const selectedDocuments = studentDocuments.filter((record) => relationMatches(record, selectedStudent));
  const selectedPromotions = promotions.filter((record) => relationMatches(record, selectedStudent));
  const selectedTransfers = transfers.filter((record) => relationMatches(record, selectedStudent));
  const selectedIdCards = idCards.filter((record) => relationMatches(record, selectedStudent));
  const latestAdmission = latestRecord(selectedAdmissions);
  const latestPromotion = latestRecord(selectedPromotions);
  const latestTransfer = latestRecord(selectedTransfers);
  const latestIdCard = latestRecord(selectedIdCards);
  const selectedDocumentLabels = selectedDocuments.length
    ? selectedDocuments
    : selectedStudent.documents || [];

  const filteredStudents = useMemo(() => {
    const term = search.trim().toLowerCase();
    const visibleStudents = statusFilter === 'archived'
      ? students.filter((student) => student.status === 'Archived')
      : students.filter((student) => student.status !== 'Archived');
    if (!term) return visibleStudents;
    return visibleStudents.filter((student) =>
      [student.name, student.studentId, student.admissionNo, student.className, student.program]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(term))
    );
  }, [search, statusFilter, students]);

  const stats = [
    { label: 'Admissions', value: admissions.length || students.filter((s) => s.status !== 'Archived').length, icon: <Users size={22} /> },
    { label: 'Profiles Completed', value: students.filter((s) => s.status !== 'Archived' && s.email && s.guardianName).length, icon: <UserRound size={22} /> },
    { label: 'Documents Stored', value: studentDocuments.length || students.reduce((sum, s) => sum + (s.documents?.length || 0), 0), icon: <FileText size={22} /> },
    { label: 'Generated IDs', value: idCards.length || students.filter((s) => s.studentId).length, icon: <IdCard size={22} /> },
  ];

  const saveStudent = async (form) => {
    const validationMessage = validateStudentProfile(form);
    if (validationMessage) {
      toast.error(validationMessage);
      return;
    }

    const nextNumber = String(4450 + students.length).padStart(5, '0');
    const createdAtText = formatDisplayDate();
    const payload = {
      ...form,
      admissionNo: `ADM-2026-${nextNumber}`,
      studentId: `STU-${nextNumber}`,
      institute: 'COLLEGE NAME',
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
        academicYear: '2026-2027',
        status: 'Admission Review',
        submittedAtText: createdAtText,
      };
      const admissionForm = {
        studentRecordId: created.id,
        studentId: created.studentId,
        documentType: 'Admission Form',
        fileName: `${created.admissionNo}-admission-form.pdf`,
        verificationStatus: 'Pending Review',
        uploadedAtText: createdAtText,
      };
      const idCard = {
        studentRecordId: created.id,
        studentId: created.studentId,
        cardNumber: created.studentId,
        issuedAtText: createdAtText,
        validUntil: '31 Mar 2027',
        status: 'Ready',
      };

      if (id) {
        const [admissionId, documentId, idCardId] = await Promise.all([
          createStudentAdmission(admission),
          createStudentDocument(admissionForm),
          createStudentIdCard(idCard),
        ]);
        setAdmissions((prev) => [{ id: admissionId, ...admission }, ...prev]);
        setStudentDocuments((prev) => [{ id: documentId, ...admissionForm }, ...prev]);
        setIdCards((prev) => [{ id: idCardId, ...idCard }, ...prev]);
      } else {
        setAdmissions((prev) => [{ id: `local-admission-${Date.now()}`, ...admission }, ...prev]);
        setStudentDocuments((prev) => [{ id: `local-document-${Date.now()}`, ...admissionForm }, ...prev]);
        setIdCards((prev) => [{ id: `local-card-${Date.now()}`, ...idCard }, ...prev]);
      }

      setStudents((prev) => [created, ...prev]);
      setSelectedId(created.id);
      toast.success(id ? 'Student admission saved' : 'Student added locally. Add Firebase keys to persist.');
    } catch {
      const local = { id: `local-${Date.now()}`, ...payload };
      const admission = {
        id: `local-admission-${Date.now()}`,
        studentRecordId: local.id,
        studentId: local.studentId,
        admissionNo: local.admissionNo,
        academicYear: '2026-2027',
        status: 'Admission Review',
        submittedAtText: createdAtText,
      };
      const admissionForm = {
        id: `local-document-${Date.now()}`,
        studentRecordId: local.id,
        studentId: local.studentId,
        documentType: 'Admission Form',
        fileName: `${local.admissionNo}-admission-form.pdf`,
        verificationStatus: 'Pending Review',
        uploadedAtText: createdAtText,
      };
      const idCard = {
        id: `local-card-${Date.now()}`,
        studentRecordId: local.id,
        studentId: local.studentId,
        cardNumber: local.studentId,
        issuedAtText: createdAtText,
        validUntil: '31 Mar 2027',
        status: 'Ready',
      };

      setStudents((prev) => [local, ...prev]);
      setAdmissions((prev) => [admission, ...prev]);
      setStudentDocuments((prev) => [admissionForm, ...prev]);
      setIdCards((prev) => [idCard, ...prev]);
      setSelectedId(local.id);
      toast.success('Student added locally. Check Firebase setup to persist it.');
    } finally {
      setShowModal(false);
    }
  };

  const saveStudentProfile = async (form) => {
    if (!editingStudent) return;
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
        documentType: 'Uploaded Document',
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
        documentType: 'Uploaded Document',
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
      academicYear: '2026-2027',
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
    <div className="min-h-screen bg-white text-slate-900">
        <div className="flex min-h-screen">
          <Sidebar activePage={activePage} onNavigate={setActivePage} />
          <main className="flex-1 min-w-0 bg-[#f0f1f3] flex flex-col">
            <TopHeader user={user} onLogout={onLogout} />

            <div className="flex-1 p-4 lg:p-5">
              <section className="bg-white min-h-full p-5 lg:p-7">
                {activePage === 'dashboard' ? (
                <>
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                  <div>
                    <div className="text-sm font-bold text-slate-500 mb-2">Academics / <span className="text-[#f39a5f]">Student Information Management</span></div>
                    <h1 className="text-2xl font-bold text-slate-900">Student Information Management</h1>
                    <p className="text-sm text-slate-500 mt-1">Admissions, profiles, documents, ID generation, promotion and transfer management.</p>
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
                    <button onClick={() => setShowModal(true)} className="h-10 px-5 rounded-full bg-[#fb9a5b] text-white font-semibold text-sm flex items-center gap-2">
                      <Plus size={16} /> New Admission
                    </button>
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
                      students={filteredStudents}
                      statusFilter={statusFilter}
                      onSelect={setSelectedId}
                      onEdit={setEditingStudent}
                      onDownload={(student) => toast.success(`${student.name} record downloaded`)}
                      onArchive={archiveSelectedStudent}
                      onRestore={restoreArchivedStudent}
                    />
                  </div>

                  <aside className="xl:w-[30%]">
                    <StudentProfileCard student={selectedStudent} onEdit={setEditingStudent} />

                    <div className="bg-white border border-slate-100 rounded-lg p-5 shadow-sm">
                      <h3 className="font-bold mb-4">
                        {activeTab === 'documents' ? 'Document Repository' : activeTab === 'ids' ? 'ID Generation' : activeTab === 'promotion' ? 'Promotion & Transfer' : 'Module Actions'}
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
                        </div>
                      )}
                      {activeTab === 'ids' && (
                        <div className="space-y-4">
                          <div className="rounded-lg bg-[#33373e] text-white p-4">
                            <div className="text-xs opacity-70">Generated Student ID</div>
                            <div className="text-2xl font-bold mt-1">{latestIdCard?.cardNumber || selectedStudent.studentId}</div>
                            <div className="text-xs opacity-70 mt-3">
                              {selectedStudent.name} | {selectedStudent.className} | Valid until {latestIdCard?.validUntil || '31 Mar 2027'}
                            </div>
                          </div>
                          <button
                            onClick={() => toast.success('ID card downloaded')}
                            className="w-full h-10 rounded-full bg-[#33373e] text-white font-semibold text-sm flex items-center justify-center gap-2"
                          >
                            <Download size={16} /> Download ID Card
                          </button>
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
                        </div>
                      )}
                      {!['documents', 'ids', 'promotion'].includes(activeTab) && (
                        <div className="space-y-3 text-sm text-slate-600">
                          <div className="rounded-lg bg-[#f5f5f6] p-3">
                            Admission status: {latestAdmission?.status || selectedStudent.status}. Created on {selectedStudent.createdAtText || latestAdmission?.submittedAtText || 'today'}.
                          </div>
                          <div className="rounded-lg bg-[#f5f5f6] p-3">Profile management keeps guardian, class, contact, and academic details together.</div>
                          <button onClick={() => setShowModal(true)} className="w-full h-10 rounded-full bg-[#fb9a5b] text-white font-semibold">Create Another Admission</button>
                        </div>
                      )}
                    </div>
                  </aside>
                </div>
                </>
                ) : activePage === 'faculty-staff' ? (
                  <FacultyStaffManagement currentUser={user} />
                ) : activePage === 'attendance' ? (
                  <AttendanceManagement currentUser={user} />
                ) : activePage === 'timetable' ? (
                  <TimetableManagement currentUser={user} />
                ) : activePage === 'examination-results' ? (
                  <ExaminationResultManagement currentUser={user} />
                ) : activePage === 'fees' ? (
                  <FeesManagement currentUser={user} />
                ) : activePage === 'financial-reports' ? (
                  <FinancialReports currentUser={user} />
                ) : activePage === 'notice-board' ? (
                  <NoticeBoardManagement currentUser={user} />
                ) : activePage === 'document-management' ? (
                  <DocumentManagement currentUser={user} />
                ) : activePage === 'parent-portal' ? (
                  <ParentPortal currentUser={user} />
                ) : activePage === 'user-roles' ? (
                  <UserRoleManagement currentUser={user} />
                ) : (
                  <DemoModulePage page={activePage} onOpenStudents={() => setActivePage('dashboard')} />
                )}
              </section>
            </div>

            <footer className="h-14 bg-white border-t border-slate-200 px-6 flex items-center justify-between text-xs text-slate-500">
              <span>Copyright © 2026 Devloft Technologies | College ERP</span>
              <div className="hidden sm:flex gap-2">
                {['f', 'x', 'in', 'ig', 'yt'].map((item) => (
                  <span key={item} className="h-7 min-w-7 px-2 rounded-md bg-[#34363d] text-white flex items-center justify-center font-bold">
                    {item}
                  </span>
                ))}
              </div>
            </footer>
          </main>
        </div>
      {showModal && <StudentModal onClose={() => setShowModal(false)} onSave={saveStudent} />}
      {editingStudent && (
        <StudentModal
          mode="edit"
          initialStudent={editingStudent}
          onClose={() => setEditingStudent(null)}
          onSave={saveStudentProfile}
        />
      )}
    </div>
  );
}



