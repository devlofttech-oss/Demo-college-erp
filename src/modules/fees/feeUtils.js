export const feeComponentFields = [
  { label: 'Admission Fee', shortLabel: 'Admission', key: 'admissionFee' },
  { label: 'Application Fee', shortLabel: 'Application', key: 'applicationFee' },
  { label: 'Pocket Article Fee', shortLabel: 'Pocket Article', key: 'pocketArticleFee' },
  { label: 'Year Fee', shortLabel: 'Year Fee', key: 'tuitionFee' },
  { label: 'Library Fee', shortLabel: 'Library', key: 'libraryFee' },
  { label: 'Lab Fee', shortLabel: 'Lab', key: 'labFee' },
  { label: 'Transport Fee', shortLabel: 'Transport', key: 'transportFee' },
];

export const agentFeeComponentField = { label: 'Agent Fee', shortLabel: 'Agent', key: 'agentFee' };

export const feeComponentKeys = [...feeComponentFields.map((field) => field.key), agentFeeComponentField.key];

export const manualDueItemOptions = [
  { id: 'application-fee', label: 'Application Fee' },
  { id: 'pocket-article-fee', label: 'Pocket Article Fee' },
  { id: 'admission-fee', label: 'Admission Fee' },
  { id: 'year-fee', label: 'Year Fee' },
  { id: 'library-fee', label: 'Library Fee' },
  { id: 'lab-fee', label: 'Lab Fee' },
  { id: 'transport-fee', label: 'Transport Fee' },
  { id: 'other-due', label: 'Other Due' },
];

export const agentManualDueItemOption = { id: 'agent-fee', label: 'Agent Fee' };

export const manualDueItemAmountKeys = {
  'admission-fee': 'admissionFee',
  'application-fee': 'applicationFee',
  'pocket-article-fee': 'pocketArticleFee',
  'year-fee': 'tuitionFee',
  'library-fee': 'libraryFee',
  'lab-fee': 'labFee',
  'transport-fee': 'transportFee',
};

export function getFeeComponentValues(source = {}) {
  return feeComponentKeys.reduce((values, key) => ({
    ...values,
    [key]: Number(source[key] || 0),
  }), {});
}

export function totalFeeComponents(source = {}) {
  return feeComponentKeys.reduce((total, key) => {
    if (key === agentFeeComponentField.key) return total;
    return total + Number(source[key] || 0);
  }, 0);
}

export function isAdmissionThroughAgent(source = {}) {
  if (!source || typeof source !== 'object') return false;
  if (source.admissionThroughAgent === true || source.isAdmissionThroughAgent === true) return true;
  return [
    source.admissionThroughAgent,
    source.isAdmissionThroughAgent,
    source.admissionSource,
    source.admissionThrough,
    source.admittedThrough,
    source.admissionChannel,
    source.sourceOfAdmission,
  ].some((value) => String(value || '').toLowerCase().includes('agent'));
}

export function calculatePendingAgentFeeBalance(agentFee = 0, agentFeePaid = 0) {
  return Math.max(0, Number(agentFee || 0) - Number(agentFeePaid || 0));
}

export function isPostedFeeCollection(collection = {}) {
  return !['Cancelled', 'Voided', 'Deleted'].includes(collection.status);
}

export function getCollectionsForAssignment(collections = [], assignmentId = '', excludeCollectionId = '') {
  if (!assignmentId) return [];
  return collections.filter((collection) => (
    collection.assignmentId === assignmentId &&
    collection.id !== excludeCollectionId &&
    isPostedFeeCollection(collection)
  ));
}

function normalizeLookupText(value = '') {
  return String(value || '').trim().toLowerCase();
}

export function getCollectionsForFeeContext(collections = [], context = {}, excludeCollectionId = '', options = {}) {
  const { allowStudentOnly = false } = options;
  const assignmentId = context.assignmentId || context.id || '';
  const studentRecordId = context.studentRecordId || '';
  const studentId = context.studentId || '';
  const studentName = normalizeLookupText(context.studentName);
  const feeStructureId = context.feeStructureId || '';

  return collections.filter((collection) => {
    if (collection.id === excludeCollectionId || !isPostedFeeCollection(collection)) return false;
    if (assignmentId && collection.assignmentId === assignmentId) return true;
    const sameStudent = (
      (studentRecordId && collection.studentRecordId === studentRecordId) ||
      (studentId && collection.studentId === studentId) ||
      (studentName && normalizeLookupText(collection.studentName) === studentName)
    );
    if (sameStudent && allowStudentOnly && !feeStructureId) return true;
    return Boolean(sameStudent && feeStructureId && collection.feeStructureId === feeStructureId);
  });
}

