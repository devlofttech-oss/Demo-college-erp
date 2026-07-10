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

export function getFeeComponentValues(source = {}) {
  return feeComponentKeys.reduce((values, key) => ({
    ...values,
    [key]: Number(source[key] || 0),
  }), {});
}

export function totalFeeComponents(source = {}) {
  return feeComponentKeys.reduce((total, key) => {
    if (key === agentFeeComponentField.key && !isAdmissionThroughAgent(source)) return total;
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

export function getCollectionsForFeeContext(collections = [], context = {}, excludeCollectionId = '') {
  const assignmentId = context.assignmentId || context.id || '';
  const studentRecordId = context.studentRecordId || '';
  const studentId = context.studentId || '';
  const feeStructureId = context.feeStructureId || '';

  return collections.filter((collection) => {
    if (collection.id === excludeCollectionId || !isPostedFeeCollection(collection)) return false;
    if (assignmentId && collection.assignmentId === assignmentId) return true;
    const sameStudent = (
      (studentRecordId && collection.studentRecordId === studentRecordId) ||
      (studentId && collection.studentId === studentId)
    );
    return Boolean(sameStudent && feeStructureId && collection.feeStructureId === feeStructureId);
  });
}

export function sumCollectionAmounts(collections = [], amountKey = 'amount') {
  return collections
    .filter(isPostedFeeCollection)
    .reduce((total, collection) => total + Number(collection[amountKey] || 0), 0);
}

export function calculateAssignmentPaymentLedger(assignment = {}, collections = [], options = {}) {
  const { useLegacyPaidFallback = true } = options;
  const postedCollections = collections.filter(isPostedFeeCollection);
  const hasCollectionHistory = postedCollections.length > 0;
  const paidAmount = hasCollectionHistory || !useLegacyPaidFallback
    ? sumCollectionAmounts(postedCollections)
    : Number(assignment.paidAmount || 0);
  const adjustmentAmount = Number(assignment.adjustmentAmount || 0);
  const totalAmount = Number(assignment.totalAmount || 0);
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

export function getManualDueItemOptions(source = {}) {
  return isAdmissionThroughAgent(source)
    ? [...manualDueItemOptions, agentManualDueItemOption]
    : manualDueItemOptions;
}

export function normalizeManualDueItems(items = [], source = {}) {
  if (!Array.isArray(items)) return [];
  const shouldIncludeAgent = isAdmissionThroughAgent(source) || items.some((item) => (
    (typeof item === 'string' ? item : item?.id) === agentManualDueItemOption.id
  ));
  const options = shouldIncludeAgent ? [...manualDueItemOptions, agentManualDueItemOption] : manualDueItemOptions;
  const optionsById = options.reduce((map, item) => ({ ...map, [item.id]: item }), {});
  const seen = new Set();

  return items.reduce((normalized, item) => {
    const rawId = typeof item === 'string' ? item : item?.id;
    const option = optionsById[rawId];
    const label = option?.label || (typeof item === 'string' ? item : item?.label);
    const id = option?.id || rawId || String(label || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (!id || !label || seen.has(id)) return normalized;
    seen.add(id);
    return [...normalized, { id, label }];
  }, []);
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
  if (form.entryMode === 'structure') {
    if (!form.studentRecordId) return 'Student is required.';
    if (!form.feeStructureId) return 'Fee structure is required.';
    if (Number(form.totalAmount || 0) <= 0) return 'Fee total must be greater than zero.';
    if (!form.paymentDate) return 'Payment date is required.';
    if (!form.paymentMode) return 'Payment mode is required.';
    if (Number(form.amount || 0) <= 0) return 'Collection amount must be greater than zero.';
    return '';
  }
  if (form.entryMode === 'manual') {
    if (!form.studentRecordId) return 'Student is required.';
  } else if (!form.assignmentId) {
    return 'Student fee assignment is required.';
  }
  if (!form.paymentDate) return 'Payment date is required.';
  if (!form.paymentMode) return 'Payment mode is required.';
  if (Number(form.amount || 0) <= 0) return 'Collection amount must be greater than zero.';
  if (form.entryMode !== 'manual' && assignment && Number(form.amount || 0) > Number(assignment.dueAmount || assignment.totalAmount || 0)) {
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
