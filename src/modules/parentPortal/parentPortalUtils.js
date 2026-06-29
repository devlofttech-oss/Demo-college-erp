import { summarizeAttendance } from '../attendance/attendanceUtils.js';
import { calculateDueAmount } from '../fees/feeUtils.js';

const courseSubjectMap = {
  ATOT: ['Anatomy', 'Physiology', 'Anesthesia Technology', 'Operation Theatre Technology', 'Microbiology'],
  BSCN: ['Anatomy & Physiology', 'Nursing Foundation', 'Nutrition', 'Biochemistry', 'Psychology'],
  BOT: ['Anatomy', 'Physiology', 'Occupational Therapy Foundation', 'Psychology', 'Biomechanics'],
  BPT: ['Anatomy', 'Physiology', 'Exercise Therapy', 'Electrotherapy', 'Biomechanics'],
  MIT: ['Anatomy', 'Radiographic Positioning', 'Imaging Physics', 'Patient Care', 'Darkroom Techniques'],
  MLT: ['Anatomy', 'Physiology', 'Biochemistry', 'Pathology', 'Microbiology'],
};

function normalizeSubject(value = '') {
  return String(value).trim().toLowerCase();
}

function getCourseSubjectKey(student = {}) {
  const source = `${student.courseCode || ''} ${student.courseName || ''} ${student.program || ''}`.toUpperCase();
  if (source.includes('ATOT') || source.includes('ANAESTHESIA') || source.includes('ANESTHESIA') || source.includes('OPERATION THEATER') || source.includes('OPERATION THEATRE')) return 'ATOT';
  if (source.includes('BSCN') || source.includes('NURSING')) return 'BSCN';
  if (source.includes('BOT') || source.includes('OCCUPATIONAL')) return 'BOT';
  if (source.includes('BPT') || source.includes('PHYSIOTHERAPY')) return 'BPT';
  if (source.includes('MIT') || source.includes('IMAGING')) return 'MIT';
  if (source.includes('MLT') || source.includes('MEDICAL LAB')) return 'MLT';
  return '';
}

export function getCourseSubjects(student = {}, academicSubjects = []) {
  const studentPrograms = [student.program, student.courseName, student.courseCode]
    .filter(Boolean)
    .map((item) => String(item).trim().toLowerCase());
  const configuredSubjects = academicSubjects
    .filter((item) => {
      const programName = String(item.programName || '').trim().toLowerCase();
      return programName && studentPrograms.some((program) => program === programName || program.includes(programName) || programName.includes(program));
    })
    .map((item) => item.subjectName)
    .filter(Boolean);
  if (configuredSubjects.length) return [...new Set(configuredSubjects)];
  return courseSubjectMap[getCourseSubjectKey(student)] || ['General Attendance'];
}

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

export function buildParentAttendance(records = [], student = {}, academicSubjects = []) {
  const summary = summarizeAttendance(records);
  const subjects = getCourseSubjects(student, academicSubjects);
  const hasSubjectRecords = records.some((record) => record.subject || record.subjectName);
  const subjectRows = subjects.map((subject) => {
    const subjectRecords = records.filter((record) => normalizeSubject(record.subjectName || record.subject) === normalizeSubject(subject));
    const rowRecords = hasSubjectRecords ? subjectRecords : records;
    const rowSummary = summarizeAttendance(rowRecords);
    return {
      subject,
      ...rowSummary,
      status: rowSummary.total ? `${rowSummary.percentage}%` : 'Not Marked',
    };
  });
  return { ...summary, subjectRows };
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
