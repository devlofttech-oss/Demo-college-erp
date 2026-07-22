export const subjectNoteStatuses = ['Published', 'Draft', 'Archived'];

function normalize(value = '') {
  return String(value || '').trim().toLowerCase();
}

export function formatDisplayDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatFileSize(bytes = 0) {
  const value = Number(bytes || 0);
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function getSubjectLabel(subject = {}) {
  const name = subject.subjectName || subject.name || 'Subject';
  const code = subject.subjectCode || subject.code || '';
  const period = subject.displayPeriod || subject.curriculumPeriod || subject.semesterDisplay || subject.semesterLabels?.join(', ') || '';
  return [name, code, period].filter(Boolean).join(' / ');
}

export function getNoteSubjectLabel(note = {}) {
  return [note.subjectName, note.subjectCode].filter(Boolean).join(' / ') || 'Subject';
}

export function collectUserIdentityTokens(user = {}) {
  return new Set([
    user.uid,
    user.id,
    user.email,
    user.displayId,
    user.employeeId,
    user.staffId,
    user.staffRecordId,
    user.name,
    user.displayName,
  ].map(normalize).filter(Boolean));
}

export function noteMatchesUser(note = {}, identityTokens = new Set()) {
  if (!identityTokens.size) return false;
  return [
    note.uploadedByUid,
    note.createdByUid,
    note.uploadedByEmail,
    note.createdByEmail,
    note.uploadedById,
    note.createdById,
    note.facultyRecordId,
    note.facultyId,
    note.facultyName,
    note.uploadedByName,
  ].map(normalize).filter(Boolean).some((value) => identityTokens.has(value));
}

export function canEditSubjectNote(note = {}, { canEdit = false, canManageAll = false, identityTokens = new Set() } = {}) {
  if (!canEdit) return false;
  if (canManageAll) return true;
  return noteMatchesUser(note, identityTokens);
}

export function filterSubjectNotes(notes = [], filters = {}) {
  const term = normalize(filters.search);
  return notes.filter((note) => {
    const statusMatches = !filters.status || note.status === filters.status;
    const subjectMatches = !filters.subjectRecordId || note.subjectRecordId === filters.subjectRecordId;
    const facultyMatches = !filters.facultyId || note.facultyId === filters.facultyId || note.facultyRecordId === filters.facultyId;
    const textMatches = !term || [
      note.title,
      note.description,
      note.subjectName,
      note.subjectCode,
      note.courseName,
      note.programName,
      note.facultyName,
      note.fileName,
    ].filter(Boolean).some((value) => normalize(value).includes(term));
    return statusMatches && subjectMatches && facultyMatches && textMatches;
  });
}

export function summarizeSubjectNotes(notes = [], currentUserTokens = new Set()) {
  return notes.reduce((summary, note) => ({
    total: summary.total + 1,
    published: summary.published + (note.status === 'Published' ? 1 : 0),
    drafts: summary.drafts + (note.status === 'Draft' ? 1 : 0),
    archived: summary.archived + (note.status === 'Archived' ? 1 : 0),
    own: summary.own + (noteMatchesUser(note, currentUserTokens) ? 1 : 0),
  }), {
    total: 0,
    published: 0,
    drafts: 0,
    archived: 0,
    own: 0,
  });
}

export function validateSubjectNoteForm(form = {}, { requireFile = false } = {}) {
  if (!form.subjectRecordId) return 'Subject is required.';
  if (!form.title?.trim()) return 'Title is required.';
  if (!subjectNoteStatuses.includes(form.status)) return 'Status is required.';
  if (requireFile && !form.file) return 'PDF file is required.';
  return '';
}
