import assert from 'node:assert/strict';
import {
  buildAcademicPerformance,
  buildFeeStatus,
  buildParentAttendance,
  getParentLinkedStudents,
  recordsForStudent,
  visibleParentNotices,
  visibleStudentDocuments,
} from '../src/modules/parentPortal/parentPortalUtils.js';

const students = [
  { id: 's1', studentId: 'STU-1', name: 'One', guardianEmail: 'parent@test.com', status: 'Active' },
  { id: 's2', studentId: 'STU-2', name: 'Two', guardianEmail: 'other@test.com', status: 'Active' },
];

const linked = getParentLinkedStudents(students, { roleId: 'parent', email: 'parent@test.com' });
assert.equal(linked.length, 1);
assert.equal(linked[0].id, 's1');
assert.equal(getParentLinkedStudents(students, { roleId: 'admin' }).length, 2);

const records = [
  { id: 'r1', entityRecordId: 's1', entityId: 'STU-1', status: 'Present', dateText: '18 Jun 2026' },
  { id: 'r2', studentRecordId: 's2', studentId: 'STU-2', status: 'Absent', dateText: '18 Jun 2026' },
];
assert.equal(recordsForStudent(records, students[0]).length, 1);
assert.deepEqual(buildParentAttendance(recordsForStudent(records, students[0])), {
  total: 1,
  present: 1,
  absent: 0,
  leave: 0,
  percentage: 100,
  recent: [records[0]],
});

const performance = buildAcademicPerformance(
  [{ studentRecordId: 's1', subject: 'Physics', marksObtained: 45, maxMarks: 50, percentage: 90, grade: 'A+', status: 'Entered' }],
  [{ studentRecordId: 's1', percentage: 88, grade: 'A', status: 'Pass' }]
);
assert.equal(performance.average, 90);
assert.equal(performance.grade, 'A');

assert.deepEqual(buildFeeStatus([
  { totalAmount: 10000, paidAmount: 4000, adjustmentAmount: 1000 },
]), {
  totalAssigned: 10000,
  totalPaid: 4000,
  totalAdjusted: 1000,
  totalDue: 5000,
  status: 'Partially Paid',
});

assert.equal(visibleParentNotices([
  { status: 'Published', audience: 'Parents', expiryDate: '2099-01-01' },
  { status: 'Draft', audience: 'Parents', expiryDate: '2099-01-01' },
  { status: 'Published', audience: 'Faculty', expiryDate: '2099-01-01' },
]).length, 1);

assert.equal(visibleStudentDocuments([
  { ownerType: 'Student', ownerRecordId: 's1', verificationStatus: 'Verified' },
  { ownerType: 'Student', ownerRecordId: 's1', verificationStatus: 'Pending Review' },
], students[0]).length, 1);

console.log('Parent portal tests passed.');
