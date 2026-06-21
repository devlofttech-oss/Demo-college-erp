import { summarizeAttendance } from '../attendance/attendanceUtils.js';
import { calculateDueAmount } from '../fees/feeUtils.js';

export function getParentLinkedStudents(students = [], currentUser = {}) {
  if (currentUser.roleId !== 'parent') {
    return students.filter((student) => student.status !== 'Archived');
  }

  const linkedRecordIds = new Set(currentUser.linkedStudentRecordIds || []);
  const linkedStudentIds = new Set(currentUser.linkedStudentIds || []);
  return students.filter((student) =>
    student.status !== 'Archived' &&
    (linkedRecordIds.has(student.id) || linkedStudentIds.has(student.studentId))
  );
}

export function recordsForStudent(records = [], student = {}) {
  return records.filter((record) =>
    record.studentRecordId === student.id ||
    record.entityRecordId === student.id ||
    record.studentId === student.studentId ||
    record.entityId === student.studentId
  );
}

export function buildParentAttendance(records = []) {
  const summary = summarizeAttendance(records);
  const recent = [...records].slice(0, 8);
  return { ...summary, recent };
}

export function buildAcademicPerformance(marks = [], results = []) {
  const latestResult = results[0] || null;
  const subjectRows = marks.map((item) => ({
    subject: item.subject,
    marksObtained: Number(item.marksObtained || 0),
    maxMarks: Number(item.maxMarks || 0),
    percentage: Number(item.percentage || 0),
    grade: item.grade || '',
    status: item.status || 'Entered',
  }));
  const average = subjectRows.length
    ? Math.round(subjectRows.reduce((sum, item) => sum + item.percentage, 0) / subjectRows.length)
    : Number(latestResult?.percentage || 0);
  return {
    latestResult,
    subjectRows,
    average,
    grade: latestResult?.grade || subjectRows[0]?.grade || '-',
    status: latestResult?.status || '-',
  };
}

export function buildFeeStatus(assignments = []) {
  const totalAssigned = assignments.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0);
  const totalPaid = assignments.reduce((sum, item) => sum + Number(item.paidAmount || 0), 0);
  const totalAdjusted = assignments.reduce((sum, item) => sum + Number(item.adjustmentAmount || 0), 0);
  const totalDue = assignments.reduce((sum, item) => sum + calculateDueAmount(item.totalAmount, item.paidAmount, item.adjustmentAmount), 0);
  return {
    totalAssigned,
    totalPaid,
    totalAdjusted,
    totalDue,
    status: totalDue <= 0 ? 'Paid' : totalPaid > 0 || totalAdjusted > 0 ? 'Partially Paid' : 'Due',
  };
}

export function visibleParentNotices(notices = []) {
  const now = new Date();
  return notices.filter((item) => {
    if (item.status !== 'Published') return false;
    if (!['All', 'Parents', 'Students'].includes(item.audience)) return false;
    if (!item.expiryDate) return true;
    return new Date(`${item.expiryDate}T23:59:59`) >= now;
  });
}

export function visibleStudentDocuments(documents = [], student = {}) {
  return documents.filter((item) =>
    item.ownerType === 'Student' &&
    item.verificationStatus === 'Verified' &&
    (item.ownerRecordId === student.id || item.ownerId === student.studentId)
  );
}
