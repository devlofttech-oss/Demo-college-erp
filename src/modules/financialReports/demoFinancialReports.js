import { demoFeeAdjustments, demoFeeAssignments, demoFeeCollections, demoFeeStructures, demoFeeStudents } from '../fees/demoFees';

export const demoFinancialStudents = demoFeeStudents;
export const demoFinancialStructures = demoFeeStructures;
export const demoFinancialAssignments = demoFeeAssignments;

export const demoFinancialCollections = demoFeeCollections.map((item) => ({
  ...item,
  classKey: demoFeeAssignments.find((assignment) => assignment.id === item.assignmentId)?.classKey || '',
}));

export const demoFinancialAdjustments = demoFeeAdjustments;

export const demoFinancialSnapshots = [
  {
    id: 'demo-financial-snapshot-1',
    reportName: 'June 2026 Finance Summary',
    totalAssigned: 114500,
    lifetimeCollected: 40000,
    totalOutstanding: 72000,
    totalAdjusted: 2500,
    collectionRate: 35,
    createdAtText: '19 Jun 2026',
    status: 'Generated',
  },
];
