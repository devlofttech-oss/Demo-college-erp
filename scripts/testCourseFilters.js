import assert from 'node:assert/strict';
import {
  filterByCourse,
  filterStudentScopedRecords,
  filterStudentsByCourse,
} from '../src/modules/shared/courseFilters.js';

const course = { courseCode: 'BSCN', courseName: 'BSC Nursing' };
const students = [
  { id: 's1', studentId: 'STU-1', courseCode: 'BSCN', courseName: 'BSC Nursing' },
  { id: 's2', studentId: 'STU-2', courseCode: 'BPT', courseName: 'BPT' },
];

assert.deepEqual(filterStudentsByCourse(students, 'all'), students);
assert.deepEqual(filterStudentsByCourse(students, 'BSCN', course).map((item) => item.id), ['s1']);

assert.deepEqual(filterByCourse([
  { id: 'subject-1', programName: 'BSC Nursing' },
  { id: 'subject-2', programName: 'BPT' },
], 'BSCN', course).map((item) => item.id), ['subject-1']);

assert.deepEqual(filterStudentScopedRecords([
  { id: 'fee-1', studentRecordId: 's1' },
  { id: 'fee-2', studentId: 'STU-2' },
  { id: 'fee-3', courseCode: 'BSCN' },
], [students[0]], 'BSCN', course).map((item) => item.id), ['fee-1', 'fee-3']);

assert.deepEqual(filterStudentScopedRecords([
  { id: 'student-doc', ownerRecordId: 's1', ownerType: 'Student' },
  { id: 'staff-doc', ownerRecordId: 't1', ownerType: 'Staff', courseCode: 'BSCN' },
  { id: 'other-staff-doc', ownerRecordId: 't2', ownerType: 'Staff', courseCode: 'BPT' },
], [students[0]], 'BSCN', course).map((item) => item.id), ['student-doc', 'staff-doc']);

console.log('Course filter tests passed.');
