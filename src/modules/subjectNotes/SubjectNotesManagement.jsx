import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, FileText, Pencil, Plus, Search, Upload, X } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  archiveSubjectNote,
  createSubjectNote,
  getSubjectNotesData,
  updateSubjectNote,
} from '../../firebase/db';
import { isFirebaseConfigured } from '../../firebase/config';
import { uploadSubjectNotePdf, validateSubjectNotePdfFile } from '../../firebase/storage';
import { canAccess, defaultRoles } from '../userRoles/rolePermissions';
import { filterByCourse } from '../shared/courseFilters';
import { recordMatchesSemester } from '../shared/semesterUtils';
import StatusBadge from '../students/components/StatusBadge';
import {
  canEditSubjectNote,
  collectUserIdentityTokens,
  filterSubjectNotes,
  formatDisplayDate,
  formatFileSize,
  getNoteSubjectLabel,
  getSubjectLabel,
  noteMatchesUser,
  subjectNoteStatuses,
  summarizeSubjectNotes,
  validateSubjectNoteForm,
} from './subjectNoteUtils';

function normalize(value = '') {
  return String(value || '').trim().toLowerCase();
}

function resolveCurrentFaculty(staff = [], currentUser = {}) {
  const tokens = collectUserIdentityTokens(currentUser);
  if (!tokens.size) return null;
  return staff.find((member) => [
    member.id,
    member.uid,
    member.employeeId,
    member.email,
    member.name,
  ].map(normalize).some((value) => tokens.has(value))) || null;
}

function getFacultyOptions(notes = []) {
  const options = new Map();
  notes.forEach((note) => {
    const name = note.facultyName || note.uploadedByName || '';
    const id = note.facultyId || note.facultyRecordId || name;
    if (!name || options.has(id)) return;
    options.set(id, { id, name });
  });
  return [...options.values()].sort((first, second) => first.name.localeCompare(second.name));
}

