import { existsSync, readFileSync } from 'node:fs';
import { cert, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

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

const academicYear = process.argv[2] || '2026-2027';
const timelineCollections = [
  'students',
  'studentAdmissions',
  'studentDocuments',
  'studentPromotions',
  'studentTransfers',
  'staffLeaveRecords',
  'staffAttendanceRecords',
  'studentAttendanceRecords',
  'attendanceNotifications',
  'timetableEntries',
  'timetablePublications',
  'examSchedules',
  'internalAssessments',
  'marksEntries',
  'studentResults',
  'reportCards',
  'feeStructures',
  'feeAssignments',
  'feeCollections',
  'feeAdjustments',
  'financialReportSnapshots',
  'noticeItems',
  'managedDocuments',
  'academicPrograms',
  'academicSubjects',
  'academicBatches',
  'academicCalendarEvents',
];

initializeApp({ credential: getCredential() });
const db = getFirestore();
let totalUpdated = 0;

for (const collectionName of timelineCollections) {
  const snapshot = await db.collection(collectionName).get();
  let batch = db.batch();
  let pending = 0;
  let updated = 0;

  for (const doc of snapshot.docs) {
    if (doc.id === '__schema') continue;
    const data = doc.data();
    if (data.academicYear) continue;
    batch.update(doc.ref, {
      academicYear,
      academicYearBackfilledAt: FieldValue.serverTimestamp(),
    });
    pending += 1;
    updated += 1;
    if (pending === 450) {
      await batch.commit();
      batch = db.batch();
      pending = 0;
    }
  }

  if (pending) await batch.commit();
  totalUpdated += updated;
  console.log(`${collectionName}: ${updated} document(s) updated`);
}

console.log(`Academic year backfill complete. ${totalUpdated} document(s) set to ${academicYear}.`);
