import assert from 'node:assert/strict';
import {
  buildAttendanceKey,
  buildReport,
  formatAttendanceTimeRange,
  getAttendanceTimeMinutes,
  getMonthKey,
  getYearKey,
  isAttendanceTimeRangeValid,
  isAttendanceRecordEditable,
  normalizeAttendanceTime,
  recordMatchesAttendanceTimeRange,
  relationMatchesEntity,
  summarizeAttendance,
} from '../src/modules/attendance/attendanceUtils.js';
import {
  buildSemesterOptions,
  getSemesterDisplayForRecord,
  getSemesterNumbersForAcademicRecord,
  getSemesterNumbersForStudent,
  recordMatchesSemester,
} from '../src/modules/shared/semesterUtils.js';

const student = { id: 'student-doc-id', studentId: 'STU-1001' };
const records = [
  { entityRecordId: 'student-doc-id', entityId: 'STU-1001', subjectName: 'Physics', dateText: '18 Jun 2026', status: 'Present' },
  { entityId: 'STU-1002', subjectName: 'Physics', dateText: '18 Jun 2026', status: 'Absent' },
  { entityId: 'STU-1003', subjectName: 'Accountancy', dateText: '19 Jun 2026', status: 'Leave' },
];

assert.equal(buildAttendanceKey('STU-1001', '18 Jun 2026'), 'STU-1001-18 Jun 2026');
assert.equal(buildAttendanceKey('STU-1001', '18 Jun 2026', 'Physics'), 'STU-1001-18 Jun 2026-Physics');
assert.equal(buildAttendanceKey('STU-1001', '18 Jun 2026', 'Physics', '09:00', '10:00'), 'STU-1001-18 Jun 2026-Physics-09:00-10:00');
assert.equal(normalizeAttendanceTime('9:05'), '09:05');
assert.equal(normalizeAttendanceTime('24:00'), '');
assert.equal(getAttendanceTimeMinutes('09:30'), 570);
assert.equal(isAttendanceTimeRangeValid('09:00', '10:00'), true);
assert.equal(isAttendanceTimeRangeValid('10:00', '09:00'), false);
assert.equal(formatAttendanceTimeRange({ openingTime: '09:00', closingTime: '10:00' }), '09:00 - 10:00');
assert.equal(recordMatchesAttendanceTimeRange({ openingTime: '09:00', closingTime: '10:00' }, '9:00', '10:00'), true);
assert.equal(recordMatchesAttendanceTimeRange({ openingTime: '09:00', closingTime: '10:00' }, '10:00', '11:00'), false);
assert.equal(getMonthKey('18 Jun 2026'), 'Jun 2026');
assert.equal(getYearKey('18 Jun 2026'), '2026');
assert.equal(relationMatchesEntity(records[0], student), true);
assert.equal(relationMatchesEntity(records[1], student), false);
assert.equal(isAttendanceRecordEditable({ markedAtIso: '2026-07-06T10:00:00.000Z' }, new Date('2026-07-07T09:59:00.000Z')), true);
assert.equal(isAttendanceRecordEditable({ markedAtIso: '2026-07-06T10:00:00.000Z' }, new Date('2026-07-07T10:01:00.000Z')), false);

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
assert.deepEqual(getSemesterNumbersForStudent({ courseYear: '2nd Year' }), [3, 4]);
assert.deepEqual(getSemesterNumbersForAcademicRecord({ semesterNumbers: [4, 3, 3] }), [3, 4]);
assert.equal(getSemesterDisplayForRecord({ className: '1 St Year' }), 'Semester 1 / Semester 2');
assert.equal(recordMatchesSemester({ courseYear: '2nd Year' }, 'Semester 4'), true);
assert.equal(recordMatchesSemester({ courseYear: '2nd Year' }, 'Semester 2'), false);
assert.deepEqual(buildSemesterOptions([{ courseYear: '1 St Year' }, { courseYear: '2nd Year' }]).map((item) => item.label), [
  'Semester 1',
  'Semester 2',
  'Semester 3',
  'Semester 4',
]);

console.log('Attendance tests passed.');