function NoteFormModal({ note, subjectOptions, saving, onClose, onSave }) {
  const [form, setForm] = useState({
    subjectRecordId: note?.subjectRecordId || subjectOptions[0]?.id || '',
    title: note?.title || '',
    description: note?.description || '',
    status: note?.status === 'Archived' ? 'Draft' : note?.status || 'Published',
    file: null,
  });
  const isEdit = Boolean(note);
  const selectedSubject = subjectOptions.find((subject) => subject.id === form.subjectRecordId) || null;
  const selectedFileLabel = form.file?.name || note?.fileName || 'PDF file';

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = (event) => {
    event.preventDefault();
    onSave(form, selectedSubject);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <form onSubmit={submit} className="erp-modal-form w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="erp-modal-header px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{isEdit ? 'Edit Subject Note' : 'Upload Subject Note'}</h2>
            <p className="text-sm text-slate-500 mt-1">PDF notes mapped to one subject.</p>
          </div>
          <button type="button" onClick={onClose} className="erp-modal-close h-9 w-9 rounded-full hover:bg-slate-100 text-slate-500 inline-flex items-center justify-center" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 grid sm:grid-cols-2 gap-4">
          <label className="sm:col-span-2">
            <span className="block text-xs font-semibold text-slate-500 mb-1.5">Subject</span>
            <select value={form.subjectRecordId} onChange={(event) => update('subjectRecordId', event.target.value)} className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm">
              {subjectOptions.map((subject) => (
                <option key={subject.id} value={subject.id}>{getSubjectLabel(subject)}</option>
              ))}
            </select>
          </label>

          <label className="sm:col-span-2">
            <span className="block text-xs font-semibold text-slate-500 mb-1.5">Title</span>
            <input value={form.title} onChange={(event) => update('title', event.target.value)} className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm" autoFocus />
          </label>

          <label className="sm:col-span-2">
            <span className="block text-xs font-semibold text-slate-500 mb-1.5">Description</span>
            <textarea value={form.description} onChange={(event) => update('description', event.target.value)} rows="3" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm resize-none" />
          </label>

          <label>
            <span className="block text-xs font-semibold text-slate-500 mb-1.5">Status</span>
            <select value={form.status} onChange={(event) => update('status', event.target.value)} className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm">
              {subjectNoteStatuses.filter((status) => status !== 'Archived').map((status) => <option key={status}>{status}</option>)}
            </select>
          </label>

          <label>
            <span className="block text-xs font-semibold text-slate-500 mb-1.5">{isEdit ? 'Replace PDF' : 'PDF File'}</span>
            <span className="h-11 rounded-lg border border-slate-200 px-3 text-sm flex items-center gap-2 cursor-pointer bg-white">
              <Upload size={16} />
              <span className="truncate">{selectedFileLabel}</span>
              <input
                type="file"
                accept="application/pdf,.pdf"
                className="sr-only"
                onChange={(event) => update('file', event.target.files?.[0] || null)}
              />
            </span>
          </label>
        </div>

        <div className="erp-modal-footer px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="h-10 px-5 rounded-lg bg-slate-100 text-slate-700 font-semibold text-sm">Cancel</button>
          <button type="submit" disabled={saving || !subjectOptions.length} className="h-10 px-5 rounded-lg bg-[#33373e] text-white font-semibold text-sm disabled:bg-slate-300">
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Upload Note'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function SubjectNotesManagement({ currentUser, academicYear = '', selectedCourse = null, selectedCourseCode = 'all' }) {
  const [subjects, setSubjects] = useState([]);
  const [staff, setStaff] = useState([]);
  const [notes, setNotes] = useState([]);
  const [filters, setFilters] = useState({ search: '', subjectRecordId: '', status: '', facultyId: '' });
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [loadError, setLoadError] = useState('');
  const [editingNote, setEditingNote] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadNotes = async () => {
      if (!isFirebaseConfigured) {
        setLoadError('Live Firebase data is not configured.');
        setLoading(false);
        return;
      }
      try {
        const data = await getSubjectNotesData(academicYear);
        setSubjects(data.academicSubjects.filter((subject) => subject.status !== 'Archived'));
        setStaff(data.staff.filter((member) => member.status !== 'Archived'));
        setNotes(data.subjectNotes);
        setLoadError('');
      } catch (error) {
        console.warn('Unable to load live subject notes.', error);
        setLoadError('Unable to load live subject notes.');
      } finally {
        setLoading(false);
      }
    };
    loadNotes();
  }, [academicYear]);

  const currentRoleId = currentUser?.roleId || 'admin';
  const canUpload = canAccess(defaultRoles, currentRoleId, 'subjectNotes.upload');
  const canEdit = canAccess(defaultRoles, currentRoleId, 'subjectNotes.edit');
  const canArchive = canAccess(defaultRoles, currentRoleId, 'subjectNotes.archive');
  const canManageAll = currentRoleId === 'admin' || currentRoleId === 'super-admin' || canArchive;
  const currentUserTokens = useMemo(() => collectUserIdentityTokens(currentUser), [currentUser]);
  const currentFaculty = useMemo(() => resolveCurrentFaculty(staff, currentUser), [currentUser, staff]);

  const courseSubjects = useMemo(
    () => filterByCourse(subjects, selectedCourseCode, selectedCourse),
    [selectedCourse, selectedCourseCode, subjects]
  );
  const courseNotes = useMemo(() => {
    const scoped = filterByCourse(notes, selectedCourseCode, selectedCourse);
    if (currentRoleId !== 'faculty') return scoped;
    return scoped.filter((note) => note.status === 'Published' || noteMatchesUser(note, currentUserTokens));
  }, [currentRoleId, currentUserTokens, notes, selectedCourse, selectedCourseCode]);
  const facultyOptions = useMemo(() => getFacultyOptions(courseNotes), [courseNotes]);
  const visibleNotes = useMemo(
    () => filterSubjectNotes(courseNotes, filters).sort((first, second) => String(second.updatedAtText || second.uploadedAtText || '').localeCompare(String(first.updatedAtText || first.uploadedAtText || ''))),
    [courseNotes, filters]
  );
  const summary = useMemo(() => summarizeSubjectNotes(courseNotes, currentUserTokens), [courseNotes, currentUserTokens]);

  const updateFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));

  const openCreateModal = () => {
    setEditingNote(null);
    setModalOpen(true);
  };

  const openEditModal = (note) => {
    setEditingNote(note);
    setModalOpen(true);
  };

  const buildNotePayload = (form, selectedSubject, fileData = {}) => {
    const facultyRecord = currentFaculty || {};
    const facultyId = facultyRecord.employeeId || currentUser?.employeeId || currentUser?.displayId || currentUser?.id || '';
    const facultyName = facultyRecord.name || currentUser?.name || currentUser?.displayName || currentUser?.email || '';
    return {
      title: form.title.trim(),
      description: form.description?.trim() || '',
      subjectRecordId: selectedSubject.id,
      subjectCode: selectedSubject.subjectCode || selectedSubject.code || '',
      subjectName: selectedSubject.subjectName || selectedSubject.name || '',
      programName: selectedSubject.programName || selectedSubject.program || '',
      courseCode: selectedSubject.courseCode || (selectedCourseCode === 'all' ? '' : selectedCourseCode),
      courseName: selectedSubject.courseName || selectedCourse?.courseName || selectedCourse?.name || '',
      classKey: selectedSubject.classKey || '',
      displayPeriod: selectedSubject.displayPeriod || selectedSubject.curriculumPeriod || '',
      semesterNumber: selectedSubject.semesterNumber || '',
      semesterNumbers: selectedSubject.semesterNumbers || [],
      semesterLabels: selectedSubject.semesterLabels || [],
      academicYear,
      facultyRecordId: facultyRecord.id || currentUser?.staffRecordId || '',
      facultyId,
      facultyName,
      uploadedByUid: currentUser?.uid || '',
      uploadedByEmail: currentUser?.email || '',
      uploadedById: currentUser?.displayId || currentUser?.employeeId || currentUser?.id || '',
      uploadedByName: currentUser?.name || currentUser?.displayName || currentUser?.email || '',
      status: form.status,
      updatedAtText: formatDisplayDate(),
      ...fileData,
    };
  };

  const saveNote = async (form, selectedSubject) => {
    const isEdit = Boolean(editingNote);
    const requireFile = !isEdit;
    if (!canUpload && !isEdit) {
      toast.error('You do not have permission to upload subject notes.');
      return;
    }
    if (isEdit && !canEditSubjectNote(editingNote, { canEdit, canManageAll, identityTokens: currentUserTokens })) {
      toast.error('You do not have permission to edit this subject note.');
      return;
    }
    const validationMessage = validateSubjectNoteForm(form, { requireFile });
    if (validationMessage) {
      toast.error(validationMessage);
      return;
    }
    if (!selectedSubject) {
      toast.error('Subject is required.');
      return;
    }
    if (form.file) {
      try {
        validateSubjectNotePdfFile(form.file);
      } catch (error) {
        toast.error(error.message);
        return;
      }
    }

    setSaving(true);
    let fileData = {};
    let uploadError = null;
    try {
      if (form.file) {
        fileData = await uploadSubjectNotePdf({ subject: selectedSubject, file: form.file, currentUser });
      }
    } catch (error) {
      uploadError = error;
      fileData = {
        fileName: form.file.name,
        fileSize: form.file.size,
        fileType: 'application/pdf',
        fileUrl: '',
        storagePath: '',
      };
    }

    const payload = {
      ...buildNotePayload(form, selectedSubject, fileData),
      ...(isEdit ? {} : { uploadedAtText: formatDisplayDate() }),
    };

    try {
      if (isEdit) {
        await updateSubjectNote(editingNote.id, payload);
        setNotes((prev) => prev.map((item) => item.id === editingNote.id ? { ...item, ...payload } : item));
      } else {
        const id = await createSubjectNote(payload);
        if (!id) throw new Error('Live subject note was not created.');
        setNotes((prev) => [{ id, ...payload }, ...prev]);
      }
      toast.success(uploadError ? 'Subject note metadata saved. PDF storage is unavailable.' : 'Subject note saved');
      setModalOpen(false);
      setEditingNote(null);
    } catch (error) {
      console.error('Unable to save live subject note.', error);
      toast.error('Subject note was not saved to live data.');
    } finally {
      setSaving(false);
    }
  };

  const archiveNote = async (note) => {
    if (!canArchive) {
      toast.error('You do not have permission to archive subject notes.');
      return;
    }
    const updates = {
      status: 'Archived',
      archivedAtText: formatDisplayDate(),
      updatedAtText: formatDisplayDate(),
    };
    try {
      await archiveSubjectNote(note.id, updates);
      setNotes((prev) => prev.map((item) => item.id === note.id ? { ...item, ...updates } : item));
      toast.success('Subject note archived');
    } catch (error) {
      console.error('Unable to archive live subject note.', error);
      toast.error('Subject note archive was not saved to live data.');
    }
  };

  const statCards = [
    ['Total Notes', summary.total],
    ['Published', summary.published],
    ['Drafts', summary.drafts],
    ['My Uploads', summary.own],
  ];

  return (
    <div>
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <div className="text-sm font-bold text-slate-500 mb-2">Academics / <span className="text-[#f39a5f]">Subject Notes</span></div>
          <h1 className="text-2xl font-bold text-slate-900">Subject Notes</h1>
          <p className="text-sm text-slate-500 mt-1">Subject-wise PDF notes for {academicYear || 'the academic year'}.</p>
          {loading && <p className="text-xs text-slate-500 mt-2">Loading live subject notes...</p>}
          {!isFirebaseConfigured && <p className="text-xs text-rose-600 mt-2">Live Firebase data is not configured.</p>}
          {loadError && <p className="text-xs text-rose-600 mt-2">{loadError}</p>}
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          disabled={!canUpload || !isFirebaseConfigured || !courseSubjects.length}
          className="h-10 px-5 rounded-full bg-[#fb9a5b] text-white font-semibold text-sm flex items-center gap-2 disabled:bg-slate-300"
        >
          <Plus size={16} /> Upload Note
        </button>
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
        {statCards.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-slate-100 bg-white p-4">
            <div className="text-xs font-bold uppercase text-slate-500">{label}</div>
            <div className="text-2xl font-extrabold text-slate-900 mt-2">{value}</div>
          </div>
        ))}
      </div>

      <div className={`grid ${canManageAll ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-3 mb-5`}>
        <div className="relative">
          <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Search notes..." className="w-full h-11 rounded-lg bg-[#f0f0f2] border-0 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-orange-100" />
        </div>
        <select value={filters.subjectRecordId} onChange={(event) => updateFilter('subjectRecordId', event.target.value)} className="h-11 rounded-lg bg-[#f0f0f2] border-0 px-3 text-sm">
          <option value="">All Subjects</option>
          {courseSubjects.map((subject) => <option key={subject.id} value={subject.id}>{getSubjectLabel(subject)}</option>)}
        </select>
        <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)} className="h-11 rounded-lg bg-[#f0f0f2] border-0 px-3 text-sm">
          <option value="">All Statuses</option>
          {subjectNoteStatuses.map((status) => <option key={status}>{status}</option>)}
        </select>
        {canManageAll && (
          <select value={filters.facultyId} onChange={(event) => updateFilter('facultyId', event.target.value)} className="h-11 rounded-lg bg-[#f0f0f2] border-0 px-3 text-sm">
            <option value="">All Faculty</option>
            {facultyOptions.map((faculty) => <option key={faculty.id} value={faculty.id}>{faculty.name}</option>)}
          </select>
        )}
      </div>

      <div className="grid gap-3">
        {visibleNotes.map((note) => {
          const editable = canEditSubjectNote(note, { canEdit, canManageAll, identityTokens: currentUserTokens });
          const matchesSemester = !filters.semester || recordMatchesSemester(note, filters.semester);
          if (!matchesSemester) return null;
          return (
            <div key={note.id} className="rounded-lg border border-slate-100 bg-white p-4 flex flex-col xl:flex-row xl:items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-[#f5f5f6] text-[#f39a5f] inline-flex items-center justify-center shrink-0">
                <FileText size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-extrabold text-slate-900 truncate">{note.title}</h2>
                  <StatusBadge value={note.status} />
                </div>
                <p className="text-sm text-slate-500 mt-1 line-clamp-2">{note.description || getNoteSubjectLabel(note)}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 mt-2">
                  <span>{getNoteSubjectLabel(note)}</span>
                  {note.displayPeriod && <span>{note.displayPeriod}</span>}
                  <span>{note.facultyName || note.uploadedByName || 'Faculty'}</span>
                  <span>{note.fileName || 'PDF metadata'}{note.fileSize ? ` / ${formatFileSize(note.fileSize)}` : ''}</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                {note.fileUrl ? (
                  <a href={note.fileUrl} target="_blank" rel="noreferrer" className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-700 inline-flex items-center gap-2">
                    <ExternalLink size={15} /> PDF
                  </a>
                ) : (
                  <span className="h-9 px-3 rounded-lg border border-slate-200 bg-[#f5f5f6] text-sm font-semibold text-slate-500 inline-flex items-center">No PDF URL</span>
                )}
                {editable && (
                  <button type="button" onClick={() => openEditModal(note)} className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-700 inline-flex items-center gap-2">
                    <Pencil size={15} /> Edit
                  </button>
                )}
                {canArchive && note.status !== 'Archived' && (
                  <button type="button" onClick={() => archiveNote(note)} className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-700">
                    Archive
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {!visibleNotes.length && (
          <div className="rounded-lg border border-slate-100 bg-white p-8 text-center text-sm text-slate-500">
            No subject notes found.
          </div>
        )}
      </div>

      {modalOpen && (
        <NoteFormModal
          note={editingNote}
          subjectOptions={courseSubjects}
          saving={saving}
          onClose={() => {
            setModalOpen(false);
            setEditingNote(null);
          }}
          onSave={saveNote}
        />
      )}
    </div>
  );
}
