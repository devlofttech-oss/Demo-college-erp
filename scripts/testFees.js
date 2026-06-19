import assert from 'node:assert/strict';
import {
  calculateDueAmount,
  calculateFeeStatus,
  getDueBucket,
  summarizeFees,
  validateFeeAdjustment,
  validateFeeCollection,
  validateFeeStructure,
} from '../src/modules/fees/feeUtils.js';

assert.equal(calculateDueAmount(10000, 4000, 1000), 5000);
assert.equal(calculateDueAmount(10000, 12000, 0), 0);
assert.equal(calculateFeeStatus(10000, 10000, 0), 'Paid');
assert.equal(calculateFeeStatus(10000, 4000, 0), 'Partially Paid');
assert.equal(calculateFeeStatus(10000, 0, 0), 'Due');

assert.equal(getDueBucket('2026-06-10', 'Due', new Date('2026-06-19T00:00:00')), 'Overdue');
assert.equal(getDueBucket('2026-06-22', 'Due', new Date('2026-06-19T00:00:00')), 'Due Soon');
assert.equal(getDueBucket('2026-08-01', 'Due', new Date('2026-06-19T00:00:00')), 'Upcoming');
assert.equal(getDueBucket('2026-06-10', 'Paid', new Date('2026-06-19T00:00:00')), 'Cleared');

assert.deepEqual(
  summarizeFees(
    [
      { id: 'a1', totalAmount: 10000 },
      { id: 'a2', totalAmount: 5000 },
    ],
    [{ assignmentId: 'a1', amount: 4000 }],
    [{ assignmentId: 'a2', amount: 1000 }]
  ),
  {
    totalAssigned: 15000,
    totalCollected: 4000,
    totalAdjusted: 1000,
    totalOutstanding: 10000,
    dueStudents: 2,
  }
);

assert.equal(validateFeeStructure({}), 'Fee structure name is required.');
assert.equal(validateFeeStructure({
  name: 'Annual Fee',
  classKey: 'Class XII - A',
  academicYear: '2026-2027',
  totalAmount: 65000,
  dueDate: '2026-07-15',
}), '');

assert.equal(validateFeeCollection({}), 'Student fee assignment is required.');
assert.equal(validateFeeCollection({
  assignmentId: 'a1',
  amount: 6000,
  paymentDate: '2026-06-19',
  paymentMode: 'Cash',
}, { dueAmount: 5000 }), 'Collection amount cannot exceed outstanding due.');

assert.equal(validateFeeAdjustment({}), 'Student fee assignment is required.');
assert.equal(validateFeeAdjustment({
  assignmentId: 'a1',
  amount: 500,
  reason: 'Sibling concession',
}, { dueAmount: 5000 }), '');

console.log('Fees tests passed.');
