import { useEffect, useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  archiveManagedDocument,
  createManagedDocument,
  getDocumentManagementData,
  updateManagedDocument,
} from '../../firebase/db';
import { isFirebaseConfigured } from '../../firebase/config';
import { uploadManagedDocumentFile } from '../../firebase/storage';
import { canAccess, defaultRoles } from '../userRoles/rolePermissions';
import { demoDocumentStaff, demoDocumentStudents, demoManagedDocuments } from './demoDocuments';
import { documentCategories, documentOwnerTypes, documentStatuses, filterDocuments, formatDisplayDate, resolveOwnerName, validateDocumentForm } from './documentUtils';
import DocumentPreviewPanel from './components/DocumentPreviewPanel';
import DocumentTable from './components/DocumentTable';
import DocumentUploadModal from './components/DocumentUploadModal';
import { filterStudentScopedRecords, filterStudentsByCourse } from '../shared/courseFilters';

export default function DocumentManagement({ currentUser, academicYear = '2026-2027', ownerFilter = null, scopedStudents = [], selectedCourse = null, selectedCourseCode = 'all' }) {
  const [students, setStudents] = useState(isFirebaseConfigured ? [] : demoDocumentStudents);
  const [staff, setStaff] = useState(isFirebaseConfigured ? [] : demoDocumentStaff);
  const [documents, setDocuments] = useState(isFirebaseConfigured ? [] : demoManagedDocuments);
  const [selectedId, setSelectedId] = useState('');
  const [filters, setFilters] = useState({ search: '', ownerType: '', category: '', status: '' });
  const [clearedOwnerFilterKey, setClearedOwnerFilterKey] = useState('');
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [loadError, setLoadError] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const loadDocuments = async () => {
      if (!isFirebaseConfigured) return;
      try {
        const data = await getDocumentManagementData(academicYear);
        if (data.students.length) setStudents(data.students.filter((student) => student.status !== 'Archived'));
        if (data.staff.length) setStaff(data.staff.filter((member) => member.status !== 'Archived'));
        setDocuments(data.managedDocuments);
        setSelectedId('');
      } catch (error) {
        console.warn('Using demo documents because Firestore is not reachable.', error);
        setLoadError('Unable to load Firestore document records. Showing demo/local records.');
      } finally {
        setLoading(false);
      }
    };
    loadDocuments();
  }, [academicYear]);

  const currentRoleId = currentUser?.roleId || 'admin';
  const canUpload = canAccess(defaultRoles, currentRoleId, 'documents.upload');
  const canVerify = canAccess(defaultRoles, currentRoleId, 'documents.verify');
  const canArchive = canAccess(defaultRoles, currentRoleId, 'documents.archive');
  const courseStudents = scopedStudents.length ? scopedStudents : filterStudentsByCourse(students, selectedCourseCode, selectedCourse);
  const ownerFilterKey = ownerFilter
    ? [ownerFilter.ownerType, ownerFilter.ownerRecordId, ownerFilter.ownerId].join('|')
    : '';
  const isOwnerFilterActive = Boolean(ownerFilter && clearedOwnerFilterKey !== ownerFilterKey);

  const routedDocuments = useMemo(() => (ownerFilter?.documents || []).map((item, index) => ({
    id: item.id || `routed-document-${index}`,
    ownerType: ownerFilter.ownerType || item.ownerType || '',
    ownerRecordId: ownerFilter.ownerRecordId || item.ownerRecordId || item.studentRecordId || item.staffRecordId || '',
    ownerId: ownerFilter.ownerId || item.ownerId || item.studentId || item.employeeId || '',
    ownerName: ownerFilter.ownerName || item.ownerName || '',
    archiveTitle: item.archiveTitle || '',
    documentType: item.documentType || item.type || 'Uploaded Document',
    category: item.category || (ownerFilter.ownerType === 'Staff' ? 'HR' : 'Admission'),
    tags: item.tags || '',
    verificationStatus: item.verificationStatus || item.status || 'Pending Review',
    uploadedAtText: item.uploadedAtText || item.createdAtText || item.submittedAtText || '-',
    verifiedAtText: item.verifiedAtText || '',
    fileName: item.fileName || item.documentFileName || '',
    fileSize: item.fileSize || item.documentFileSize || 0,
    fileType: item.fileType || item.documentFileType || 'application/octet-stream',
    fileUrl: item.fileUrl || item.documentFileUrl || item.documentUrl || '',
    storagePath: item.storagePath || '',
  })), [ownerFilter]);
  const allDocuments = useMemo(() => {
    const existingIds = new Set(documents.map((item) => item.id));
    return [...documents, ...routedDocuments.filter((item) => !existingIds.has(item.id))];
  }, [documents, routedDocuments]);
  const courseDocuments = useMemo(
    () => filterStudentScopedRecords(allDocuments, courseStudents, selectedCourseCode, selectedCourse),
    [allDocuments, courseStudents, selectedCourse, selectedCourseCode]
  );
  const activeFilters = useMemo(() => ({
    ...filters,
    ...(isOwnerFilterActive ? {
      ownerId: ownerFilter.ownerId || '',
      ownerRecordId: ownerFilter.ownerRecordId || '',
      ownerType: ownerFilter.ownerType || '',
    } : {}),
  }), [filters, isOwnerFilterActive, ownerFilter]);
  const visibleDocuments = useMemo(() => filterDocuments(courseDocuments, activeFilters), [activeFilters, courseDocuments]);
  const normalizedDocuments = useMemo(() => visibleDocuments.map((item) => ({
    ...item,
    ownerName: resolveOwnerName(item, students, staff),
  })), [staff, students, visibleDocuments]);
  const selectedDocumentId = normalizedDocuments.some((item) => item.id === selectedId)
    ? selectedId
    : (isOwnerFilterActive ? normalizedDocuments[0]?.id || '' : '');
  const selectedDocument = selectedDocumentId ? normalizedDocuments.find((item) => item.id === selectedDocumentId) || null : null;

  const buildDocumentPayload = (form, fileData = {}) => {
    const ownerList = form.ownerType === 'Student' ? courseStudents : staff;
    const owner = ownerList.find((item) => item.id === form.ownerRecordId);
    const ownerId = form.ownerType === 'Student' ? owner?.studentId : owner?.employeeId;
    const courseCode = form.ownerType === 'Student'
      ? owner?.courseCode || selectedCourseCode
      : selectedCourseCode === 'all' ? '' : selectedCourseCode;
    const courseName = form.ownerType === 'Student'
      ? owner?.courseName || owner?.program || selectedCourse?.courseName || ''
      : selectedCourse?.courseName || '';
    return {
      ownerType: form.ownerType,
      ownerRecordId: form.ownerRecordId,
      ownerId: form.ownerType === 'Academic Archive' ? `ARCHIVE-${Date.now()}` : ownerId || '',
      ownerName: form.ownerType === 'Academic Archive' ? 'Academic Records Archive' : owner?.name || '',
      archiveTitle: form.archiveTitle?.trim() || '',
      documentType: form.documentType.trim(),
      category: form.category,
      courseCode,
      courseName,
      tags: form.tags.trim(),
      verificationStatus: 'Pending Review',
      uploadedAtText: formatDisplayDate(),
      verifiedAtText: '',
      ...fileData,
    };
  };

  const saveDocument = async (form, file) => {
    if (!canUpload) {
      toast.error('You do not have permission to upload documents.');
      return;
    }
    const validationMessage = validateDocumentForm(form);
    if (validationMessage) {
      toast.error(validationMessage);
      return;
    }
    setUploading(true);
    let fileData = {};
    let uploadError = null;
    try {
      const ownerKey = form.ownerType === 'Academic Archive'
        ? form.archiveTitle
        : form.ownerRecordId;
      if (file) {
        fileData = await uploadManagedDocumentFile({ ownerType: form.ownerType, ownerId: ownerKey, file });
      }
    } catch (error) {
      uploadError = error;
      fileData = file ? {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type || 'application/octet-stream',
        fileUrl: '',
        storagePath: '',
      } : {};
    }

    const payload = { ...buildDocumentPayload(form, fileData), academicYear };
    try {
      const id = await createManagedDocument(payload);
      const created = { id: id || `local-document-${Date.now()}`, ...payload };
      setDocuments((prev) => [created, ...prev]);
      setSelectedId(created.id);
      toast.success(uploadError ? 'Document metadata saved. File upload is unavailable.' : id ? 'Document saved' : 'Document saved locally');
    } catch {
      const created = { id: `local-document-${Date.now()}`, ...payload };
      setDocuments((prev) => [created, ...prev]);
      setSelectedId(created.id);
      toast.success('Document saved locally. Check Firebase setup to persist it.');
    } finally {
      setUploading(false);
      setShowUploadModal(false);
    }
  };

  const updateVerification = async (document, verificationStatus) => {
    if (!canVerify) {
      toast.error('You do not have permission to verify documents.');
      return;
    }
    const updates = {
      verificationStatus,
      verifiedAtText: formatDisplayDate(),
    };
    try {
      await updateManagedDocument(document.id, updates);
      setDocuments((prev) => prev.map((item) => item.id === document.id ? { ...item, ...updates } : item));
      toast.success(`Document marked ${verificationStatus.toLowerCase()}`);
    } catch {
      setDocuments((prev) => prev.map((item) => item.id === document.id ? { ...item, ...updates } : item));
      toast.success(`Document marked ${verificationStatus.toLowerCase()} locally`);
    }
  };

  const archiveDocument = async (document) => {
    if (!canArchive) {
      toast.error('You do not have permission to archive documents.');
      return;
    }
    const updates = {
      verificationStatus: 'Archived',
      archivedAtText: formatDisplayDate(),
    };
    try {
      await archiveManagedDocument(document.id, updates);
      setDocuments((prev) => prev.map((item) => item.id === document.id ? { ...item, ...updates } : item));
      toast.success('Document archived');
    } catch {
      setDocuments((prev) => prev.map((item) => item.id === document.id ? { ...item, ...updates } : item));
      toast.success('Document archived locally');
    }
  };

  const updateFilter = (key, value) => {
    if (key === 'ownerType' && ownerFilterKey) setClearedOwnerFilterKey(ownerFilterKey);
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      ...(key === 'ownerType' ? { ownerId: '', ownerRecordId: '' } : {}),
    }));
  };

  const clearOwnerFilter = () => {
    setClearedOwnerFilterKey(ownerFilterKey);
    setFilters((prev) => ({ ...prev, ownerId: '', ownerRecordId: '', ownerType: '' }));
    setSelectedId('');
  };

  return (
    <div>
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <div className="text-sm font-bold text-slate-500 mb-2">Administration / <span className="text-[#f39a5f]">Document Management</span></div>
          <h1 className="text-2xl font-bold text-slate-900">Document Management</h1>
          <p className="text-sm text-slate-500 mt-1">
            {ownerFilter?.ownerName
              ? `Viewing uploaded documents for ${ownerFilter.ownerName}.`
              : 'Search documents first. Click one document to view metadata and verification actions.'}
          </p>
          {loading && <p className="text-xs text-slate-500 mt-2">Loading live document records...</p>}
          {!isFirebaseConfigured && <p className="text-xs text-orange-600 mt-2">Demo mode: add Firebase keys to persist documents and upload files.</p>}
          {loadError && <p className="text-xs text-rose-600 mt-2">{loadError}</p>}
        </div>
        <button onClick={() => setShowUploadModal(true)} disabled={!canUpload || uploading} className="h-10 px-5 rounded-full bg-[#fb9a5b] text-white font-semibold text-sm flex items-center gap-2 disabled:bg-slate-300">
          <Plus size={16} /> {uploading ? 'Uploading...' : 'Upload Document'}
        </button>
      </div>

      <div className="flex flex-col xl:flex-row gap-5">
        <div className={`${selectedDocument ? 'xl:w-[68%]' : 'xl:w-full'} min-w-0 transition-all duration-300`}>
          <div className="grid md:grid-cols-4 gap-3 mb-4">
            <div className="relative">
              <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Search..." className="w-full h-10 rounded-lg bg-[#f0f0f2] border-0 pl-10 pr-3 text-sm" />
            </div>
            <select value={activeFilters.ownerType || ''} onChange={(event) => updateFilter('ownerType', event.target.value)} className="h-10 rounded-lg bg-[#f0f0f2] border-0 px-3 text-sm">
              <option value="">All Owners</option>
              {documentOwnerTypes.map((item) => <option key={item}>{item}</option>)}
            </select>
            <select value={filters.category} onChange={(event) => updateFilter('category', event.target.value)} className="h-10 rounded-lg bg-[#f0f0f2] border-0 px-3 text-sm">
              <option value="">All Categories</option>
              {documentCategories.map((item) => <option key={item}>{item}</option>)}
            </select>
            <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)} className="h-10 rounded-lg bg-[#f0f0f2] border-0 px-3 text-sm">
              <option value="">All Statuses</option>
              {documentStatuses.map((item) => <option key={item}>{item}</option>)}
            </select>
          </div>
          {isOwnerFilterActive && activeFilters.ownerRecordId && (
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg bg-[#f5f5f6] border border-slate-100 p-3 text-sm">
              <div>
                <span className="font-semibold text-slate-900">{ownerFilter?.ownerName || 'Selected owner'}</span>
                <span className="text-slate-500"> | {activeFilters.ownerType} {ownerFilter?.ownerId || ''}</span>
              </div>
              <button
                type="button"
                onClick={clearOwnerFilter}
                className="h-8 px-3 rounded-md bg-white border border-slate-200 text-xs font-semibold text-slate-700"
              >
                Show all documents
              </button>
            </div>
          )}
          <DocumentTable
            documents={normalizedDocuments}
            canVerify={canVerify}
            canArchive={canArchive}
            onArchive={archiveDocument}
            onPreview={(document) => setSelectedId(document.id)}
            onVerify={updateVerification}
            onSelect={setSelectedId}
            selectedId={selectedDocumentId}
            showActions={false}
          />
        </div>
        {selectedDocument && (
          <DocumentPreviewPanel
            canArchive={canArchive}
            canVerify={canVerify}
            document={selectedDocument}
            onArchive={archiveDocument}
            onVerify={updateVerification}
          />
        )}
      </div>

      {showUploadModal && <DocumentUploadModal students={courseStudents} staff={staff} onClose={() => setShowUploadModal(false)} onSave={saveDocument} />}
    </div>
  );
}
