export const documentOwnerTypes = ['Student', 'Staff', 'Academic Archive'];
export const documentCategories = ['Identity', 'Admission', 'Academic', 'HR', 'Finance', 'Archive', 'Other'];
export const documentStatuses = ['Pending Review', 'Verified', 'Rejected', 'Archived'];

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

export function resolveOwnerName(document, students = [], staff = []) {
  if (document.ownerName) return document.ownerName;
  if (document.ownerType === 'Student') {
    return students.find((item) => item.id === document.ownerRecordId)?.name || document.ownerId || 'Student';
  }
  if (document.ownerType === 'Staff') {
    return staff.find((item) => item.id === document.ownerRecordId)?.name || document.ownerId || 'Staff';
  }
  return document.archiveTitle || 'Academic Archive';
}

export function summarizeDocuments(documents = []) {
  return documents.reduce((summary, item) => ({
    total: summary.total + 1,
    verified: summary.verified + (item.verificationStatus === 'Verified' ? 1 : 0),
    pending: summary.pending + (item.verificationStatus === 'Pending Review' ? 1 : 0),
    rejected: summary.rejected + (item.verificationStatus === 'Rejected' ? 1 : 0),
    archived: summary.archived + (item.verificationStatus === 'Archived' ? 1 : 0),
  }), {
    total: 0,
    verified: 0,
    pending: 0,
    rejected: 0,
    archived: 0,
  });
}

export function filterDocuments(documents = [], filters = {}) {
  const term = (filters.search || '').trim().toLowerCase();
  return documents.filter((item) => {
    const ownerMatches = !filters.ownerType || item.ownerType === filters.ownerType;
    const categoryMatches = !filters.category || item.category === filters.category;
    const statusMatches = !filters.status || item.verificationStatus === filters.status;
    const textMatches = !term || [
      item.documentType,
      item.fileName,
      item.ownerName,
      item.ownerId,
      item.archiveTitle,
      item.tags,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term));
    return ownerMatches && categoryMatches && statusMatches && textMatches;
  });
}

export function validateDocumentForm(form) {
  if (!documentOwnerTypes.includes(form.ownerType)) return 'Owner type is required.';
  if (form.ownerType !== 'Academic Archive' && !form.ownerRecordId) return 'Owner is required.';
  if (form.ownerType === 'Academic Archive' && !form.archiveTitle?.trim()) return 'Archive title is required.';
  if (!form.documentType?.trim()) return 'Document type is required.';
  if (!documentCategories.includes(form.category)) return 'Category is required.';
  return '';
}
