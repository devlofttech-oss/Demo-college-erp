import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query as firestoreQuery,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from './config';

const SCHEMA_DOC_ID = '__schema';
export const DEFAULT_ACADEMIC_YEAR = '2025-2026';

function requireDb() {
  if (!db) {
    throw new Error('Firebase Firestore is not configured.');
  }
  return db;
}

function filterByAcademicYear(records = [], academicYear = '') {
  if (!academicYear) return records;
  return records.filter((record) => record.academicYear === academicYear);
}

function academicYearWhere(academicYear = '') {
  return academicYear ? [where('academicYear', '==', academicYear)] : [];
}

function uniqueValues(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function chunkValues(values = [], size = 10) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function mergeById(groups = []) {
  const byId = new Map();
  groups.flat().forEach((record) => {
    if (record?.id && record.id !== SCHEMA_DOC_ID) {
      byId.set(record.id, record);
    }
  });
  return [...byId.values()];
}

async function listCollection(collectionName, constraints = []) {
  if (!db) return [];
  const collectionRef = collection(db, collectionName);
  const snapshot = await getDocs(constraints.length ? firestoreQuery(collectionRef, ...constraints) : collectionRef);
  return snapshot.docs
    .filter((item) => item.id !== SCHEMA_DOC_ID)
    .map((item) => ({ id: item.id, ...item.data() }));
}

async function getCollectionDocuments(collectionName, ids = []) {
  if (!db) return [];
  const snapshots = await Promise.all(
    uniqueValues(ids).map((id) => getDoc(doc(db, collectionName, id)))
  );
  return snapshots
    .filter((snapshot) => snapshot.exists() && snapshot.id !== SCHEMA_DOC_ID)
    .map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }));
}

async function listCollectionWhereIn(collectionName, fieldName, values = [], constraints = []) {
  if (!db) return [];
  const ids = uniqueValues(values);
  if (!ids.length) return [];

  const collectionRef = collection(db, collectionName);
  const snapshots = await Promise.all(
    chunkValues(ids).map((chunk) =>
      getDocs(firestoreQuery(collectionRef, ...constraints, where(fieldName, 'in', chunk)))
    )
  );

  return mergeById(
    snapshots.map((snapshot) =>
      snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
    )
  );
}

