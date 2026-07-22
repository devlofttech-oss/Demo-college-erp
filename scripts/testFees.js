import assert from 'node:assert/strict';
import {
  calculateAssignmentPaymentLedger,
  calculatePendingAgentFeeBalance,
  calculateDueAmount,
  calculateFeeStatus,
  formatPaymentDate,
  formatManualDueItems,
  getCollectionsForFeeContext,
  getFeeComponentValues,
  getDueBucket,
  getManualDueItemAmount,
  getManualDueItemOptions,
  getPaymentSortTime,
  isAdmissionThroughAgent,
  normalizeManualDueItems,
  normalizePaymentEntries,
  sortPaymentRecordsByDate,
  summarizeFees,
  sumPaymentEntryAgentFees,
  sumPaymentEntries,
  totalManualDueItems,
  totalFeeComponents,
  validateFeeAdjustment,
  validateFeeCollection,
  validateFeeStructure,
} from '../src/modules/fees/feeUtils.js';

assert.deepEqual(getFeeComponentValues({
  admissionFee: 1000,
  applicationFee: 500,
  pocketArticleFee: 750,
  tuitionFee: 2000,
}), {
  admissionFee: 1000,
  applicationFee: 500,
  pocketArticleFee: 750,
  tuitionFee: 2000,
  libraryFee: 0,
  labFee: 0,
  transportFee: 0,
  agentFee: 0,
});
assert.equal(totalFeeComponents({ applicationFee: 500, pocketArticleFee: 750, tuitionFee: 2000 }), 3250);
assert.equal(totalFeeComponents({ tuitionFee: 2000, agentFee: 5000 }), 2000);
assert.equal(totalFeeComponents({ tuitionFee: 2000, agentFee: 5000, admissionThroughAgent: true }), 2000);
assert.equal(isAdmissionThroughAgent({ admissionSource: 'Agent - Kerala desk' }), true);
assert.equal(isAdmissionThroughAgent({ admissionSource: 'Direct Walk-in' }), false);
assert.equal(calculatePendingAgentFeeBalance(25000, 10000), 15000);
assert.equal(getManualDueItemOptions({ admissionThroughAgent: true }).some((item) => item.id === 'agent-fee'), false);
assert.equal(getManualDueItemOptions({ admissionThroughAgent: false }).some((item) => item.id === 'agent-fee'), false);
assert.deepEqual(normalizeManualDueItems(['application-fee', { id: 'pocket-article-fee' }, 'application-fee']), [
  { id: 'application-fee', label: 'Application Fee' },
  { id: 'pocket-article-fee', label: 'Pocket Article Fee' },
]);
assert.deepEqual(normalizeManualDueItems(['agent-fee']), []);
assert.deepEqual(normalizeManualDueItems([{ label: 'Agent Fee' }]), []);
assert.equal(formatManualDueItems(['application-fee', 'pocket-article-fee']), 'Application Fee, Pocket Article Fee');
assert.equal(formatManualDueItems(['agent-fee']), '');
assert.equal(getManualDueItemAmount({ id: 'application-fee' }, { applicationFee: 500 }), 500);
assert.equal(getManualDueItemAmount('year-fee', { tuitionFee: 2000 }), 2000);
assert.equal(totalManualDueItems(['application-fee', 'year-fee'], { applicationFee: 500, tuitionFee: 2000 }), 2500);
assert.equal(totalManualDueItems(['other-due'], { otherDueAmount: 750 }), 750);
const normalizedPaymentEntries = normalizePaymentEntries([
  { amount: '20000', paymentMode: 'Cash', creditedToAccount: 'Cash Counter', referenceNo: 'B-001', paymentDate: '2026-07-01', paymentTime: '10:00', agentFeePaidAmount: '2500' },
  { amount: '40000', paymentMode: 'UPI Manual Entry', creditedToAccount: 'SBI Current', referenceNo: 'B-002', paymentDate: '2026-07-05', paymentTime: '11:30', agentFeePaidAmount: '5000' },
]);
assert.equal(sumPaymentEntries(normalizedPaymentEntries), 60000);
assert.equal(sumPaymentEntryAgentFees(normalizedPaymentEntries), 7500);
assert.deepEqual(normalizedPaymentEntries.map((entry) => [entry.amount, entry.creditedToAccount, entry.referenceNo, entry.paymentTime, entry.agentFeePaidAmount]), [
  [20000, 'Cash Counter', 'B-001', '10:00', 2500],
  [40000, 'SBI Current', 'B-002', '11:30', 5000],
]);
assert.equal(formatPaymentDate('2026-07-05'), '05-07-2026');
assert.equal(formatPaymentDate('05-07-2026'), '05-07-2026');
assert.equal(getPaymentSortTime({ paymentDate: '2026-07-05', paymentTime: '11:30' }) > getPaymentSortTime({ paymentDate: '2026-07-01', paymentTime: '10:00' }), true);
assert.deepEqual(sortPaymentRecordsByDate([
  { id: 'old', paymentDate: '2026-07-01', paymentTime: '10:00' },
  { id: 'new', paymentDate: '2026-07-05', paymentTime: '11:30' },
]).map((item) => item.id), ['new', 'old']);

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

