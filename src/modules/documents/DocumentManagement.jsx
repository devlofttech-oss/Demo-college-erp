import { useEffect, useMemo, useState } from 'react';
import { Archive, CheckCircle, FileText, Plus, Search, Upload } from 'lucide-react';
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
import { documentCategories, documentOwnerTypes, documentStatuses, filterDocuments, formatDisplayDate, resolveOwnerName, summarizeDocuments, validateDocumentForm } from './documentUtils';
import DocumentArchivePanel from './components/DocumentArchivePanel';
import DocumentPreviewPanel from './components/DocumentPreviewPanel';
import DocumentTable from './components/DocumentTable';
import DocumentUploadModal from './components/DocumentUploadModal';

export default function DocumentManagement({ currentUser }) {
  const [students, setStudents] = useState(demoDocumentStudents);
  const [staff, setStaff] = useState(demoDocumentStaff);
  const [documents, setDocuments] = useState(demoManagedDocuments);
  const [selectedId, setSelectedId] = useState(demoManagedDocuments[0]?.id || '');
  const [filters, setFilters] = useState({ search: '', ownerType: '', category: '', status: '' });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const loadDocuments = async () => {
      try {
        const data = await getDocumentManagementData();
        if (data.students.length) setStudents(data.students.filter((student) => student.status !== 'Archived'));
        if (data.staff.length) setStaff(data.staff.filter((member) => member.status !== 'Archived'));
        setDocuments(data.managedDocuments);
        setSelectedId(data.managedDocuments[0]?.id || '');
      } catch (error) {
        console.warn('Using demo documents because Firestore is not reachable.', error);
        setLoadError('Unable to load Firestore document records. Showing demo/local records.');
      } finally {
        setLoading(false);
      }
    };
    loadDocuments();
  }, []);

  const currentRoleId = currentUser?.roleId || 'admin';
  const canUpload = canAccess(defaultRoles, currentRoleId, 'documents.upload');
  const canVerify = canAccess(defaultRoles, currentRoleId, 'documents.verify');
  const canArchive = canAccess(defaultRoles, currentRoleId, 'documents.archive');
  const visibleDocuments = useMemo(() => filterDocuments(documents, filters), [documents, filters]);
  const selectedDocument = documents.find((item) => item.id === selectedId) || visibleDocuments[0] || documents[0];
  const summary = summarizeDocuments(documents);

  const stats = [
    { label: 'Documents', value: summary.total, icon: <FileText size={22} /> },
    { label: 'Verified', value: summary.verified, icon: <CheckCircle size={22} /> },
    { label: 'Pending Review', value: summary.pending, icon: <Upload size={22} /> },
    { label: 'Archived', value: summary.archived, icon: <Archive size={22} /> },
  ];

  const buildDocumentPayload = (form, fileData = {}) => {
    const ownerList = form.ownerType === 'Student' ? students : staff;
    const owner = ownerList.find((item) => item.id === form.ownerRecordId);
    const ownerId = form.ownerType === 'Student' ? owner?.studentId : owner?.employeeId;
    return {
      ownerType: form.ownerType,
      ownerRecordId: form.ownerRecordId,
      ownerId: form.ownerType === 'Academic Archive' ? `ARCHIVE-${Date.now()}` : ownerId || '',
      ownerName: form.ownerType === 'Academic Archive' ? 'Academic Records Archive' : owner?.name || '',
      archiveTitle: form.archiveTitle?.trim() || '',
      documentType: form.documentType.trim(),
      category: form.category,
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
    try {
      const ownerKey = form.ownerType === 'Academic Archive'
        ? form.archiveTitle
        : form.ownerRecordId;
      const fileData = file
        ? await uploadManagedDocumentFile({ ownerType: form.ownerType, ownerId: ownerKey, file })
        : {};
      const payload = buildDocumentPayload(form, fileData);
      const id = await createManagedDocument(payload);
      const created = { id: id || `local-document-${Date.now()}`, ...payload };
      setDocuments((prev) => [created, ...prev]);
      setSelectedId(created.id);
      toast.success(id ? 'Document saved' : 'Document saved locally');
    } catch {
      const payload = buildDocumentPayload(form, file ? {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type || 'application/octet-stream',
        fileUrl: '',
        storagePath: '',
      } : {});
      const id = await createManagedDocument(payload);
      const created = { id: id || `local-document-${Date.now()}`, ...payload };
      setDocuments((prev) => [created, ...prev]);
      setSelectedId(created.id);
      toast.success('Document metadata saved locally. Check Firebase Storage setup for file upload.');
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

  const updateFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));
  const normalizedDocuments = visibleDocuments.map((item) => ({
    ...item,
    ownerName: resolveOwnerName(item, students, staff),
  }));

  return (
    <div>
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <div className="text-sm font-bold text-slate-500 mb-2">Administration / <span className="text-[#f39a5f]">Document Management</span></div>
          <h1 className="text-2xl font-bold text-slate-900">Document Management</h1>
          <p className="text-sm text-slate-500 mt-1">Student documents, staff documents, academic records archive, verification, and metadata tracking.</p>
          {!isFirebaseConfigured && <p className="text-xs text-orange-600 mt-2">Demo mode: add Firebase keys to persist documents and upload files.</p>}
          {loadError && <p className="text-xs text-rose-600 mt-2">{loadError}</p>}
        </div>
        <button onClick={() => setShowUploadModal(true)} disabled={!canUpload || uploading} className="h-10 px-5 rounded-full bg-[#fb9a5b] text-white font-semibold text-sm flex items-center gap-2 disabled:bg-slate-300">
          <Plus size={16} /> {uploading ? 'Uploading...' : 'Upload Document'}
        </button>
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
          <div className="grid md:grid-cols-4 gap-3 mb-4">
            <div className="relative">
              <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Search..." className="w-full h-10 rounded-lg bg-[#f0f0f2] border-0 pl-10 pr-3 text-sm" />
            </div>
            <select value={filters.ownerType} onChange={(event) => updateFilter('ownerType', event.target.value)} className="h-10 rounded-lg bg-[#f0f0f2] border-0 px-3 text-sm">
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
          <DocumentTable
            documents={normalizedDocuments}
            canVerify={canVerify}
            canArchive={canArchive}
            onArchive={archiveDocument}
            onPreview={(document) => setSelectedId(document.id)}
            onVerify={updateVerification}
          />
          <DocumentArchivePanel documents={documents} />
        </div>
        <DocumentPreviewPanel document={selectedDocument} />
      </div>

      {showUploadModal && <DocumentUploadModal students={students} staff={staff} onClose={() => setShowUploadModal(false)} onSave={saveDocument} />}
    </div>
  );
}