async function createCollectionDocument(collectionName, data) {
  if (!db) return null;
  const ref = await addDoc(collection(db, collectionName), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getStudentInformationData(academicYear = '') {
  const yearConstraints = academicYearWhere(academicYear);
  const [
    students,
    admissions,
    documents,
    promotions,
    transfers,
    admissionBatches,
  ] = await Promise.all([
    listCollection('students', yearConstraints),
    listCollection('studentAdmissions', yearConstraints),
    listCollection('studentDocuments', yearConstraints),
    listCollection('studentPromotions', yearConstraints),
    listCollection('studentTransfers', yearConstraints),
    listCollection('admissionBatches', yearConstraints),
  ]);

  return {
    students,
    admissions,
    documents,
    promotions,
    transfers,
    admissionBatches,
  };
}

export async function createStudent(data) {
  return createCollectionDocument('students', data);
}

export async function createStudentAdmission(data) {
  return createCollectionDocument('studentAdmissions', data);
}

export async function createStudentDocument(data) {
  return createCollectionDocument('studentDocuments', data);
}

export async function updateStudentDocument(id, data) {
  if (!db || !id || id.startsWith('demo-') || id.startsWith('local-')) return;
  await updateDoc(doc(db, 'studentDocuments', id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function createStudentPromotion(data) {
  return createCollectionDocument('studentPromotions', data);
}

export async function createStudentTransfer(data) {
  return createCollectionDocument('studentTransfers', data);
}


export async function updateStudent(id, data) {
  if (!db || !id || id.startsWith('demo-') || id.startsWith('local-')) return;
  await updateDoc(doc(db, 'students', id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function archiveStudent(id, data = {}) {
  if (!db || !id || id.startsWith('demo-') || id.startsWith('local-')) return;
  await updateDoc(doc(db, 'students', id), {
    ...data,
    status: 'Archived',
    archivedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function restoreStudent(id, data = {}) {
  if (!db || !id || id.startsWith('demo-') || id.startsWith('local-')) return;
  await updateDoc(doc(db, 'students', id), {
    ...data,
    status: 'Active',
    restoredAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function getUserRoleData() {
  const [users, roles] = await Promise.all([
    listCollection('users'),
    listCollection('roles'),
  ]);

  return { users, roles };
}

export async function getUserProfile(uid) {
  if (!db || !uid) return null;
  const snapshot = await getDoc(doc(db, 'users', uid));
  if (!snapshot.exists()) return null;
  return { uid: snapshot.id, ...snapshot.data() };
}

export async function createUserProfile(uid, data) {
  if (!db || !uid) return null;
  await setDoc(doc(db, 'users', uid), {
    ...data,
    uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return uid;
}

export async function updateUserProfile(uid, data) {
  if (!db || !uid || uid.startsWith('demo-') || uid.startsWith('local-')) return;
  await updateDoc(doc(db, 'users', uid), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function createRole(data) {
  if (!db) return null;
  const roleId = data.id || `role-${Date.now()}`;
  await setDoc(doc(db, 'roles', roleId), {
    ...data,
    id: roleId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return roleId;
}

export async function updateRole(id, data) {
  if (!db || !id || id.startsWith('demo-') || id.startsWith('local-')) return;
  await updateDoc(doc(db, 'roles', id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function getFacultyStaffData(academicYear = '') {
  const yearConstraints = academicYearWhere(academicYear);
  const [staff, departments, leaveRecords, attendanceRecords] = await Promise.all([
    listCollection('staffMembers'),
    listCollection('departments'),
    listCollection('staffLeaveRecords', yearConstraints),
    listCollection('staffAttendanceRecords', yearConstraints),
  ]);

  return { staff, departments, leaveRecords: filterByAcademicYear(leaveRecords, academicYear), attendanceRecords: filterByAcademicYear(attendanceRecords, academicYear) };
}

export async function createStaffMember(data) {
  return createCollectionDocument('staffMembers', data);
}

export async function updateStaffMember(id, data) {
  if (!db || !id || id.startsWith('demo-') || id.startsWith('local-')) return;
  await updateDoc(doc(db, 'staffMembers', id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function archiveStaffMember(id, data = {}) {
  if (!db || !id || id.startsWith('demo-') || id.startsWith('local-')) return;
  await updateDoc(doc(db, 'staffMembers', id), {
    ...data,
    status: 'Archived',
    archivedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function restoreStaffMember(id, data = {}) {
  if (!db || !id || id.startsWith('demo-') || id.startsWith('local-')) return;
  await updateDoc(doc(db, 'staffMembers', id), {
    ...data,
    status: 'Active',
    restoredAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function createDepartment(data) {
  return createCollectionDocument('departments', data);
}

export async function createStaffLeaveRecord(data) {
  return createCollectionDocument('staffLeaveRecords', data);
}

export async function updateStaffLeaveRecord(id, data) {
  if (!db || !id || id.startsWith('demo-') || id.startsWith('local-')) return;
  await updateDoc(doc(db, 'staffLeaveRecords', id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function createStaffAttendanceRecord(data) {
  return createCollectionDocument('staffAttendanceRecords', data);
}

export async function getAttendanceManagementData(academicYear = '') {
  const yearConstraints = academicYearWhere(academicYear);
  const [students, staff, studentAttendance, staffAttendance, notifications] = await Promise.all([
    listCollection('students', yearConstraints),
    listCollection('staffMembers'),
    listCollection('studentAttendanceRecords', yearConstraints),
    listCollection('staffAttendanceRecords', yearConstraints),
    listCollection('attendanceNotifications', yearConstraints),
  ]);

  return { students: filterByAcademicYear(students, academicYear), staff, studentAttendance: filterByAcademicYear(studentAttendance, academicYear), staffAttendance: filterByAcademicYear(staffAttendance, academicYear), notifications: filterByAcademicYear(notifications, academicYear) };
}

export async function createStudentAttendanceRecord(data) {
  return createCollectionDocument('studentAttendanceRecords', data);
}

export async function updateStudentAttendanceRecord(id, data) {
  if (!db || !id || id.startsWith('demo-') || id.startsWith('local-')) return;
  await updateDoc(doc(db, 'studentAttendanceRecords', id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function createAttendanceNotification(data) {
  return createCollectionDocument('attendanceNotifications', data);
}

export async function getTimetableManagementData(academicYear = '') {
  const yearConstraints = academicYearWhere(academicYear);
  const [students, staff, classrooms, timetableEntries, publications] = await Promise.all([
    listCollection('students', yearConstraints),
    listCollection('staffMembers'),
    listCollection('classrooms'),
    listCollection('timetableEntries', yearConstraints),
    listCollection('timetablePublications', yearConstraints),
  ]);

  return { students: filterByAcademicYear(students, academicYear), staff, classrooms, timetableEntries: filterByAcademicYear(timetableEntries, academicYear), publications: filterByAcademicYear(publications, academicYear) };
}

export async function createClassroom(data) {
  return createCollectionDocument('classrooms', data);
}

export async function createTimetableEntry(data) {
  return createCollectionDocument('timetableEntries', data);
}

export async function updateTimetableEntry(id, data) {
  if (!db || !id || id.startsWith('demo-') || id.startsWith('local-')) return;
  await updateDoc(doc(db, 'timetableEntries', id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function archiveTimetableEntry(id, data = {}) {
  if (!db || !id || id.startsWith('demo-') || id.startsWith('local-')) return;
  await updateDoc(doc(db, 'timetableEntries', id), {
    ...data,
    status: 'Archived',
    archivedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function createTimetablePublication(data) {
  return createCollectionDocument('timetablePublications', data);
}

export async function getExaminationResultData(academicYear = '') {
  const yearConstraints = academicYearWhere(academicYear);
  const [students, staff, examSchedules, assessments, marks, results, reportCards] = await Promise.all([
    listCollection('students', yearConstraints),
    listCollection('staffMembers'),
    listCollection('examSchedules', yearConstraints),
    listCollection('internalAssessments', yearConstraints),
    listCollection('marksEntries', yearConstraints),
    listCollection('studentResults', yearConstraints),
    listCollection('reportCards', yearConstraints),
  ]);

  return { students: filterByAcademicYear(students, academicYear), staff, examSchedules: filterByAcademicYear(examSchedules, academicYear), assessments: filterByAcademicYear(assessments, academicYear), marks: filterByAcademicYear(marks, academicYear), results: filterByAcademicYear(results, academicYear), reportCards: filterByAcademicYear(reportCards, academicYear) };
}

export async function createExamSchedule(data) {
  return createCollectionDocument('examSchedules', data);
}

export async function updateExamSchedule(id, data) {
  if (!db || !id || id.startsWith('demo-') || id.startsWith('local-')) return;
  await updateDoc(doc(db, 'examSchedules', id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function createInternalAssessment(data) {
  return createCollectionDocument('internalAssessments', data);
}

export async function createMarksEntry(data) {
  return createCollectionDocument('marksEntries', data);
}

export async function updateMarksEntry(id, data) {
  if (!db || !id || id.startsWith('demo-') || id.startsWith('local-')) return;
  await updateDoc(doc(db, 'marksEntries', id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function createStudentResult(data) {
  return createCollectionDocument('studentResults', data);
}

export async function createReportCard(data) {
  return createCollectionDocument('reportCards', data);
}

export async function getFeesManagementData(academicYear = '') {
  const yearConstraints = academicYearWhere(academicYear);
  const [students, feeStructures, feeAssignments, feeCollections, feeAdjustments] = await Promise.all([
    listCollection('students', yearConstraints),
    listCollection('feeStructures', yearConstraints),
    listCollection('feeAssignments', yearConstraints),
    listCollection('feeCollections', yearConstraints),
    listCollection('feeAdjustments', yearConstraints),
  ]);

  return { students: filterByAcademicYear(students, academicYear), feeStructures: filterByAcademicYear(feeStructures, academicYear), feeAssignments: filterByAcademicYear(feeAssignments, academicYear), feeCollections: filterByAcademicYear(feeCollections, academicYear), feeAdjustments: filterByAcademicYear(feeAdjustments, academicYear) };
}

export async function createFeeStructure(data) {
  return createCollectionDocument('feeStructures', data);
}

export async function updateFeeStructure(id, data) {
  if (!db || !id || id.startsWith('demo-') || id.startsWith('local-')) return;
  await updateDoc(doc(db, 'feeStructures', id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function createFeeAssignment(data) {
  return createCollectionDocument('feeAssignments', data);
}

export async function updateFeeAssignment(id, data) {
  if (!db || !id || id.startsWith('demo-') || id.startsWith('local-')) return;
  await updateDoc(doc(db, 'feeAssignments', id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function createFeeCollection(data) {
  return createCollectionDocument('feeCollections', data);
}

export async function createFeeAdjustment(data) {
  return createCollectionDocument('feeAdjustments', data);
}

export async function getFinancialReportsData(academicYear = '') {
  const yearConstraints = academicYearWhere(academicYear);
  const [feeStructures, feeAssignments, feeCollections, feeAdjustments, financialReportSnapshots] = await Promise.all([
    listCollection('feeStructures', yearConstraints),
    listCollection('feeAssignments', yearConstraints),
    listCollection('feeCollections', yearConstraints),
    listCollection('feeAdjustments', yearConstraints),
    listCollection('financialReportSnapshots', yearConstraints),
  ]);

  return { feeStructures: filterByAcademicYear(feeStructures, academicYear), feeAssignments: filterByAcademicYear(feeAssignments, academicYear), feeCollections: filterByAcademicYear(feeCollections, academicYear), feeAdjustments: filterByAcademicYear(feeAdjustments, academicYear), financialReportSnapshots: filterByAcademicYear(financialReportSnapshots, academicYear) };
}

export async function createFinancialReportSnapshot(data) {
  return createCollectionDocument('financialReportSnapshots', data);
}

export async function getNoticeBoardData(academicYear = '') {
  const yearConstraints = academicYearWhere(academicYear);
  const [noticeItems] = await Promise.all([
    listCollection('noticeItems', yearConstraints),
  ]);

  return { noticeItems: filterByAcademicYear(noticeItems, academicYear) };
}

export async function createNoticeItem(data) {
  return createCollectionDocument('noticeItems', data);
}

export async function updateNoticeItem(id, data) {
  if (!db || !id || id.startsWith('demo-') || id.startsWith('local-')) return;
  await updateDoc(doc(db, 'noticeItems', id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function archiveNoticeItem(id, data = {}) {
  if (!db || !id || id.startsWith('demo-') || id.startsWith('local-')) return;
  await updateDoc(doc(db, 'noticeItems', id), {
    ...data,
    status: 'Archived',
    archivedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function getDocumentManagementData(academicYear = '') {
  const yearConstraints = academicYearWhere(academicYear);
  const [students, staff, managedDocuments] = await Promise.all([
    listCollection('students', yearConstraints),
    listCollection('staffMembers'),
    listCollection('managedDocuments', yearConstraints),
  ]);

  return { students: filterByAcademicYear(students, academicYear), staff, managedDocuments: filterByAcademicYear(managedDocuments, academicYear) };
}

export async function createManagedDocument(data) {
  return createCollectionDocument('managedDocuments', data);
}

export async function updateManagedDocument(id, data) {
  if (!db || !id || id.startsWith('demo-') || id.startsWith('local-')) return;
  await updateDoc(doc(db, 'managedDocuments', id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function archiveManagedDocument(id, data = {}) {
  if (!db || !id || id.startsWith('demo-') || id.startsWith('local-')) return;
  await updateDoc(doc(db, 'managedDocuments', id), {
    ...data,
    verificationStatus: 'Archived',
    archivedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function getParentPortalData(academicYear = '', currentUser = {}) {
  const yearConstraints = academicYearWhere(academicYear);

  if (currentUser?.roleId === 'parent') {
    const profile = currentUser?.uid ? await getUserProfile(currentUser.uid).catch(() => null) : null;
    const linkedStudentRecordIds = uniqueValues([
      ...(currentUser.linkedStudentRecordIds || []),
      ...(profile?.linkedStudentRecordIds || []),
    ]);
    const linkedStudentIds = uniqueValues([
      ...(currentUser.linkedStudentIds || []),
      ...(profile?.linkedStudentIds || []),
    ]);

    const [studentsByRecordId, studentsByStudentId] = await Promise.all([
      getCollectionDocuments('students', linkedStudentRecordIds),
      listCollectionWhereIn('students', 'studentId', linkedStudentIds, yearConstraints),
    ]);
    const students = filterByAcademicYear(mergeById([studentsByRecordId, studentsByStudentId]), academicYear);
    const studentRecordIds = uniqueValues([...linkedStudentRecordIds, ...students.map((student) => student.id)]);
    const studentIds = uniqueValues([...linkedStudentIds, ...students.map((student) => student.studentId)]);

    const [
      attendanceByRecordId,
      attendanceByStudentId,
      marksByRecordId,
      marksByStudentId,
      resultsByRecordId,
      resultsByStudentId,
      feesByRecordId,
      feesByStudentId,
      documentsByRecordId,
      documentsByStudentId,
      noticeItems,
    ] = await Promise.all([
      listCollectionWhereIn('studentAttendanceRecords', 'entityRecordId', studentRecordIds, yearConstraints),
      listCollectionWhereIn('studentAttendanceRecords', 'entityId', studentIds, yearConstraints),
      listCollectionWhereIn('marksEntries', 'studentRecordId', studentRecordIds, yearConstraints),
      listCollectionWhereIn('marksEntries', 'studentId', studentIds, yearConstraints),
      listCollectionWhereIn('studentResults', 'studentRecordId', studentRecordIds, yearConstraints),
      listCollectionWhereIn('studentResults', 'studentId', studentIds, yearConstraints),
      listCollectionWhereIn('feeAssignments', 'studentRecordId', studentRecordIds, yearConstraints),
      listCollectionWhereIn('feeAssignments', 'studentId', studentIds, yearConstraints),
      listCollectionWhereIn('managedDocuments', 'ownerRecordId', studentRecordIds, [where('ownerType', '==', 'Student'), ...yearConstraints]),
      listCollectionWhereIn('managedDocuments', 'ownerId', studentIds, [where('ownerType', '==', 'Student'), ...yearConstraints]),
      listCollection('noticeItems', yearConstraints),
    ]);

    return {
      students,
      studentAttendance: mergeById([attendanceByRecordId, attendanceByStudentId]),
      marksEntries: mergeById([marksByRecordId, marksByStudentId]),
      studentResults: mergeById([resultsByRecordId, resultsByStudentId]),
      feeAssignments: mergeById([feesByRecordId, feesByStudentId]),
      noticeItems: filterByAcademicYear(noticeItems, academicYear),
      managedDocuments: mergeById([documentsByRecordId, documentsByStudentId]),
    };
  }

  const [students, studentAttendance, marksEntries, studentResults, feeAssignments, noticeItems, managedDocuments] = await Promise.all([
    listCollection('students', yearConstraints),
    listCollection('studentAttendanceRecords', yearConstraints),
    listCollection('marksEntries', yearConstraints),
    listCollection('studentResults', yearConstraints),
    listCollection('feeAssignments', yearConstraints),
    listCollection('noticeItems', yearConstraints),
    listCollection('managedDocuments', yearConstraints),
  ]);

  return { students: filterByAcademicYear(students, academicYear), studentAttendance: filterByAcademicYear(studentAttendance, academicYear), marksEntries: filterByAcademicYear(marksEntries, academicYear), studentResults: filterByAcademicYear(studentResults, academicYear), feeAssignments: filterByAcademicYear(feeAssignments, academicYear), noticeItems: filterByAcademicYear(noticeItems, academicYear), managedDocuments: filterByAcademicYear(managedDocuments, academicYear) };
}

export async function getAcademicsData(academicYear = '') {
  const yearConstraints = academicYearWhere(academicYear);
  const [academicPrograms, academicSubjects, academicBatches, academicCalendarEvents] = await Promise.all([
    listCollection('academicPrograms', yearConstraints),
    listCollection('academicSubjects', yearConstraints),
    listCollection('academicBatches', yearConstraints),
    listCollection('academicCalendarEvents', yearConstraints),
  ]);

  return { academicPrograms: filterByAcademicYear(academicPrograms, academicYear), academicSubjects: filterByAcademicYear(academicSubjects, academicYear), academicBatches: filterByAcademicYear(academicBatches, academicYear), academicCalendarEvents: filterByAcademicYear(academicCalendarEvents, academicYear) };
}

export async function createAcademicProgram(data) {
  return createCollectionDocument('academicPrograms', data);
}

export async function createAcademicSubject(data) {
  return createCollectionDocument('academicSubjects', data);
}

export async function createAcademicBatch(data) {
  return createCollectionDocument('academicBatches', data);
}

export async function createAcademicCalendarEvent(data) {
  return createCollectionDocument('academicCalendarEvents', data);
}

export async function updateAcademicCalendarEvent(id, data) {
  requireDb();
  await updateDoc(doc(db, 'academicCalendarEvents', id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function getSettingsData() {
  const [settings] = await Promise.all([
    listCollection('systemSettings'),
  ]);
  const byId = settings.reduce((map, item) => {
    map[item.id] = item;
    return map;
  }, {});

  return {
    institute: byId.institute || null,
    academicYear: byId.academicYear || null,
    idFormats: byId.idFormats || null,
    moduleDefaults: byId.moduleDefaults || null,
  };
}

export async function saveSystemSetting(id, data) {
  if (!db || !id) return null;
  await setDoc(doc(db, 'systemSettings', id), {
    ...data,
    id,
    updatedAt: serverTimestamp(),
  }, { merge: true });
  return id;
}