assert.deepEqual(
  calculateAssignmentPaymentLedger(
    { id: 'a1', totalAmount: 10000, adjustmentAmount: 1000, paidAmount: 2500 },
    [
      { id: 'p1', assignmentId: 'a1', amount: 3000, status: 'Posted' },
      { id: 'p2', assignmentId: 'a1', amount: 2000, status: 'Posted' },
    ]
  ),
  {
    paymentCount: 2,
    paidAmount: 5000,
    adjustmentAmount: 1000,
    dueAmount: 4000,
    status: 'Partially Paid',
    agentFeePaid: 0,
    pendingAgentFeeBalance: 0,
  }
);
assert.deepEqual(
  calculateAssignmentPaymentLedger(
    { id: 'a1', totalAmount: 10000, adjustmentAmount: 0, paidAmount: 7000 },
    [{ id: 'p2', assignmentId: 'a1', amount: 3000, status: 'Posted' }],
    { useLegacyPaidFallback: false }
  ),
  {
    paymentCount: 1,
    paidAmount: 3000,
    adjustmentAmount: 0,
    dueAmount: 7000,
    status: 'Partially Paid',
    agentFeePaid: 0,
    pendingAgentFeeBalance: 0,
  }
);
assert.deepEqual(
  calculateAssignmentPaymentLedger(
    { id: 'a2', totalAmount: 50000, admissionThroughAgent: true, agentFee: 15000 },
    [
      { id: 'p1', assignmentId: 'a2', amount: 20000, agentFeePaidAmount: 5000, status: 'Posted' },
      { id: 'p2', assignmentId: 'a2', amount: 10000, agentFeePaidAmount: 2500, status: 'Posted' },
    ]
  ),
  {
    paymentCount: 2,
    paidAmount: 30000,
    adjustmentAmount: 0,
    dueAmount: 20000,
    status: 'Partially Paid',
    agentFeePaid: 7500,
    pendingAgentFeeBalance: 7500,
  }
);
assert.deepEqual(
  calculateAssignmentPaymentLedger(
    { id: 'a3', totalAmount: 7000, tuitionFee: 2000, admissionThroughAgent: true, agentFee: 5000 },
    [{ id: 'p1', assignmentId: 'a3', amount: 1000, agentFeePaidAmount: 1500, status: 'Posted' }]
  ),
  {
    paymentCount: 1,
    paidAmount: 1000,
    adjustmentAmount: 0,
    dueAmount: 1000,
    status: 'Partially Paid',
    agentFeePaid: 1500,
    pendingAgentFeeBalance: 3500,
  }
);
assert.deepEqual(
  getCollectionsForFeeContext(
    [
      { id: 'p1', assignmentId: '', studentRecordId: 's1', feeStructureId: 'f1', amount: 50000 },
      { id: 'p2', assignmentId: 'a2', studentRecordId: 's1', feeStructureId: 'f2', amount: 10000 },
      { id: 'p3', assignmentId: '', studentRecordId: 's2', feeStructureId: 'f1', amount: 8000 },
    ],
    { assignmentId: 'a1', studentRecordId: 's1', feeStructureId: 'f1' }
  ).map((item) => item.id),
  ['p1']
);
assert.deepEqual(
  getCollectionsForFeeContext(
    [
      { id: 'p1', assignmentId: '', studentRecordId: 's1', studentName: 'Dhanush B V', feeStructureId: 'f1', amount: 50000 },
      { id: 'p2', assignmentId: '', studentRecordId: 's2', studentName: 'Other Student', feeStructureId: 'f2', amount: 10000 },
    ],
    { studentRecordId: 's1', studentName: 'Dhanush B V' },
    '',
    { allowStudentOnly: true }
  ).map((item) => item.id),
  ['p1']
);
assert.deepEqual(
  getCollectionsForFeeContext(
    [
      { id: 'p1', assignmentId: 'a1', studentRecordId: 's1', feeStructureId: 'f1', amount: 50000 },
      { id: 'p2', assignmentId: '', studentRecordId: 's1', feeStructureId: 'f1', amount: 10000 },
    ],
    { assignmentId: 'a1', studentRecordId: 's1', feeStructureId: 'f1' },
    'p1'
  ).map((item) => item.id),
  ['p2']
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
assert.equal(validateFeeCollection({ entryMode: 'structure' }), 'Student is required.');
assert.equal(validateFeeCollection({
  entryMode: 'structure',
  studentRecordId: 'student-1',
}), 'Fee structure is required.');
assert.equal(validateFeeCollection({
  entryMode: 'structure',
  studentRecordId: 'student-1',
  feeStructureId: 'fee-1',
  totalAmount: 65000,
  paymentEntries: [
    { amount: 2000, paymentDate: '2026-06-19', paymentTime: '10:00', paymentMode: 'Cash' },
    { amount: 3000, paymentDate: '2026-06-20', paymentTime: '12:00', paymentMode: 'Bank Transfer' },
  ],
}), '');
assert.equal(validateFeeCollection({
  assignmentId: 'a1',
  paymentEntries: [
    { amount: 3000, paymentDate: '2026-06-19', paymentTime: '10:00', paymentMode: 'Cash' },
    { amount: 3000, paymentDate: '2026-06-20', paymentTime: '11:00', paymentMode: 'Cash' },
  ],
}, { dueAmount: 5000 }), 'Collection amount cannot exceed outstanding due.');

assert.equal(validateFeeAdjustment({}), 'Student fee assignment is required.');
assert.equal(validateFeeAdjustment({
  assignmentId: 'a1',
  amount: 500,
  reason: 'Sibling concession',
}, { dueAmount: 5000 }), '');

console.log('Fees tests passed.');