export function sumCollectionAmounts(collections = [], amountKey = 'amount') {
  return collections
    .filter(isPostedFeeCollection)
    .reduce((total, collection) => total + Number(collection[amountKey] || 0), 0);
}

export function normalizePaymentEntries(entries = [], fallback = {}) {
  const sourceEntries = Array.isArray(entries) && entries.length ? entries : [fallback];
  return sourceEntries.map((entry, index) => ({
    rowKey: entry.rowKey || entry.id || `payment-${index + 1}`,
    amount: Number(entry.amount || 0),
    paymentMode: entry.paymentMode || fallback.paymentMode || 'Cash',
    creditedToAccount: String(entry.creditedToAccount ?? fallback.creditedToAccount ?? '').trim(),
    referenceNo: String(entry.referenceNo ?? fallback.referenceNo ?? '').trim(),
    paymentDate: entry.paymentDate || fallback.paymentDate || '',
    paymentTime: entry.paymentTime || fallback.paymentTime || '',
    agentFeePaidAmount: Number(entry.agentFeePaidAmount ?? fallback.agentFeePaidAmount ?? 0),
  }));
}

export function sumPaymentEntries(entries = []) {
  return entries.reduce((total, entry) => total + Number(entry.amount || 0), 0);
}

export function sumPaymentEntryAgentFees(entries = []) {
  return entries.reduce((total, entry) => total + Number(entry.agentFeePaidAmount || 0), 0);
}

function padDatePart(value) {
  return String(value).padStart(2, '0');
}

function normalizePaymentTime(value = '') {
  const time = String(value || '').trim();
  if (!time) return '00:00';
  if (/^\d{1,2}:\d{2}$/.test(time)) {
    const [hours, minutes] = time.split(':');
    return `${padDatePart(hours)}:${minutes}`;
  }
  return time;
}

export function formatPaymentDate(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '-';
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return `${isoMatch[3]}-${isoMatch[2]}-${isoMatch[1]}`;
  const displayMatch = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (displayMatch) return raw;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return `${padDatePart(parsed.getDate())}-${padDatePart(parsed.getMonth() + 1)}-${parsed.getFullYear()}`;
}

export function getPaymentSortTime(record = {}) {
  const paidAtTime = Date.parse(record.paidAt || '');
  if (!Number.isNaN(paidAtTime)) return paidAtTime;

  const dateText = String(record.paymentDate || '').trim();
  const timeText = normalizePaymentTime(record.paymentTime);
  const isoMatch = dateText.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const displayMatch = dateText.match(/^(\d{2})-(\d{2})-(\d{4})$/);

  if (isoMatch) {
    const parsed = new Date(`${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}T${timeText}`);
    return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
  }

  if (displayMatch) {
    const parsed = new Date(`${displayMatch[3]}-${displayMatch[2]}-${displayMatch[1]}T${timeText}`);
    return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
  }

  const dateTime = Date.parse([dateText || record.createdAtText || '', timeText].filter(Boolean).join(' '));
  if (!Number.isNaN(dateTime)) return dateTime;
  const dateOnly = Date.parse(record.createdAtText || '');
  return Number.isNaN(dateOnly) ? 0 : dateOnly;
}

export function sortPaymentRecordsByDate(records = [], direction = 'desc') {
  const multiplier = direction === 'asc' ? 1 : -1;
  return [...records].sort((first, second) => {
    const dateCompare = (getPaymentSortTime(first) - getPaymentSortTime(second)) * multiplier;
    if (dateCompare) return dateCompare;
    return Number(first.installmentNo || 0) - Number(second.installmentNo || 0);
  });
}

