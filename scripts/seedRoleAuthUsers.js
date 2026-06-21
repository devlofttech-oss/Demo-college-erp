import { existsSync, readFileSync } from 'node:fs';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
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

if (!getApps().length) {
  initializeApp({ credential: getCredential() });
}

const auth = getAuth();
const db = getFirestore();
const temporaryPassword = process.env.SEED_USER_PASSWORD;

if (!temporaryPassword || temporaryPassword.length < 12) {
  throw new Error('Set SEED_USER_PASSWORD to a strong temporary password with at least 12 characters.');
}

const roleUsers = [
  {
    name: 'ERP Super Admin',
    email: 'superadmin@college.edu',
    roleId: 'super-admin',
    displayId: 'SA-001',
  },
  {
    name: 'College Admin',
    email: 'admin@college.edu',
    roleId: 'admin',
    displayId: 'ADM-001',
  },
  {
    name: 'Faculty User',
    email: 'faculty@college.edu',
    roleId: 'faculty',
    displayId: 'EMP-1001',
  },
  {
    name: 'Parent User',
    email: 'parent.vivek@example.com',
    roleId: 'parent',
    displayId: 'PAR-001',
    linkedStudentRecordIds: ['seed-student-vivek'],
    linkedStudentIds: ['STU-4449'],
  },
];

async function upsertAuthUser(user) {
  try {
    const existing = await auth.getUserByEmail(user.email);
    await auth.updateUser(existing.uid, {
      displayName: user.name,
      password: temporaryPassword,
      disabled: false,
    });
    return { uid: existing.uid, action: 'updated' };
  } catch (error) {
    if (error?.code !== 'auth/user-not-found') throw error;
    const created = await auth.createUser({
      displayName: user.name,
      email: user.email,
      emailVerified: true,
      password: temporaryPassword,
      disabled: false,
    });
    return { uid: created.uid, action: 'created' };
  }
}

for (const user of roleUsers) {
  const { uid, action } = await upsertAuthUser(user);
  await db.collection('users').doc(uid).set({
    uid,
    name: user.name,
    email: user.email,
    roleId: user.roleId,
    displayId: user.displayId,
    collegeIds: ['main-campus'],
    status: 'Active',
    linkedStudentRecordIds: user.roleId === 'parent' ? user.linkedStudentRecordIds || [] : [],
    linkedStudentIds: user.roleId === 'parent' ? user.linkedStudentIds || [] : [],
    createdAtText: '21 Jun 2026',
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  console.log(`${action}: ${user.email} -> ${user.roleId}`);
}

console.log('Seeded role users with the password supplied through SEED_USER_PASSWORD.');
