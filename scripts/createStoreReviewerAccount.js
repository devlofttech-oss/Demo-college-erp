import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const REVIEWER_EMAIL = 'app.review.parent@devlofttech.com';
const REVIEWER_PASSWORD = process.env.STORE_REVIEWER_PASSWORD;
const REVIEWER_PHONE_ALIAS = '9000002026';
const REVIEWER_NAME = 'App Review Parent';
const REVIEWER_DISPLAY_ID = 'APP-REVIEW-PARENT';

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

function normalize(value = '') {
  return String(value).trim().toLowerCase();
}

if (!getApps().length) {
  initializeApp({ credential: getCredential() });
}

if (!REVIEWER_PASSWORD || REVIEWER_PASSWORD.length < 12) {
  throw new Error('Set STORE_REVIEWER_PASSWORD to the live App Store reviewer password.');
}

const auth = getAuth();
const db = getFirestore();

async function findLinkedStudent() {
  const preferred = await db.collection('students').doc('seed-student-vivek').get();
  if (preferred.exists) return { id: preferred.id, ...preferred.data() };

  const snapshot = await db.collection('students').where('status', '==', 'Active').limit(1).get();
  if (snapshot.empty) {
    throw new Error('No active student record found to link to reviewer parent account.');
  }
  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() };
}

async function upsertReviewerAuthUser() {
  try {
    const existing = await auth.getUserByEmail(REVIEWER_EMAIL);
    await auth.updateUser(existing.uid, {
      displayName: REVIEWER_NAME,
      emailVerified: true,
      password: REVIEWER_PASSWORD,
      disabled: false,
    });
    return { uid: existing.uid, action: 'updated' };
  } catch (error) {
    if (error?.code !== 'auth/user-not-found') throw error;
    const created = await auth.createUser({
      displayName: REVIEWER_NAME,
      email: REVIEWER_EMAIL,
      emailVerified: true,
      password: REVIEWER_PASSWORD,
      disabled: false,
    });
    return { uid: created.uid, action: 'created' };
  }
}

function writeMobileAliasFile() {
  const path = 'college_erp_mobile/assets/login_aliases.json';
  const aliases = existsSync(path) ? readJson(path) : {};
  aliases[normalize(REVIEWER_EMAIL)] = REVIEWER_EMAIL;
  aliases[REVIEWER_PHONE_ALIAS] = REVIEWER_EMAIL;
  const ordered = Object.fromEntries(Object.entries(aliases).sort(([left], [right]) => left.localeCompare(right)));
  writeFileSync(path, `${JSON.stringify(ordered, null, 2)}\n`);
}

const student = await findLinkedStudent();
const { uid, action } = await upsertReviewerAuthUser();

const profile = {
  uid,
  name: REVIEWER_NAME,
  email: REVIEWER_EMAIL,
  authEmail: REVIEWER_EMAIL,
  phone: REVIEWER_PHONE_ALIAS,
  roleId: 'parent',
  displayId: REVIEWER_DISPLAY_ID,
  collegeIds: ['main-campus'],
  status: 'Active',
  linkedStudentRecordIds: [student.id],
  linkedStudentIds: student.studentId ? [student.studentId] : [],
  sourceCollection: 'users',
  sourceRecordId: REVIEWER_DISPLAY_ID,
  managedBy: 'store-reviewer-account',
  updatedAt: FieldValue.serverTimestamp(),
  createdAtText: '20 Jul 2026',
};

await db.collection('users').doc(uid).set(profile, { merge: true });
await db.collection('parentPortalLinks').doc('store-review-parent-link').set({
  parentUserId: uid,
  parentEmail: REVIEWER_EMAIL,
  studentRecordId: student.id,
  studentId: student.studentId || '',
  relationship: 'Guardian',
  status: 'Active',
  managedBy: 'store-reviewer-account',
  updatedAt: FieldValue.serverTimestamp(),
}, { merge: true });

writeMobileAliasFile();

console.log(`${action}: ${REVIEWER_EMAIL} -> parent`);
console.log(`Linked student: ${student.name || student.studentId || student.id}`);
console.log(`Username: ${REVIEWER_EMAIL}`);
console.log(`Password: ${REVIEWER_PASSWORD}`);
console.log(`Phone alias: ${REVIEWER_PHONE_ALIAS}`);