export function calculateAssignmentPaymentLedger(assignment = {}, collections = [], options = {}) {
  const { useLegacyPaidFallback = true } = options;
  const postedCollections = collections.filter(isPostedFeeCollection);
  const hasCollectionHistory = postedCollections.length > 0;
  const paidAmount = hasCollectionHistory || !useLegacyPaidFallback
    ? sumCollectionAmounts(postedCollections)
    : Number(assignment.paidAmount || 0);
  const adjustmentAmount = Number(assignment.adjustmentAmount || 0);
  const componentTotal = totalFeeComponents(assignment);
  const totalAmount = componentTotal > 0 ? componentTotal : Number(assignment.totalAmount || 0);
  const dueAmount = calculateDueAmount(totalAmount, paidAmount, adjustmentAmount);
  const admissionThroughAgent = isAdmissionThroughAgent(assignment);
  const agentFeePaid = admissionThroughAgent
    ? (hasCollectionHistory || !useLegacyPaidFallback ? sumCollectionAmounts(postedCollections, 'agentFeePaidAmount') : Number(assignment.agentFeePaid || 0))
    : 0;

  return {
    paymentCount: postedCollections.length,
    paidAmount,
    adjustmentAmount,
    dueAmount,
    status: calculateFeeStatus(totalAmount, paidAmount, adjustmentAmount),
    agentFeePaid,
    pendingAgentFeeBalance: admissionThroughAgent
      ? calculatePendingAgentFeeBalance(assignment.agentFee, agentFeePaid)
      : 0,
  };
}

export function getManualDueItemOptions() {
  return manualDueItemOptions;
}

