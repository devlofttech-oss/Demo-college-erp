import assert from 'node:assert/strict';
import {
  buildClassAnalytics,
  buildCollectionReport,
  buildFinancialSummary,
  buildOutstandingReport,
  withinDateRange,
} from '../src/modules/financialReports/financialReportUtils.js';

const assignments = [
  { id: 'a1', classKey: 'Class XII - A', studentName: 'One', totalAmount: 10000, paidAmount: 4000, adjustmentAmount: 0, dueAmount: 6000, dueDate: '2026-06-10', status: 'Partially Paid' },
  { id: 'a2', classKey: 'Class XII - A', studentName: 'Two', totalAmount: 8000, paidAmount: 8000, adjustmentAmount: 0, dueAmount: 0, dueDate: '2026-06-15', status: 'Paid' },
  { id: 'a3', classKey: 'Class XI - B', studentName: 'Three', totalAmount: 5000, paidAmount: 0, adjustmentAmount: 1000, dueAmount: 4000, dueDate: '2026-06-22', status: 'Due' },
];

const collections = [
  { id: 'c1', assignmentId: 'a1', classKey: 'Class XII - A', amount: 4000, paymentDate: '2026-06-12', paymentMode: 'Cash' },
  { id: 'c2', assignmentId: 'a2', classKey: 'Class XII - A', amount: 8000, paymentDate: '2026-06-18', paymentMode: 'Bank Transfer' },
];

const adjustments = [
  { id: 'j1', assignmentId: 'a3', amount: 1000 },
];

assert.equal(withinDateRange('2026-06-12', '2026-06-01', '2026-06-30'), true);
assert.equal(withinDateRange('2026-07-01', '2026-06-01', '2026-06-30'), false);

const collectionReport = buildCollectionReport(collections, {
  fromDate: '2026-06-01',
  toDate: '2026-06-15',
  classKey: 'Class XII - A',
  paymentMode: 'Cash',
});
assert.equal(collectionReport.rows.length, 1);
assert.equal(collectionReport.totalCollected, 4000);
assert.deepEqual(collectionReport.byMode, { Cash: 4000 });

const outstandingReport = buildOutstandingReport(assignments, new Date('2026-06-19T00:00:00'));
assert.equal(outstandingReport.rows.length, 2);
assert.equal(outstandingReport.totalOutstanding, 10000);
assert.equal(outstandingReport.overdueAmount, 6000);
assert.equal(outstandingReport.dueSoonAmount, 4000);

const analytics = buildClassAnalytics(assignments, collections, adjustments);
assert.equal(analytics.find((item) => item.classKey === 'Class XII - A').collectionRate, 67);
assert.equal(analytics.find((item) => item.classKey === 'Class XI - B').outstanding, 4000);

const summary = buildFinancialSummary(assignments, collections, adjustments, {
  fromDate: '2026-06-01',
  toDate: '2026-06-30',
  classKey: '',
  paymentMode: '',
});
assert.equal(summary.totalAssigned, 23000);
assert.equal(summary.lifetimeCollected, 12000);
assert.equal(summary.totalOutstanding, 10000);
assert.equal(summary.collectionRate, 52);

console.log('Financial report tests passed.');
