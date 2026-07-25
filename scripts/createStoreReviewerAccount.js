import { existsSync, readFileSync } from 'node:fs';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const REVIEWER_PASSWORD = process.env.STORE_REVIEWER_PASSWORD;
const reviewerAccounts = JSON.parse(process.env.STORE_REVIEWER_ACCOUNTS_JSON || '[]');

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

if (!getApps().length) {
  initializeApp({ credential: getCredential() });
}

if (!REVIEWER_PASSWORD || REVIEWER_PASSWORD.length < 12) {
  throw new Error('Set STORE_REVIEWER_PASSWORD to the live App Store reviewer password.');
}

if (!reviewerAccounts.length) {
  throw new Error('Set STORE_REVIEWER_ACCOUNTS_JSON to reviewer account definitions.');
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

async function upsertReviewerAuthUser(account) {
  try {
    const existing = await auth.getUserByEmail(account.email);
    await auth.updateUser(existing.uid, {
      displayName: account.name,
      emailVerified: true,
      password: REVIEWER_PASSWORD,
      disabled: false,
    });
    return { uid: existing.uid, action: 'updated' };
  } catch (error) {
    if (error?.code !== 'auth/user-not-found') throw error;
    const created = await auth.createUser({
      displayName: account.name,
      email: account.email,
      emailVerified: true,
      password: REVIEWER_PASSWORD,
      disabled: false,
    });
    return { uid: created.uid, action: 'created' };
  }
}

const student = await findLinkedStudent();
for (const account of reviewerAccounts) {
  const { uid, action } = await upsertReviewerAuthUser(account);
  const isParent = account.roleId === 'parent';
  const profile = {
    uid,
    name: account.name,
    email: account.email,
    authEmail: account.email,
    phone: account.phone,
    roleId: account.roleId,
    displayId: account.displayId,
    collegeIds: ['main-campus'],
    status: 'Active',
    linkedStudentRecordIds: isParent ? [student.id] : [],
    linkedStudentIds: isParent && student.studentId ? [student.studentId] : [],
    sourceCollection: 'users',
    sourceRecordId: account.displayId,
    managedBy: 'store-reviewer-account',
    updatedAt: FieldValue.serverTimestamp(),
    createdAtText: '25 Jul 2026',
  };

  await db.collection('users').doc(uid).set(profile, { merge: true });

  if (isParent) {
    await db.collection('parentPortalLinks').doc('store-review-parent-link').set({
      parentUserId: uid,
      parentEmail: account.email,
      studentRecordId: student.id,
      studentId: student.studentId || '',
      relationship: 'Guardian',
      status: 'Active',
      managedBy: 'store-reviewer-account',
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  console.log(`${action}: ${account.email} -> ${account.roleId}`);
}

console.log(`Linked student: ${student.name || student.studentId || student.id}`);
