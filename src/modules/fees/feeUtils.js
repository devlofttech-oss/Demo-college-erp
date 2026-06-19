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
  const paidByAssignment = collections.reduce((map, item) => {
    map[item.assignmentId] = (map[item.assignmentId] || 0) + Number(item.amount || 0);
    return map;
  }, {});
  const adjustedByAssignment = adjustments.reduce((map, item) => {
    map[item.assignmentId] = (map[item.assignmentId] || 0) + Number(item.amount || 0);
    return map;
  }, {});

  return assignments.reduce((summary, assignment) => {
    const paid = paidByAssignment[assignment.id] || Number(assignment.paidAmount || 0);
    const adjusted = adjustedByAssignment[assignment.id] || Number(assignment.adjustmentAmount || 0);
    const due = calculateDueAmount(assignment.totalAmount, paid, adjusted);
    return {
      totalAssigned: summary.totalAssigned + Number(assignment.totalAmount || 0),
      totalCollected: summary.totalCollected + paid,
      totalAdjusted: summary.totalAdjusted + adjusted,
      totalOutstanding: summary.totalOutstanding + due,
      dueStudents: summary.dueStudents + (due > 0 ? 1 : 0),
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
  if (!form.assignmentId) return 'Student fee assignment is required.';
  if (!form.paymentDate) return 'Payment date is required.';
  if (!form.paymentMode) return 'Payment mode is required.';
  if (Number(form.amount || 0) <= 0) return 'Collection amount must be greater than zero.';
  if (assignment && Number(form.amount || 0) > Number(assignment.dueAmount || assignment.totalAmount || 0)) {
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
