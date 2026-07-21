import { existsSync, readFileSync } from 'node:fs';
import { cert, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import {
  getSemesterDisplayForRecord,
  getSemesterLabels,
  getSemesterNumbersForStudent,
} from '../src/modules/shared/semesterUtils.js';

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

function getArgValue(name, fallback = '') {
  const prefix = `${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

const academicYear = getArgValue('--academic-year', '2025-2026');
const dryRun = process.argv.includes('--dry-run');

initializeApp({ credential: getCredential() });
const db = getFirestore();

function buildSemesterPatch(student = {}) {
  const semesterNumbers = getSemesterNumbersForStudent(student);
  if (!semesterNumbers.length) return null;
  const semesterLabels = getSemesterLabels(semesterNumbers);
  return {
    semesterNumber: semesterNumbers[0],
    semesterNumbers,
    semesterLabels,
    semesterDisplay: getSemesterDisplayForRecord({ ...student, semesterNumbers }),
    semesterSource: 'Derived from courseYear/className during syllabus semester backfill',
    updatedAt: FieldValue.serverTimestamp(),
  };
}

const snapshot = await db.collection('students').where('academicYear', '==', academicYear).get();
let batch = db.batch();
let queued = 0;
let skipped = 0;

for (const doc of snapshot.docs) {
  const patch = buildSemesterPatch(doc.data());
  if (!patch) {
    skipped += 1;
    continue;
  }
  queued += 1;
  if (!dryRun) {
    batch.set(doc.ref, patch, { merge: true });
    if (queued % 400 === 0) {
      await batch.commit();
      batch = db.batch();
    }
  }
}

if (!dryRun && queued % 400 !== 0) {
  await batch.commit();
}

console.log(`Student semester backfill target academic year: ${academicYear}`);
console.log(`Student records scanned: ${snapshot.size}`);
console.log(`Student records ${dryRun ? 'eligible' : 'merged'}: ${queued}`);
console.log(`Student records skipped: ${skipped}`);
if (dryRun) {
  console.log('Dry run complete. No Firestore writes were made.');
}
