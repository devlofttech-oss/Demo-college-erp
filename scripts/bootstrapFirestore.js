import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp } from 'firebase/app';
import { getFirestore, serverTimestamp, setDoc, doc } from 'firebase/firestore';

function loadEnv() {
  const envPath = resolve(process.cwd(), '.env');
  const raw = readFileSync(envPath, 'utf8');
  const env = {};

  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const index = trimmed.indexOf('=');
    if (index === -1) return;
    env[trimmed.slice(0, index)] = trimmed.slice(index + 1);
  });

  return env;
}

const env = loadEnv();

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID,
};

const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'appId'];
const missing = requiredKeys.filter((key) => !firebaseConfig[key]);

if (missing.length) {
  throw new Error(`Missing Firebase config values: ${missing.join(', ')}`);
}

const collections = {
  students: {
    purpose: 'Main student profile records',
    fields: [
      'admissionNo',
      'studentId',
      'name',
      'className',
      'section',
      'program',
      'guardianName',
      'idHolder',
      'academicYear',
      'phone',
      'email',
      'status',
      'createdAtText',
      'updatedAtText',
      'archivedAtText',
      'restoredAtText',
    ],
  },
  studentAdmissions: {
    purpose: 'Admission form, admission workflow, and status history',
    fields: ['studentId', 'admissionNo', 'academicYear', 'idHolder', 'status', 'submittedAt', 'approvedAt'],
  },
  studentDocuments: {
    purpose: 'Student document repository',
    fields: [
      'studentRecordId',
      'studentId',
      'documentType',
      'academicYear',
      'uploadedBy',
      'fileName',
      'fileSize',
      'fileType',
      'fileUrl',
      'storagePath',
      'verificationStatus',
      'uploadedAtText',
      'verifiedAtText',
    ],
  },
  studentPromotions: {
    purpose: 'Student promotion records',
    fields: ['studentRecordId', 'studentId', 'fromClass', 'toClass', 'academicYear', 'status', 'approvedBy', 'approvedAtText'],
  },
  studentTransfers: {
    purpose: 'Student transfer requests and certificate tracking',
    fields: ['studentRecordId', 'studentId', 'transferType', 'reason', 'academicYear', 'status', 'requestedAtText', 'certificateUrl'],
  },
  users: {
    purpose: 'ERP user profiles linked to Firebase Auth users',
    fields: ['uid', 'name', 'email', 'roleId', 'status', 'createdBy', 'createdAtText', 'updatedAtText'],
  },
  roles: {
    purpose: 'ERP role definitions and permission maps',
    fields: ['id', 'name', 'description', 'locked', 'permissions'],
  },
  staffMembers: {
    purpose: 'Faculty and staff master records',
    fields: ['employeeId', 'name', 'staffType', 'department', 'designation', 'phone', 'email', 'qualification', 'status', 'createdAtText', 'updatedAtText', 'archivedAtText', 'restoredAtText'],
  },
  departments: {
    purpose: 'Department master data and allocation support',
    fields: ['name', 'headName', 'status'],
  },
  staffLeaveRecords: {
    purpose: 'Faculty and staff leave requests and approvals',
    fields: ['staffRecordId', 'employeeId', 'leaveType', 'fromDate', 'toDate', 'reason', 'status', 'requestedAtText', 'decidedAtText'],
  },
  staffAttendanceRecords: {
    purpose: 'Faculty and staff daily attendance tracking',
    fields: ['staffRecordId', 'employeeId', 'academicYear', 'dateText', 'status', 'markedAtText'],
  },
  studentAttendanceRecords: {
    purpose: 'Student daily attendance tracking',
    fields: ['entityType', 'entityRecordId', 'entityId', 'entityName', 'className', 'section', 'dateText', 'status', 'markedAtText', 'parentNotified', 'parentNotifiedAtText'],
  },
  attendanceNotifications: {
    purpose: 'Parent notification queue metadata for attendance events',
    fields: ['studentRecordId', 'studentId', 'studentName', 'channel', 'academicYear', 'reason', 'status', 'attendanceRecordId', 'createdAtText'],
  },
  classrooms: {
    purpose: 'Classroom master data for timetable allocation',
    fields: ['roomNo', 'building', 'capacity', 'status'],
  },
  timetableEntries: {
    purpose: 'Class and faculty timetable entries',
    fields: ['classKey', 'subject', 'academicYear', 'facultyId', 'facultyName', 'classroomId', 'classroomName', 'day', 'timeSlot', 'status', 'createdAtText', 'updatedAtText', 'archivedAtText'],
  },
  timetablePublications: {
    purpose: 'Timetable publishing metadata',
    fields: ['classKey', 'academicYear', 'status', 'publishedAtText', 'entryCount'],
  },
  examSchedules: {
    purpose: 'Exam schedule records',
    fields: ['examName', 'classKey', 'subject', 'academicYear', 'examDate', 'maxMarks', 'facultyId', 'facultyName', 'status', 'createdAtText', 'updatedAtText'],
  },
  internalAssessments: {
    purpose: 'Internal assessment setup records',
    fields: ['title', 'classKey', 'subject', 'academicYear', 'maxMarks', 'status', 'createdAtText'],
  },
  marksEntries: {
    purpose: 'Student marks entry records',
    fields: ['examScheduleId', 'studentRecordId', 'studentId', 'studentName', 'classKey', 'subject', 'academicYear', 'marksObtained', 'maxMarks', 'percentage', 'grade', 'status', 'enteredAtText'],
  },
  studentResults: {
    purpose: 'Generated student result summaries',
    fields: ['studentRecordId', 'studentId', 'studentName', 'classKey', 'examName', 'academicYear', 'totalObtained', 'totalMax', 'percentage', 'grade', 'status', 'generatedAtText'],
  },
  reportCards: {
    purpose: 'Report card generation metadata',
    fields: ['studentRecordId', 'studentId', 'examName', 'academicYear', 'status', 'generatedAtText'],
  },
  feeStructures: {
    purpose: 'Class-wise fee structure setup',
    fields: ['name', 'classKey', 'academicYear', 'tuitionFee', 'libraryFee', 'labFee', 'transportFee', 'totalAmount', 'dueDate', 'status', 'createdAtText', 'updatedAtText'],
  },
  feeAssignments: {
    purpose: 'Student fee assignment and due tracking',
    fields: ['feeStructureId', 'studentRecordId', 'studentId', 'studentName', 'classKey', 'academicYear', 'totalAmount', 'paidAmount', 'adjustmentAmount', 'dueAmount', 'dueDate', 'status', 'assignedAtText', 'updatedAtText'],
  },
  feeCollections: {
    purpose: 'Manual/offline fee collection records',
    fields: ['assignmentId', 'studentRecordId', 'studentId', 'studentName', 'amount', 'academicYear', 'paymentMode', 'referenceNo', 'paymentDate', 'collectedBy', 'status', 'createdAtText'],
  },
  feeAdjustments: {
    purpose: 'Fee concessions, waivers, and approved adjustments',
    fields: ['assignmentId', 'studentRecordId', 'studentId', 'studentName', 'amount', 'academicYear', 'reason', 'status', 'createdAtText'],
  },
  financialReportSnapshots: {
    purpose: 'Saved financial report summary snapshots',
    fields: ['reportName', 'filters', 'totalAssigned', 'lifetimeCollected', 'filteredCollected', 'totalAdjusted', 'totalOutstanding', 'overdueAmount', 'dueSoonAmount', 'collectionRate', 'classCount', 'dueStudentCount', 'status', 'createdAtText'],
  },
  noticeItems: {
    purpose: 'Digital notices, circulars, and event announcements',
    fields: ['type', 'title', 'referenceNo', 'audience', 'academicYear', 'priority', 'body', 'publishDate', 'expiryDate', 'status', 'createdByName', 'createdAtText', 'updatedAtText', 'archivedAtText'],
  },
  managedDocuments: {
    purpose: 'Student, staff, and academic archive document metadata',
    fields: ['ownerType', 'ownerRecordId', 'ownerId', 'ownerName', 'archiveTitle', 'documentType', 'category', 'fileName', 'fileSize', 'fileType', 'fileUrl', 'storagePath', 'verificationStatus', 'uploadedAtText', 'verifiedAtText', 'archivedAtText', 'tags'],
  },
  parentPortalLinks: {
    purpose: 'Optional parent-to-student relationship map for portal filtering',
    fields: ['parentUserId', 'parentEmail', 'studentRecordId', 'studentId', 'relationship', 'status'],
  },
  academicPrograms: {
    purpose: 'Academic program and curriculum master records',
    fields: ['name', 'code', 'academicYear', 'status', 'createdAtText', 'updatedAtText'],
  },
  academicSubjects: {
    purpose: 'Subject master records mapped to programs',
    fields: ['subjectName', 'subjectCode', 'programName', 'creditHours', 'status', 'createdAtText', 'updatedAtText'],
  },
  academicBatches: {
    purpose: 'Class, section, capacity, and class teacher setup',
    fields: ['className', 'section', 'programName', 'classTeacher', 'capacity', 'status', 'createdAtText', 'updatedAtText'],
  },
  academicCalendarEvents: {
    purpose: 'Academic calendar event records',
    fields: ['title', 'eventType', 'eventDate', 'audience', 'academicYear', 'status', 'createdAtText', 'updatedAtText'],
  },
  systemSettings: {
    purpose: 'Institute profile, academic year, ID formats, and module defaults',
    fields: ['id', 'name', 'email', 'phone', 'address', 'city', 'startsOn', 'endsOn', 'student', 'admission', 'employee', 'receipt', 'studentAdmissions', 'staffLeave', 'timetablePublishing', 'parentPortal', 'onlinePayments', 'receiptGeneration', 'communicationModule', 'updatedAtText'],
  },
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

for (const [collectionName, schema] of Object.entries(collections)) {
  await setDoc(doc(db, collectionName, '__schema'), {
    ...schema,
    createdBy: 'CollegeERP bootstrap',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  console.log(`Created/updated ${collectionName}/__schema`);
}

console.log('Student Information Management collections are ready.');

