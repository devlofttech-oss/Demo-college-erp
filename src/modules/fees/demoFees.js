import { demoStudents } from '../students/demoStudents';

export const demoFeeStudents = demoStudents;

export const demoFeeStructures = [
  {
    id: 'demo-fee-structure-1',
    name: 'Class XII Annual Fee',
    classKey: 'Class XII - A',
    academicYear: '2026-2027',
    tuitionFee: 42000,
    libraryFee: 3000,
    labFee: 8000,
    transportFee: 12000,
    totalAmount: 65000,
    dueDate: '2026-07-15',
    status: 'Active',
    createdAtText: '01 Jun 2026',
  },
  {
    id: 'demo-fee-structure-2',
    name: 'Class XI Commerce Fee',
    classKey: 'Class XI - B',
    academicYear: '2026-2027',
    tuitionFee: 38000,
    libraryFee: 2500,
    labFee: 0,
    transportFee: 9000,
    totalAmount: 49500,
    dueDate: '2026-07-20',
    status: 'Active',
    createdAtText: '01 Jun 2026',
  },
];

export const demoFeeAssignments = [
  {
    id: 'demo-assignment-1',
    feeStructureId: 'demo-fee-structure-1',
    studentRecordId: 'demo-4449',
    studentId: 'STU-4449',
    studentName: 'Vivek Sharma',
    classKey: 'Class XII - A',
    academicYear: '2026-2027',
    totalAmount: 65000,
    paidAmount: 40000,
    adjustmentAmount: 0,
    dueAmount: 25000,
    dueDate: '2026-07-15',
    status: 'Partially Paid',
    assignedAtText: '02 Jun 2026',
  },
  {
    id: 'demo-assignment-2',
    feeStructureId: 'demo-fee-structure-2',
    studentRecordId: 'demo-4450',
    studentId: 'STU-4450',
    studentName: 'Vaibhavi Aggarwal',
    classKey: 'Class XI - B',
    academicYear: '2026-2027',
    totalAmount: 49500,
    paidAmount: 0,
    adjustmentAmount: 2500,
    dueAmount: 47000,
    dueDate: '2026-07-20',
    status: 'Due',
    assignedAtText: '02 Jun 2026',
  },
];

export const demoFeeCollections = [
  {
    id: 'demo-collection-1',
    assignmentId: 'demo-assignment-1',
    studentRecordId: 'demo-4449',
    studentId: 'STU-4449',
    studentName: 'Vivek Sharma',
    amount: 40000,
    paymentMode: 'Cash',
    referenceNo: 'OFF-1001',
    paymentDate: '2026-06-10',
    collectedBy: 'Admin Office',
    status: 'Posted',
    createdAtText: '10 Jun 2026',
  },
];

export const demoFeeAdjustments = [
  {
    id: 'demo-adjustment-1',
    assignmentId: 'demo-assignment-2',
    studentRecordId: 'demo-4450',
    studentId: 'STU-4450',
    studentName: 'Vaibhavi Aggarwal',
    amount: 2500,
    reason: 'Sibling concession',
    status: 'Approved',
    createdAtText: '12 Jun 2026',
  },
];
