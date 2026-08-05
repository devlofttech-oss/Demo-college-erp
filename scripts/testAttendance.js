import assert from 'node:assert/strict';
import {
  buildAttendanceKey,
  buildReport,
  formatAttendanceDateInput,
  formatAttendanceTimeRange,
  getAttendanceReportDateText,
  getAttendanceTimeMinutes,
  getMonthKey,
  getYearKey,
  isAttendanceTimeRangeValid,
  isAttendanceRecordEditable,
  mergeAttendanceRecords,
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
import { getDepartmentForAcademicRecord } from '../src/modules/shared/academicDepartments.js';
import { applyStudentActivityOverrides, isActiveStudentRecord, isInactiveStudentOverride } from '../src/modules/shared/studentActivityPolicy.js';
import {
  canMarkStudentAttendanceForEntity,
  filterStudentsByFacultyAttendanceAccess,
  getFacultyAttendanceAccess,
} from '../src/modules/attendance/attendanceAccess.js';

const student = { id: 'student-doc-id', studentId: 'STU-1001' };
const records = [
  { entityRecordId: 'student-doc-id', entityId: 'STU-1001', subjectName: 'Physics', dateText: '18 Jun 2026', status: 'Present' },
  { entityId: 'STU-1002', subjectName: 'Physics', dateText: '18 Jun 2026', status: 'Absent' },
  { entityId: 'STU-1003', subjectName: 'Accountancy', dateText: '19 Jun 2026', status: 'Leave' },
];

assert.equal(buildAttendanceKey('STU-1001', '18 Jun 2026'), 'STU-1001-18 Jun 2026');
assert.equal(buildAttendanceKey('STU-1001', '18 Jun 2026', 'Physics'), 'STU-1001-18 Jun 2026-Physics');
assert.equal(buildAttendanceKey('STU-1001', '18 Jun 2026', 'Physics', '09:00', '10:00'), 'STU-1001-18 Jun 2026-Physics-09:00-10:00');
assert.equal(formatAttendanceDateInput('2026-06-18'), '18 Jun 2026');
assert.equal(formatAttendanceDateInput('bad'), '');
assert.equal(getAttendanceReportDateText({ dateInput: '2026-06-20' }), '20 Jun 2026');
assert.equal(getAttendanceReportDateText({ markedAtIso: '2026-06-21T10:00:00.000Z' }), '21 Jun 2026');
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
assert.equal(buildReport(records, 'daily')['18 Jun 2026'].length, 2);
assert.equal(buildReport(records, 'monthly')['Jun 2026'].length, 3);
assert.equal(buildReport(records, 'yearly')['2026'].length, 3);
assert.equal(buildReport([{ dateInput: '2026-06-20', status: 'Present' }], 'daily')['20 Jun 2026'].length, 1);
assert.equal(buildReport([{ status: 'Present' }], 'daily')['Unspecified date'].length, 1);
assert.equal(Object.keys(buildReport(records, 'monthly')).length, 1);
assert.equal(Object.keys(buildReport(records, 'yearly')).length, 1);
assert.deepEqual(
  mergeAttendanceRecords(
    [
      { id: 'att-1', status: 'Absent', dateText: '18 Jun 2026' },
      { id: 'att-2', status: 'Present', dateText: '19 Jun 2026' },
    ],
    [
      { id: 'att-3', status: 'Present', dateText: '20 Jun 2026' },
      { id: 'att-1', status: 'Present', dateText: '18 Jun 2026' },
    ]
  ).map((record) => [record.id, record.status, record.dateText]),
  [
    ['att-3', 'Present', '20 Jun 2026'],
    ['att-1', 'Present', '18 Jun 2026'],
    ['att-2', 'Present', '19 Jun 2026'],
  ]
);
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
assert.equal(getDepartmentForAcademicRecord({ courseCode: 'BSCN', courseName: 'BSC Nursing' }), 'Nursing');
assert.equal(getDepartmentForAcademicRecord({ courseCode: 'BPT', courseName: 'BPT' }), 'Physiotherapy');
assert.equal(getDepartmentForAcademicRecord({ courseCode: 'MITREG', courseName: 'I B Sc Imaging Technology' }), 'Allied Health Sciences');
assert.equal(isInactiveStudentOverride({ studentId: 'BSCN-033' }), true);
assert.equal(applyStudentActivityOverrides([{ studentId: 'BSCN-034', status: 'Active' }])[0].status, 'Archived');
assert.equal(isActiveStudentRecord({ studentId: 'BSCN-035', status: 'Active' }), false);

const facultyStaff = [
  { id: 'seed-staff-anusha-shine', employeeId: 'FAC-1006', name: 'Anusha Shine', department: 'Nursing' },
  { id: 'seed-staff-tejas-m', employeeId: 'FAC-1005', name: 'Tejas M', department: 'Allied Health Sciences' },
  { id: 'seed-staff-priyanka-ns', employeeId: 'FAC-1003', name: 'Priyanka N S', department: 'Physiotherapy' },
];
const nursingAccess = getFacultyAttendanceAccess(
  { roleId: 'faculty', sourceRecordId: 'seed-staff-anusha-shine', displayId: 'FAC-1006' },
  facultyStaff
);
assert.equal(nursingAccess.canMarkStudents, true);
assert.equal(nursingAccess.department, 'Nursing');
assert.equal(canMarkStudentAttendanceForEntity({ courseCode: 'BSCN' }, nursingAccess), true);
assert.equal(canMarkStudentAttendanceForEntity({ courseCode: 'BPT' }, nursingAccess), false);
assert.deepEqual(
  filterStudentsByFacultyAttendanceAccess([{ studentId: 'BSCN-001', courseCode: 'BSCN' }, { studentId: 'BPT-001', courseCode: 'BPT' }], nursingAccess).map((item) => item.studentId),
  ['BSCN-001']
);
assert.equal(getFacultyAttendanceAccess({ roleId: 'faculty', name: 'Faculty User', department: 'Nursing' }, facultyStaff).canMarkStudents, false);
assert.equal(canMarkStudentAttendanceForEntity({ courseCode: 'BPT' }, getFacultyAttendanceAccess({ roleId: 'admin' }, facultyStaff)), true);

console.log('Attendance tests passed.');
