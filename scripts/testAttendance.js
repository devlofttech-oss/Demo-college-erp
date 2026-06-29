import assert from 'node:assert/strict';
import {
  buildAttendanceKey,
  buildReport,
  getMonthKey,
  getYearKey,
  relationMatchesEntity,
  summarizeAttendance,
} from '../src/modules/attendance/attendanceUtils.js';

const student = { id: 'student-doc-id', studentId: 'STU-1001' };
const records = [
  { entityRecordId: 'student-doc-id', entityId: 'STU-1001', subjectName: 'Physics', dateText: '18 Jun 2026', status: 'Present' },
  { entityId: 'STU-1002', subjectName: 'Physics', dateText: '18 Jun 2026', status: 'Absent' },
  { entityId: 'STU-1003', subjectName: 'Accountancy', dateText: '19 Jun 2026', status: 'Leave' },
];

assert.equal(buildAttendanceKey('STU-1001', '18 Jun 2026'), 'STU-1001-18 Jun 2026');
assert.equal(buildAttendanceKey('STU-1001', '18 Jun 2026', 'Physics'), 'STU-1001-18 Jun 2026-Physics');
assert.equal(getMonthKey('18 Jun 2026'), 'Jun 2026');
assert.equal(getYearKey('18 Jun 2026'), '2026');
assert.equal(relationMatchesEntity(records[0], student), true);
assert.equal(relationMatchesEntity(records[1], student), false);

assert.deepEqual(summarizeAttendance(records), {
  total: 3,
  present: 1,
  absent: 1,
  leave: 1,
  percentage: 33,
});

assert.equal(Object.keys(buildReport(records, 'daily')).length, 2);
assert.equal(Object.keys(buildReport(records, 'monthly')).length, 1);
assert.equal(Object.keys(buildReport(records, 'yearly')).length, 1);

console.log('Attendance tests passed.');