export function normalizeManualDueItems(items = [], source = {}) {
  if (!Array.isArray(items)) return [];
  const options = getManualDueItemOptions(source);
  const optionsById = options.reduce((map, item) => ({ ...map, [item.id]: item }), {});
  const seen = new Set();

  return items.reduce((normalized, item) => {
    const rawId = typeof item === 'string' ? item : item?.id;
    if (rawId === agentManualDueItemOption.id) return normalized;
    const option = optionsById[rawId];
    const label = option?.label || (typeof item === 'string' ? item : item?.label);
    const id = option?.id || rawId || String(label || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (id === agentManualDueItemOption.id) return normalized;
    if (!id || !label || seen.has(id)) return normalized;
    seen.add(id);
    return [...normalized, { id, label }];
  }, []);
}

export function filterPaidDueItems(paidItems = [], pendingItems = [], source = {}) {
  const pending = normalizeManualDueItems(pendingItems, source);
  const pendingIds = new Set(pending.map((item) => item.id));
  return normalizeManualDueItems(paidItems, source).filter((item) => pendingIds.has(item.id));
}

export function getRemainingDueItems(pendingItems = [], paidItems = [], source = {}) {
  const paidIds = new Set(filterPaidDueItems(paidItems, pendingItems, source).map((item) => item.id));
  return normalizeManualDueItems(pendingItems, source).filter((item) => !paidIds.has(item.id));
}

export function getManualDueItemAmount(item = {}, source = {}) {
  const id = typeof item === 'string' ? item : item?.id;
  if (id === agentManualDueItemOption.id) return Number(source.agentFee || 0);
  if (id === 'other-due') return Number(item.amount || source.otherDueAmount || source.manualDueAmount || 0);
  const amountKey = manualDueItemAmountKeys[id];
  return amountKey ? Number(source[amountKey] || 0) : 0;
}

export function totalManualDueItems(items = [], source = {}) {
  return normalizeManualDueItems(items, source)
    .reduce((total, item) => total + getManualDueItemAmount(item, source), 0);
}

export function formatManualDueItems(items = []) {
  return normalizeManualDueItems(items).map((item) => item.label).join(', ');
}

export function formatCurrency(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export function formatDisplayDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function getStudentClassKey(student) {
  return [student?.className, student?.section].filter(Boolean).join(' - ');
}

export function calculateDueAmount(totalAmount, paidAmount = 0, adjustmentAmount = 0) {
  return Math.max(0, Number(totalAmount || 0) - Number(paidAmount || 0) - Number(adjustmentAmount || 0));
}

export function calculateFeeStatus(totalAmount, paidAmount = 0, adjustmentAmount = 0) {
  const due = calculateDueAmount(totalAmount, paidAmount, adjustmentAmount);
  if (due <= 0) return 'Paid';
  if (Number(paidAmount || 0) > 0 || Number(adjustmentAmount || 0) > 0) return 'Partially Paid';
  return 'Due';
}

export function getDueBucket(dueDate, status, now = new Date()) {
  if (status === 'Paid') return 'Cleared';
  if (!dueDate) return 'No Due Date';
  const due = new Date(`${dueDate}T00:00:00`);
  if (Number.isNaN(due.getTime())) return 'No Due Date';
  const days = Math.ceil((due.getTime() - now.getTime()) / 86400000);
  if (days < 0) return 'Overdue';
  if (days <= 7) return 'Due Soon';
  return 'Upcoming';
}

export function summarizeFees(assignments = [], collections = [], adjustments = []) {
  const collectionsByAssignment = collections.reduce((map, item) => {
    if (!item.assignmentId || !isPostedFeeCollection(item)) return map;
    map[item.assignmentId] = [...(map[item.assignmentId] || []), item];
    return map;
  }, {});
  const adjustedByAssignment = adjustments.reduce((map, item) => {
    map[item.assignmentId] = (map[item.assignmentId] || 0) + Number(item.amount || 0);
    return map;
  }, {});

  return assignments.reduce((summary, assignment) => {
    const adjusted = adjustedByAssignment[assignment.id] || Number(assignment.adjustmentAmount || 0);
    const ledger = calculateAssignmentPaymentLedger(
      { ...assignment, adjustmentAmount: adjusted },
      collectionsByAssignment[assignment.id] || []
    );
    return {
      totalAssigned: summary.totalAssigned + Number(assignment.totalAmount || 0),
      totalCollected: summary.totalCollected + ledger.paidAmount,
      totalAdjusted: summary.totalAdjusted + adjusted,
      totalOutstanding: summary.totalOutstanding + ledger.dueAmount,
      dueStudents: summary.dueStudents + (ledger.dueAmount > 0 ? 1 : 0),
    };
  }, {
    totalAssigned: 0,
    totalCollected: 0,
    totalAdjusted: 0,
    totalOutstanding: 0,
    dueStudents: 0,
  });
}

export function validateFeeStructure(form) {
  if (!form.name?.trim()) return 'Fee structure name is required.';
  if (!form.classKey) return 'Class is required.';
  if (!form.academicYear?.trim()) return 'Academic year is required.';
  if (Number(form.totalAmount || 0) <= 0) return 'Total amount must be greater than zero.';
  if (!form.dueDate) return 'Due date is required.';
  return '';
}

export function validateFeeCollection(form, assignment) {
  const paymentEntries = normalizePaymentEntries(form.paymentEntries, form);
  const amount = sumPaymentEntries(paymentEntries);
  const hasInvalidEntryAmount = paymentEntries.some((entry) => Number(entry.amount || 0) <= 0);
  const hasMissingEntryDate = paymentEntries.some((entry) => !entry.paymentDate);
  const hasMissingEntryMode = paymentEntries.some((entry) => !entry.paymentMode);
  const hasNegativeAgentFee = paymentEntries.some((entry) => Number(entry.agentFeePaidAmount || 0) < 0);

  if (form.entryMode === 'structure') {
    if (!form.studentRecordId) return 'Student is required.';
    if (!form.feeStructureId) return 'Fee structure is required.';
    if (Number(form.totalAmount || 0) <= 0) return 'Fee total must be greater than zero.';
    if (hasMissingEntryDate) return 'Payment date is required for each payment.';
    if (hasMissingEntryMode) return 'Payment mode is required for each payment.';
    if (hasInvalidEntryAmount) return 'Each payment amount must be greater than zero.';
    if (hasNegativeAgentFee) return 'Agent fee paid cannot be negative.';
    return '';
  }
  if (form.entryMode === 'manual') {
    if (!form.studentRecordId) return 'Student is required.';
  } else if (!form.assignmentId) {
    return 'Student fee assignment is required.';
  }
  if (hasMissingEntryDate) return 'Payment date is required for each payment.';
  if (hasMissingEntryMode) return 'Payment mode is required for each payment.';
  if (hasInvalidEntryAmount) return 'Each payment amount must be greater than zero.';
  if (hasNegativeAgentFee) return 'Agent fee paid cannot be negative.';
  if (form.entryMode !== 'manual' && assignment && amount > Number(assignment.dueAmount || assignment.totalAmount || 0)) {
    return 'Collection amount cannot exceed outstanding due.';
  }
  return '';
}

export function validateFeeAdjustment(form, assignment) {
  if (!form.assignmentId) return 'Student fee assignment is required.';
  if (Number(form.amount || 0) <= 0) return 'Adjustment amount must be greater than zero.';
  if (!form.reason?.trim()) return 'Adjustment reason is required.';
  if (assignment && Number(form.amount || 0) > Number(assignment.dueAmount || assignment.totalAmount || 0)) {
    return 'Adjustment amount cannot exceed outstanding due.';
  }
  return '';
}
