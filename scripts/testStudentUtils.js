import assert from 'node:assert/strict';
import {
  getNextClassName,
  latestRecord,
  relationMatches,
  validateStudentProfile,
} from '../src/modules/students/studentUtils.js';

const student = { id: 'student-doc-id', studentId: 'STU-10001' };

assert.equal(relationMatches({ studentRecordId: 'student-doc-id' }, student), true);
assert.equal(relationMatches({ studentId: 'STU-10001' }, student), true);
assert.equal(relationMatches({ studentId: 'STU-99999' }, student), false);

assert.deepEqual(latestRecord([{ id: 1 }, { id: 2 }]), { id: 2 });
assert.equal(latestRecord([]), null);

assert.equal(getNextClassName('Class X'), 'Class XI');
assert.equal(getNextClassName('Class XI'), 'Class XII');
assert.equal(getNextClassName('Class XII'), 'Class XII');

assert.equal(
  validateStudentProfile({
    name: 'Asha Rao',
    guardianName: 'Meera Rao',
    idHolder: 'Asha Rao',
    phone: '+91 98765 43210',
    email: 'asha@student.edu',
    className: 'Class XI',
    section: 'A',
    program: 'PU Science',
    academicYear: '2026-2027',
  }),
  ''
);

assert.equal(validateStudentProfile({}), 'Student name is required.');
assert.equal(
  validateStudentProfile({
    name: 'Asha Rao',
    guardianName: 'Meera Rao',
    idHolder: 'Asha Rao',
    phone: 'bad',
    email: 'asha@student.edu',
    className: 'Class XI',
    section: 'A',
    program: 'PU Science',
    academicYear: '2026-2027',
  }),
  'Enter a valid phone number.'
);

console.log('Student utility tests passed.');
