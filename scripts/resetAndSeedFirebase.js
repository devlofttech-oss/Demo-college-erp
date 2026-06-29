import { existsSync, readFileSync } from 'node:fs';
import { cert, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { demoDepartments, demoStaffMembers } from '../src/modules/facultyStaff/demoFacultyStaff.js';
import { admissionCourses, admissionStudents } from '../src/modules/students/admissionSeedData.js';

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function getCredential() {
  const explicitPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const localPath = './serviceAccountKey.json';
  if (explicitPath && existsSync(explicitPath)) return cert(readJson(explicitPath));
  if (existsSync(localPath)) return cert(readJson(localPath));
  throw new Error('Missing service account. Add serviceAccountKey.json or set GOOGLE_APPLICATION_CREDENTIALS.');
}

initializeApp({
  credential: getCredential(),
});

const db = getFirestore();
const shouldReset = process.argv.includes('--reset');
const confirmed = process.argv.includes('--yes-i-understand-this-deletes-data');

const schemas = {
  colleges: ['id', 'name', 'code', 'location', 'logoUrl', 'logoFileName', 'status'],
  admissionBatches: ['academicYear', 'collegeName', 'collegeCode', 'courseName', 'courseCode', 'courseYear', 'admissionType', 'sourcePdf', 'studentCount', 'status'],
  students: ['admissionNo', 'studentId', 'name', 'profilePhotoUrl', 'profilePhotoName', 'nameAsInAadhaar', 'fatherName', 'motherName', 'dob', 'gender', 'bloodGroup', 'mobileNo', 'alternatePhoneNo', 'phone', 'email', 'address', 'nationality', 'state', 'ruralUrban', 'religion', 'className', 'section', 'program', 'courseCode', 'courseName', 'courseYear', 'admissionType', 'collegeName', 'collegeCode', 'guardianName', 'idHolder', 'academicYear', 'seatType', 'govtSeatType', 'actualCategory', 'seatSelectCategory', 'admissionDate', 'keaCetNumber', 'sspId', 'neetRegNo', 'neetRank', 'cetRegNo', 'cetRank', 'qualifyingExamName', 'qualifyingExamRegNo', 'qualifyingMaxMarks', 'qualifyingSecuredMarks', 'qualifyingPassDate', 'qualifyingBoard', 'optionalSubject', 'optionalMaxMarks', 'optionalSecuredMarks', 'diplomaCourse', 'diplomaCourseDuration', 'diplomaPassedDate', 'diplomaBoard', 'diplomaMaxMarks', 'diplomaSecuredMarks', 'casteRdNumber', 'casteCategory', 'casteName', 'casteCertificateStudentName', 'casteCertificateFatherName', 'incomeRdNumber', 'incomeCategory', 'incomeCasteName', 'annualIncome', 'incomeCertificateStudentName', 'incomeCertificateFatherName', 'sourcePdf', 'sourcePage', 'sourceSlNo', 'sourceColumns', 'status', 'createdAtText'],
  studentAdmissions: ['studentRecordId', 'studentId', 'admissionNo', 'academicYear', 'courseCode', 'courseName', 'courseYear', 'admissionType', 'collegeName', 'collegeCode', 'idHolder', 'admissionDate', 'seatType', 'actualCategory', 'status', 'submittedAtText', 'sourcePdf', 'sourcePage', 'sourceSlNo'],
  studentDocuments: ['studentRecordId', 'studentId', 'documentType', 'academicYear', 'uploadedBy', 'fileName', 'verificationStatus', 'uploadedAtText'],
  studentPromotions: ['studentRecordId', 'studentId', 'fromClass', 'toClass', 'academicYear', 'status', 'approvedBy', 'approvedAtText'],
  studentTransfers: ['studentRecordId', 'studentId', 'transferType', 'reason', 'academicYear', 'status', 'requestedAtText'],
  users: ['uid', 'name', 'email', 'roleId', 'displayId', 'collegeIds', 'status', 'linkedStudentRecordIds', 'linkedStudentIds', 'createdAtText'],
  roles: ['id', 'name', 'description', 'locked', 'permissions'],
  staffMembers: ['employeeId', 'name', 'photoUrl', 'photoName', 'staffType', 'department', 'designation', 'phone', 'email', 'qualification', 'institution', 'city', 'dateOfBirth', 'specialization', 'joiningDate', 'appointmentType', 'address', 'previousExperience', 'publications', 'researchProjects', 'qualificationDetails', 'documentFileName', 'documentStatus', 'status', 'createdAtText'],
  departments: ['name', 'headName', 'status'],
  staffLeaveRecords: ['staffRecordId', 'employeeId', 'leaveType', 'fromDate', 'toDate', 'reason', 'status'],
  staffAttendanceRecords: ['staffRecordId', 'employeeId', 'academicYear', 'dateText', 'status', 'markedAtText'],
  studentAttendanceRecords: ['entityType', 'entityRecordId', 'entityId', 'entityName', 'className', 'section', 'courseCode', 'courseName', 'subjectCode', 'subjectName', 'academicYear', 'dateText', 'status'],
  attendanceNotifications: ['studentRecordId', 'studentId', 'studentName', 'channel', 'academicYear', 'reason', 'status'],
  classrooms: ['roomNo', 'building', 'capacity', 'status'],
  timetableEntries: ['classKey', 'subject', 'academicYear', 'facultyId', 'facultyName', 'classroomId', 'classroomName', 'day', 'timeSlot', 'status'],
  timetablePublications: ['classKey', 'academicYear', 'status', 'publishedAtText', 'entryCount'],
  examSchedules: ['examName', 'classKey', 'subject', 'examType', 'academicYear', 'examDate', 'startTime', 'durationMinutes', 'roomNo', 'maxMarks', 'facultyId', 'facultyName', 'status'],
  internalAssessments: ['title', 'classKey', 'subject', 'academicYear', 'maxMarks', 'status'],
  marksEntries: ['examScheduleId', 'studentRecordId', 'studentId', 'studentName', 'classKey', 'subject', 'academicYear', 'marksObtained', 'maxMarks', 'percentage', 'grade', 'status'],
  studentResults: ['studentRecordId', 'studentId', 'studentName', 'classKey', 'examName', 'academicYear', 'totalObtained', 'totalMax', 'percentage', 'grade', 'status'],
  reportCards: ['studentRecordId', 'studentId', 'examName', 'academicYear', 'status', 'generatedAtText'],
  feeStructures: ['name', 'classKey', 'academicYear', 'tuitionFee', 'libraryFee', 'labFee', 'transportFee', 'totalAmount', 'dueDate', 'status'],
  feeAssignments: ['feeStructureId', 'studentRecordId', 'studentId', 'studentName', 'classKey', 'academicYear', 'totalAmount', 'paidAmount', 'adjustmentAmount', 'dueAmount', 'dueDate', 'status'],
  feeCollections: ['assignmentId', 'studentRecordId', 'studentId', 'studentName', 'amount', 'academicYear', 'paymentMode', 'referenceNo', 'paymentDate', 'status'],
  feeAdjustments: ['assignmentId', 'studentRecordId', 'studentId', 'studentName', 'amount', 'academicYear', 'reason', 'status'],
  hostelRooms: ['roomNo', 'hostelName', 'blockName', 'floor', 'capacity', 'occupiedCount', 'wardenName', 'academicYear', 'status', 'createdAtText'],
  hostelAllocations: ['studentRecordId', 'studentId', 'studentName', 'courseCode', 'courseName', 'roomNo', 'hostelName', 'allocatedOn', 'academicYear', 'status', 'guardianPhone', 'createdAtText'],
  hostelRecords: ['recordType', 'title', 'hostelName', 'roomNo', 'recordDate', 'academicYear', 'status', 'notes', 'createdAtText'],
  financialReportSnapshots: ['reportName', 'totalAssigned', 'lifetimeCollected', 'totalOutstanding', 'collectionRate', 'status'],
  noticeItems: ['type', 'title', 'referenceNo', 'audience', 'academicYear', 'priority', 'body', 'publishDate', 'expiryDate', 'status'],
  managedDocuments: ['ownerType', 'ownerRecordId', 'ownerId', 'ownerName', 'documentType', 'note', 'category', 'academicYear', 'fileName', 'verificationStatus', 'notes'],
  parentPortalLinks: ['parentEmail', 'studentRecordId', 'studentId', 'relationship', 'status'],
  academicPrograms: ['name', 'code', 'academicYear', 'status'],
  academicSubjects: ['subjectName', 'subjectCode', 'programName', 'creditHours', 'academicYear', 'status'],
  academicBatches: ['className', 'section', 'programName', 'classTeacher', 'capacity', 'academicYear', 'status'],
  academicCalendarEvents: ['title', 'eventType', 'eventDate', 'audience', 'academicYear', 'status'],
  systemSettings: ['id', 'name', 'instituteId', 'code', 'logoUrl', 'logoFileName', 'email', 'phone', 'startsOn', 'endsOn', 'student', 'admission', 'employee', 'moduleDefaults'],
};

const allPermissions = [
  'students.view', 'students.create', 'students.edit', 'students.archive', 'students.documents', 'students.verifyDocuments', 'students.promote',
  'staff.view', 'staff.create', 'staff.edit', 'staff.archive', 'staff.leave', 'staff.attendance',
  'users.view', 'users.create', 'users.edit', 'roles.view', 'roles.edit',
  'attendance.view', 'academicCurriculum.view', 'academics.view', 'academics.manage', 'attendance.markStudents', 'attendance.markStaff', 'attendance.reports', 'attendance.notifyParents',
  'timetable.view', 'timetable.create', 'timetable.edit', 'timetable.publish', 'timetable.classrooms',
  'exams.view', 'exams.schedule', 'exams.assessments', 'exams.marks', 'exams.results', 'exams.reportCards',
  'fees.view', 'fees.setup', 'fees.assign', 'fees.collect', 'fees.adjust', 'fees.reports',
  'hostel.view', 'hostel.manage',
  'financialReports.view', 'financialReports.export', 'financialReports.snapshots',
  'notices.view', 'notices.create', 'notices.edit', 'notices.archive',
  'documents.view', 'documents.upload', 'documents.verify', 'documents.archive',
  'parentPortal.view', 'parentPortal.viewAll', 'settings.view', 'settings.manage',
];

const adminPermissions = [
  'students.view', 'students.edit',
  'staff.view', 'staff.create', 'staff.edit', 'staff.archive', 'staff.leave', 'staff.attendance',
  'attendance.view', 'academicCurriculum.view', 'academics.view', 'academics.manage', 'attendance.markStudents', 'attendance.markStaff', 'attendance.reports', 'attendance.notifyParents',
  'timetable.view', 'timetable.create', 'timetable.edit', 'timetable.publish', 'timetable.classrooms',
  'exams.view', 'exams.schedule', 'exams.assessments', 'exams.marks', 'exams.results', 'exams.reportCards',
  'fees.view', 'fees.setup', 'fees.assign', 'fees.collect', 'fees.adjust', 'fees.reports',
  'hostel.view', 'hostel.manage',
  'financialReports.view', 'financialReports.export', 'financialReports.snapshots',
  'notices.view', 'notices.create', 'notices.edit', 'notices.archive',
  'documents.view', 'documents.upload', 'documents.verify', 'documents.archive',
];

const facultyPermissions = [
  'students.view',
  'attendance.view', 'attendance.markStudents', 'attendance.reports',
  'academicCurriculum.view',
  'timetable.view',
  'exams.view', 'exams.marks',
  'notices.view',
  'documents.view',
  'hostel.view',
];

const parentPermissions = [
  'academicCurriculum.view',
  'timetable.view',
  'notices.view',
  'documents.view',
  'parentPortal.view',
];

function buildPdfAdmissionSeed() {
  const admissionBatches = Object.fromEntries(admissionCourses.map((course) => [
    course.id,
    {
      academicYear: course.academicYearNormalized,
      collegeName: course.collegeName,
      collegeCode: course.collegeCode,
      courseName: course.courseName,
      courseCode: course.courseCode,
      courseYear: course.courseYear,
      admissionType: course.admissionType,
      sourcePdf: course.file,
      studentCount: course.studentCount,
      status: 'Active',
    },
  ]));

  const students = Object.fromEntries(admissionStudents.map((student) => [student.id, student]));

  const studentAdmissions = Object.fromEntries(admissionStudents.map((student) => [
    `seed-admission-${student.courseCode.toLowerCase()}-${String(student.studentId).split('-').pop()}`,
    {
      studentRecordId: student.id,
      studentId: student.studentId,
      admissionNo: student.admissionNo,
      academicYear: student.academicYear,
      courseCode: student.courseCode,
      courseName: student.courseName,
      courseYear: student.courseYear,
      admissionType: student.admissionType,
      collegeName: student.collegeName,
      collegeCode: student.collegeCode,
      idHolder: student.idHolder,
      admissionDate: student.admissionDate,
      seatType: student.seatType,
      actualCategory: student.actualCategory,
      status: 'Approved',
      submittedAtText: student.admissionDate || student.createdAtText,
      sourcePdf: student.sourcePdf,
      sourcePage: student.sourcePage,
      sourceSlNo: student.sourceSlNo,
    },
  ]));

  const studentDocuments = Object.fromEntries(admissionStudents.map((student) => [
    `seed-student-doc-${student.courseCode.toLowerCase()}-${String(student.studentId).split('-').pop()}`,
    {
      studentRecordId: student.id,
      studentId: student.studentId,
      documentType: 'RGUHS Admission Statement',
      academicYear: student.academicYear,
      uploadedBy: 'PDF Import',
      fileName: student.sourcePdf,
      verificationStatus: 'Source PDF',
      uploadedAtText: student.createdAtText,
    },
  ]));

  return { admissionBatches, students, studentAdmissions, studentDocuments };
}

function buildFacultySeed() {
  const departments = Object.fromEntries(demoDepartments.map((department) => [
    department.id.replace('demo-', 'seed-'),
    {
      name: department.name,
      headName: department.headName,
      status: department.status,
    },
  ]));

  const staffMembers = Object.fromEntries(demoStaffMembers.map((staffMember) => {
    const { id, ...data } = staffMember;
    return [id.replace('demo-staff-', 'seed-staff-'), data];
  }));

  return { departments, staffMembers };
}

const seed = {
  colleges: {
    'main-campus': { id: 'main-campus', name: 'Maurya Institute of Allied Health Sciences', code: 'COL-097', location: 'Main Campus', logoUrl: '', logoFileName: '', status: 'Active', createdAtText: '19 Jun 2026' },
  },
  students: {
    'seed-student-vivek': { admissionNo: 'ADM-2026-04449', studentId: 'STU-4449', name: 'Vivek Sharma', className: 'Class XII', section: 'A', program: 'CBSE Science', guardianName: 'Rajesh Sharma', idHolder: 'Vivek Sharma', guardianEmail: 'parent.vivek@example.com', phone: '+91 98765 43210', email: 'vivek.sharma@student.edu', academicYear: '2026-2027', status: 'Active', createdAtText: '03 Jun 2026' },
    'seed-student-vaibhavi': { admissionNo: 'ADM-2026-04450', studentId: 'STU-4450', name: 'Vaibhavi Aggarwal', className: 'Class XI', section: 'B', program: 'PU Commerce', guardianName: 'Anita Aggarwal', idHolder: 'Vaibhavi Aggarwal', guardianEmail: 'parent.vaibhavi@example.com', phone: '+91 99887 77665', email: 'vaibhavi@student.edu', academicYear: '2026-2027', status: 'Active', createdAtText: '01 Jun 2026' },
  },
  studentAdmissions: {
    'seed-admission-vivek': { studentRecordId: 'seed-student-vivek', studentId: 'STU-4449', admissionNo: 'ADM-2026-04449', academicYear: '2026-2027', idHolder: 'Vivek Sharma', status: 'Admission Review', submittedAtText: '03 Jun 2026' },
  },
  studentDocuments: {
    'seed-student-doc-vivek': { studentRecordId: 'seed-student-vivek', studentId: 'STU-4449', documentType: 'Admission Form', academicYear: '2026-2027', uploadedBy: 'Admin', fileName: 'ADM-2026-04449-admission-form.pdf', verificationStatus: 'Pending Review', uploadedAtText: '03 Jun 2026' },
  },
  studentPromotions: {
    'seed-promotion-vivek': { studentRecordId: 'seed-student-vivek', studentId: 'STU-4449', fromClass: 'Class XI', toClass: 'Class XII', academicYear: '2026-2027', status: 'Promoted', approvedBy: 'Academic Office', approvedAtText: '03 Jun 2026' },
  },
  studentTransfers: {
    'seed-transfer-vivek': { studentRecordId: 'seed-student-vivek', studentId: 'STU-4449', transferType: 'Internal Class Transfer', reason: 'Promoted to next class', academicYear: '2026-2027', status: 'Not Requested', requestedAtText: '03 Jun 2026' },
  },
  roles: {
    'super-admin': { id: 'super-admin', name: 'Super Admin', description: 'Full ERP control with college selection.', locked: true, permissions: allPermissions },
    admin: { id: 'admin', name: 'Admin', description: 'Administrative ERP access without new admission creation.', locked: false, permissions: adminPermissions },
    faculty: { id: 'faculty', name: 'Faculty', description: 'Academic staff access with notice board view only.', locked: false, permissions: facultyPermissions },
    parent: { id: 'parent', name: 'Parent', description: 'Parent portal access for academic visibility.', locked: false, permissions: parentPermissions },
  },
  users: {
    'seed-super-admin-user': { uid: 'seed-super-admin-user', name: 'Super Admin', email: 'superadmin@college.edu', roleId: 'super-admin', displayId: 'SA-001', collegeIds: ['main-campus'], status: 'Active', linkedStudentRecordIds: [], linkedStudentIds: [], createdAtText: '19 Jun 2026' },
    'seed-admin-user': { uid: 'seed-admin-user', name: 'ERP Admin', email: 'admin@college.edu', roleId: 'admin', displayId: 'ADM-001', collegeIds: ['main-campus'], status: 'Active', linkedStudentRecordIds: [], linkedStudentIds: [], createdAtText: '19 Jun 2026' },
    'seed-parent-user': { uid: 'seed-parent-user', name: 'Rajesh Sharma', email: 'parent.vivek@example.com', roleId: 'parent', displayId: 'PAR-001', collegeIds: ['main-campus'], status: 'Active', linkedStudentRecordIds: ['seed-student-vivek'], linkedStudentIds: ['STU-4449'], createdAtText: '19 Jun 2026' },
  },
  departments: {
    'seed-dept-science': { name: 'Science', headName: 'Dr. Kavita Menon', status: 'Active' },
    'seed-dept-commerce': { name: 'Commerce', headName: 'Prof. Ramesh Iyer', status: 'Active' },
  },
  staffMembers: {
    'seed-staff-kavita': { employeeId: 'EMP-1001', name: 'Dr. Kavita Menon', staffType: 'Faculty', department: 'Science', designation: 'Senior Lecturer', phone: '+91 98765 10001', email: 'kavita.menon@college.edu', qualification: 'PhD Physics', status: 'Active', createdAtText: '03 Jun 2026' },
    'seed-staff-ramesh': { employeeId: 'EMP-1002', name: 'Prof. Ramesh Iyer', staffType: 'Faculty', department: 'Commerce', designation: 'Assistant Professor', phone: '+91 98765 10002', email: 'ramesh.iyer@college.edu', qualification: 'M.Com', status: 'Active', createdAtText: '04 Jun 2026' },
  },
  staffLeaveRecords: {
    'seed-leave-ramesh': { staffRecordId: 'seed-staff-ramesh', employeeId: 'EMP-1002', leaveType: 'Casual Leave', fromDate: '2026-06-20', toDate: '2026-06-21', reason: 'Family function', status: 'Pending Review', requestedAtText: '18 Jun 2026' },
  },
  staffAttendanceRecords: {
    'seed-staff-att-kavita': { staffRecordId: 'seed-staff-kavita', employeeId: 'EMP-1001', academicYear: '2026-2027', dateText: '18 Jun 2026', status: 'Present', markedAtText: '18 Jun 2026' },
  },
  studentAttendanceRecords: {
    'seed-student-att-vivek': { entityType: 'Student', entityRecordId: 'seed-student-vivek', entityId: 'STU-4449', entityName: 'Vivek Sharma', className: 'Class XII', section: 'A', courseCode: 'SCI-XII', courseName: 'CBSE Science', subjectCode: 'PHY-12', subjectName: 'Physics', academicYear: '2026-2027', dateText: '18 Jun 2026', status: 'Present', markedAtText: '18 Jun 2026', parentNotified: false },
    'seed-student-att-vaibhavi': { entityType: 'Student', entityRecordId: 'seed-student-vaibhavi', entityId: 'STU-4450', entityName: 'Vaibhavi Aggarwal', className: 'Class XI', section: 'B', courseCode: 'COM-XI', courseName: 'PU Commerce', subjectCode: 'ACC-11', subjectName: 'Accountancy', academicYear: '2026-2027', dateText: '18 Jun 2026', status: 'Absent', markedAtText: '18 Jun 2026', parentNotified: true },
  },
  attendanceNotifications: {
    'seed-att-note-vaibhavi': { studentRecordId: 'seed-student-vaibhavi', studentId: 'STU-4450', studentName: 'Vaibhavi Aggarwal', channel: 'Parent Portal', academicYear: '2026-2027', reason: 'Absent on 18 Jun 2026', status: 'Queued', createdAtText: '18 Jun 2026' },
  },
  classrooms: {
    'seed-room-101': { roomNo: '101', building: 'Main Block', capacity: 45, academicYear: '2026-2027', status: 'Active' },
  },
  timetableEntries: {
    'seed-tt-physics': { classKey: 'Class XII - A', subject: 'Physics', academicYear: '2026-2027', facultyId: 'seed-staff-kavita', facultyName: 'Dr. Kavita Menon', classroomId: 'seed-room-101', classroomName: '101', day: 'Monday', timeSlot: '09:00 - 10:00', status: 'Published', createdAtText: '10 Jun 2026' },
  },
  timetablePublications: {
    'seed-tt-pub-xii-a': { classKey: 'Class XII - A', academicYear: '2026-2027', status: 'Published', publishedAtText: '10 Jun 2026', entryCount: 1 },
  },
  examSchedules: {
    'seed-exam-physics': { examName: 'Mid Term Examination', classKey: 'Class XII - A', subject: 'Physics', examType: 'Written', academicYear: '2026-2027', examDate: '2026-06-25', startTime: '09:30', durationMinutes: 180, roomNo: '101', maxMarks: 50, facultyId: 'seed-staff-kavita', facultyName: 'Dr. Kavita Menon', status: 'Scheduled', createdAtText: '12 Jun 2026' },
  },
  internalAssessments: {
    'seed-assessment-physics': { title: 'Physics Internal Assessment', classKey: 'Class XII - A', subject: 'Physics', academicYear: '2026-2027', maxMarks: 20, status: 'Active', createdAtText: '12 Jun 2026' },
  },
  marksEntries: {
    'seed-marks-vivek-physics': { examScheduleId: 'seed-exam-physics', studentRecordId: 'seed-student-vivek', studentId: 'STU-4449', studentName: 'Vivek Sharma', classKey: 'Class XII - A', subject: 'Physics', academicYear: '2026-2027', marksObtained: 45, maxMarks: 50, percentage: 90, grade: 'A+', status: 'Entered', enteredAtText: '18 Jun 2026' },
  },
  studentResults: {
    'seed-result-vivek': { studentRecordId: 'seed-student-vivek', studentId: 'STU-4449', studentName: 'Vivek Sharma', classKey: 'Class XII - A', examName: 'Combined Result', totalObtained: 45, totalMax: 50, percentage: 90, grade: 'A+', status: 'Pass', generatedAtText: '18 Jun 2026' },
  },
  reportCards: {
    'seed-report-card-vivek': { studentRecordId: 'seed-student-vivek', studentId: 'STU-4449', examName: 'Combined Result', status: 'Generated', generatedAtText: '18 Jun 2026' },
  },
  feeStructures: {
    'seed-fee-xii-a': { name: 'Class XII Annual Fee', classKey: 'Class XII - A', academicYear: '2026-2027', tuitionFee: 42000, libraryFee: 3000, labFee: 8000, transportFee: 12000, totalAmount: 65000, dueDate: '2026-07-15', status: 'Active', createdAtText: '01 Jun 2026' },
  },
  feeAssignments: {
    'seed-fee-vivek': { feeStructureId: 'seed-fee-xii-a', studentRecordId: 'seed-student-vivek', studentId: 'STU-4449', studentName: 'Vivek Sharma', classKey: 'Class XII - A', academicYear: '2026-2027', totalAmount: 65000, paidAmount: 40000, adjustmentAmount: 0, dueAmount: 25000, dueDate: '2026-07-15', status: 'Partially Paid', assignedAtText: '02 Jun 2026' },
  },
  feeCollections: {
    'seed-fee-collection-vivek': { assignmentId: 'seed-fee-vivek', studentRecordId: 'seed-student-vivek', studentId: 'STU-4449', studentName: 'Vivek Sharma', amount: 40000, academicYear: '2026-2027', paymentMode: 'Cash', referenceNo: 'OFF-1001', paymentDate: '2026-06-10', collectedBy: 'Admin Office', status: 'Posted', createdAtText: '10 Jun 2026' },
  },
  feeAdjustments: {},
  hostelRooms: {
    'seed-hostel-room-101': { roomNo: '101', hostelName: 'Main Hostel', blockName: 'A Block', floor: '1', capacity: 4, occupiedCount: 2, wardenName: 'Anusha Shine', academicYear: '2026-2027', status: 'Available', createdAtText: '19 Jun 2026' },
    'seed-hostel-room-102': { roomNo: '102', hostelName: 'Main Hostel', blockName: 'A Block', floor: '1', capacity: 4, occupiedCount: 4, wardenName: 'Anusha Shine', academicYear: '2026-2027', status: 'Full', createdAtText: '19 Jun 2026' },
  },
  hostelAllocations: {
    'seed-hostel-allocation-vivek': { studentRecordId: 'seed-student-vivek', studentId: 'STU-4449', studentName: 'Vivek Sharma', courseCode: 'SCI-XII', courseName: 'CBSE Science', roomNo: '101', hostelName: 'Main Hostel', allocatedOn: '2026-06-20', academicYear: '2026-2027', status: 'Active', guardianPhone: '+91 98765 43210', createdAtText: '20 Jun 2026' },
  },
  hostelRecords: {
    'seed-hostel-record-inspection': { recordType: 'Inspection', title: 'Monthly room inspection', hostelName: 'Main Hostel', roomNo: '101', recordDate: '2026-06-25', academicYear: '2026-2027', status: 'Open', notes: 'Routine inspection logged.', createdAtText: '25 Jun 2026' },
  },
  financialReportSnapshots: {
    'seed-finance-summary-june': { reportName: 'June 2026 Finance Summary', totalAssigned: 65000, lifetimeCollected: 40000, totalOutstanding: 25000, totalAdjusted: 0, collectionRate: 62, status: 'Generated', createdAtText: '19 Jun 2026' },
  },
  noticeItems: {
    'seed-notice-library': { type: 'Digital Notice', title: 'Library timing update', referenceNo: 'NOTICE-2026-001', audience: 'Students', academicYear: '2026-2027', priority: 'Normal', body: 'Library hours are extended until 6 PM during revision week.', publishDate: '2026-06-18', expiryDate: '2026-06-30', status: 'Published', createdByName: 'Admin Office', createdAtText: '18 Jun 2026' },
  },
  managedDocuments: {
    'seed-managed-doc-vivek': { ownerType: 'Student', ownerRecordId: 'seed-student-vivek', ownerId: 'STU-4449', ownerName: 'Vivek Sharma', documentType: 'Aadhaar', category: 'Identity', academicYear: '2026-2027', fileName: 'vivek-aadhaar.pdf', fileSize: 248000, fileType: 'application/pdf', fileUrl: '', storagePath: '', verificationStatus: 'Verified', uploadedAtText: '10 Jun 2026', verifiedAtText: '11 Jun 2026', notes: 'identity, student', tags: 'identity, student' },
  },
  parentPortalLinks: {
    'seed-parent-link-vivek': { parentUserId: 'seed-parent-user', parentEmail: 'parent.vivek@example.com', studentRecordId: 'seed-student-vivek', studentId: 'STU-4449', relationship: 'Father', status: 'Active' },
  },
  academicPrograms: {
    'seed-program-science': { name: 'CBSE Science', code: 'SCI-XII', academicYear: '2026-2027', status: 'Active', createdAtText: '01 Jun 2026' },
  },
  academicSubjects: {
    'seed-subject-physics': { subjectName: 'Physics', subjectCode: 'PHY-12', programName: 'CBSE Science', creditHours: 6, academicYear: '2026-2027', status: 'Active', createdAtText: '02 Jun 2026' },
  },
  academicBatches: {
    'seed-batch-xii-a': { className: 'Class XII', section: 'A', programName: 'CBSE Science', classTeacher: 'Dr. Kavita Menon', capacity: 45, academicYear: '2026-2027', status: 'Active', createdAtText: '03 Jun 2026' },
  },
  academicCalendarEvents: {
    'seed-calendar-orientation': { title: 'Orientation Day', eventType: 'Academic', eventDate: '2026-06-01', audience: 'All', academicYear: '2026-2027', status: 'Published', createdAtText: '25 May 2026' },
  },
  systemSettings: {
    institute: { id: 'institute', name: 'Maurya Institute of Allied Health Sciences', instituteId: 'COL-097', code: 'COL-097', logoUrl: '', logoFileName: '', email: 'admin@college.edu', phone: '+91 98765 00000', address: 'Main Campus Road', city: 'Bengaluru', status: 'Active', updatedAtText: '19 Jun 2026' },
    academicYear: { id: 'academicYear', name: '2026-2027', startsOn: '2026-06-01', endsOn: '2027-03-31', status: 'Active', updatedAtText: '19 Jun 2026' },
    idFormats: { id: 'idFormats', student: 'STU-{number}', admission: 'ADM-{year}-{number}', employee: 'EMP-{number}', receipt: 'REC-{year}-{number}', updatedAtText: '19 Jun 2026' },
    moduleDefaults: { id: 'moduleDefaults', studentAdmissions: true, staffLeave: true, timetablePublishing: true, parentPortal: true, onlinePayments: false, receiptGeneration: false, communicationModule: false, updatedAtText: '19 Jun 2026' },
  },
};

const pdfAdmissionSeed = buildPdfAdmissionSeed();
const facultySeed = buildFacultySeed();
const clientReadySeed = Object.fromEntries(Object.keys(schemas).map((collectionName) => [collectionName, {}]));

Object.assign(clientReadySeed, {
  colleges: {
    'main-campus': {
      id: 'main-campus',
      name: 'Maurya Institute of Allied Health Sciences',
      code: 'MAURYA',
      location: 'Mysuru',
      logoUrl: '',
      logoFileName: '',
      status: 'Active',
      createdAtText: '09 Jan 2026',
    },
  },
  admissionBatches: pdfAdmissionSeed.admissionBatches,
  students: pdfAdmissionSeed.students,
  studentAdmissions: pdfAdmissionSeed.studentAdmissions,
  studentDocuments: pdfAdmissionSeed.studentDocuments,
  roles: seed.roles,
  users: {
    'seed-super-admin-user': seed.users['seed-super-admin-user'],
    'seed-admin-user': {
      ...seed.users['seed-admin-user'],
      roleId: 'super-admin',
      linkedStudentRecordIds: [],
      linkedStudentIds: [],
    },
  },
  departments: facultySeed.departments,
  staffMembers: facultySeed.staffMembers,
  systemSettings: {
    institute: {
      id: 'institute',
      name: 'Maurya Institute of Allied Health Sciences',
      instituteId: 'MAURYA',
      code: 'MAURYA',
      logoUrl: '',
      logoFileName: '',
      email: 'admin@maurya.edu',
      phone: '',
      address: 'Mysuru',
      city: 'Mysuru',
      status: 'Active',
      updatedAtText: '09 Jan 2026',
    },
    academicYear: {
      id: 'academicYear',
      name: '2025-2026',
      startsOn: '2025-06-01',
      endsOn: '2026-05-31',
      status: 'Active',
      updatedAtText: '09 Jan 2026',
    },
    idFormats: seed.systemSettings.idFormats,
    moduleDefaults: seed.systemSettings.moduleDefaults,
  },
});

for (const collectionName of Object.keys(schemas)) {
  seed[collectionName] = clientReadySeed[collectionName] || {};
}

const collectionNames = Object.keys(schemas);

async function deleteCollection(collectionName) {
  const ref = db.collection(collectionName);
  while (true) {
    const snapshot = await ref.limit(400).get();
    if (snapshot.empty) break;
    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }
  console.log(`Cleared ${collectionName}`);
}

async function writeSchemas() {
  const batch = db.batch();
  for (const [collectionName, fields] of Object.entries(schemas)) {
    batch.set(db.collection(collectionName).doc('__schema'), {
      purpose: `CollegeERP ${collectionName} collection`,
      fields,
      createdBy: 'CollegeERP resetAndSeedFirebase',
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }
  await batch.commit();
}

async function writeSeedData() {
  let batch = db.batch();
  let count = 0;
  for (const [collectionName, docs] of Object.entries(seed)) {
    for (const [id, data] of Object.entries(docs)) {
      batch.set(db.collection(collectionName).doc(id), {
        ...data,
        seededAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      count += 1;
      if (count % 400 === 0) {
        await batch.commit();
        batch = db.batch();
      }
    }
  }
  await batch.commit();
  return count;
}

if (shouldReset && !confirmed) {
  throw new Error('Reset requested without confirmation. Re-run with --yes-i-understand-this-deletes-data.');
}

if (shouldReset) {
  for (const collectionName of collectionNames) {
    await deleteCollection(collectionName);
  }
}

await writeSchemas();
const total = await writeSeedData();
console.log(`Seed complete. ${total} module records written across ${collectionNames.length} collections.`);
