import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomInt } from 'node:crypto';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { admissionStudents } from '../src/modules/students/admissionSeedData.js';
import { demoStaffMembers } from '../src/modules/facultyStaff/demoFacultyStaff.js';
import { applyStudentActivityOverrides, isActiveStudentRecord } from '../src/modules/shared/studentActivityPolicy.js';

const OUTPUT_JSON = new URL('../tmp/pdfs/maurya-login-credentials-data.json', import.meta.url);
const CREDENTIAL_SEED = 'maurya-login-credentials-2026-06-30';
const MANAGED_BY = 'maurya-credential-seed';
const destructiveCleanupUnlocked = process.env.FIRESTORE_DESTRUCTIVE_CLEANUP_UNLOCK === 'YES_I_ACCEPT_CREDENTIAL_DATA_DELETION';
const OLD_SEED_EMAILS = new Set([
  'superadmin@college.edu',
  'admin@college.edu',
  'faculty@college.edu',
  'parent.vivek@example.com',
]);
const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

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

function isValidEmail(value = '') {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
}

function normalizeEmail(value = '') {
  return String(value).trim().toLowerCase();
}

function phoneDigits(value = '') {
  return String(value).replace(/\D/g, '');
}

function slug(value = '') {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'login';
}

function firstUsableIdentifier(record) {
  const email = String(record.email || '').trim();
  if (isValidEmail(email)) return { identifier: normalizeEmail(email), type: 'email' };

  const fields = [record.phone, record.mobileNo, record.phoneNo, record.alternatePhoneNo, record.email];
  const phone = fields.map(phoneDigits).find((digits) => digits.length >= 6);
  if (phone) return { identifier: phone, type: 'phone' };

  return { identifier: '', type: 'fallback' };
}

function makePassword(used) {
  while (true) {
    let password = '';
    for (let index = 0; index < 8; index += 1) {
      password += PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)];
    }
    if (!used.has(password)) {
      used.add(password);
      return password;
    }
  }
}

function fallbackAuthEmail(prefix, record) {
  const recordKey = record.studentId || record.employeeId || record.id || record.name;
  return `${slug(prefix)}-${slug(recordKey)}@maurya.edu`;
}

function buildUniqueLogin(record, prefix, usedIdentifiers, usedAuthEmails) {
  const usable = firstUsableIdentifier(record);
  const rawIdentifier = usable.identifier || fallbackAuthEmail(prefix, record);
  let loginIdentifier = rawIdentifier;
  let loginIdentifierType = usable.type;

  if (usedIdentifiers.has(loginIdentifier.toLowerCase())) {
    const phone = [record.phone, record.mobileNo, record.phoneNo, record.alternatePhoneNo]
      .map(phoneDigits)
      .find((digits) => digits.length >= 6 && !usedIdentifiers.has(digits.toLowerCase()));
    if (phone) {
      loginIdentifier = phone;
      loginIdentifierType = 'phone';
    }
  }

  if (usedIdentifiers.has(loginIdentifier.toLowerCase())) {
    loginIdentifier = fallbackAuthEmail(prefix, record);
    loginIdentifierType = 'fallback';
  }

  let authEmail = isValidEmail(loginIdentifier)
    ? normalizeEmail(loginIdentifier)
    : fallbackAuthEmail(prefix, { ...record, studentId: record.studentId || loginIdentifier });

  let suffix = 2;
  while (usedAuthEmails.has(authEmail)) {
    const [localPart, domain] = authEmail.split('@');
    authEmail = `${localPart}-${suffix}@${domain}`;
    suffix += 1;
  }

  usedIdentifiers.add(loginIdentifier.toLowerCase());
  usedAuthEmails.add(authEmail);

  return {
    authEmail,
    loginIdentifier,
    loginIdentifierType,
  };
}

async function readCollectionRecords(collectionName, fallbackRecords, expectedCount) {
  const snapshot = await db.collection(collectionName).get();
  const records = snapshot.docs
    .filter((doc) => doc.id !== '__schema')
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((record) => record.status !== 'Archived');

  if (records.length >= expectedCount) return records;
  return fallbackRecords;
}

function sortStudents(students) {
  return [...students].sort((left, right) =>
    String(left.studentId || left.name).localeCompare(String(right.studentId || right.name), undefined, { numeric: true })
  );
}

function sortStaff(staff) {
  return [...staff].sort((left, right) =>
    String(left.employeeId || left.name).localeCompare(String(right.employeeId || right.name), undefined, { numeric: true })
  );
}

function buildFallbackStudents() {
  return applyStudentActivityOverrides(admissionStudents.map((student) => ({ ...student }))).filter(isActiveStudentRecord);
}

function buildFallbackStaff() {
  return demoStaffMembers.map((staff) => {
    const { id, ...data } = staff;
    return {
      ...data,
      id: id.replace('demo-staff-', 'seed-staff-'),
    };
  });
}

async function buildCredentialRows() {
  const usedPasswords = new Set();
  const usedIdentifiers = new Set();
  const usedAuthEmails = new Set();
  const rows = [];

  usedIdentifiers.add('admin@maurya.edu');
  usedAuthEmails.add('admin@maurya.edu');
  rows.push({
    role: 'Admin',
    roleId: 'admin',
    name: 'Maurya Admin',
    displayId: 'ADM-001',
    recordId: '',
    sourceCollection: 'users',
    loginIdentifier: 'admin@maurya.edu',
    loginIdentifierType: 'email',
    authEmail: 'admin@maurya.edu',
    password: makePassword(usedPasswords),
    linkedStudentRecordIds: [],
    linkedStudentIds: [],
  });

  const staffRecords = sortStaff(await readCollectionRecords('staffMembers', buildFallbackStaff(), 8)).slice(0, 8);
  const studentRecords = sortStudents(
    applyStudentActivityOverrides(await readCollectionRecords('students', buildFallbackStudents(), 135)).filter(isActiveStudentRecord)
  ).slice(0, 135);

  for (const staff of staffRecords) {
    const login = buildUniqueLogin(staff, 'faculty', usedIdentifiers, usedAuthEmails);
    rows.push({
      role: 'Faculty',
      roleId: 'faculty',
      name: staff.name || staff.employeeId || 'Faculty',
      displayId: staff.employeeId || '',
      recordId: staff.id || '',
      sourceCollection: 'staffMembers',
      department: staff.department || '',
      loginIdentifier: login.loginIdentifier,
      loginIdentifierType: login.loginIdentifierType,
      authEmail: login.authEmail,
      password: makePassword(usedPasswords),
      linkedStudentRecordIds: [],
      linkedStudentIds: [],
    });
  }

  for (const student of studentRecords) {
    const login = buildUniqueLogin(student, 'student', usedIdentifiers, usedAuthEmails);
    rows.push({
      role: 'Student',
      roleId: 'parent',
      name: student.name || student.studentId || 'Student',
      displayId: student.studentId || '',
      recordId: student.id || '',
      sourceCollection: 'students',
      courseName: student.courseName || student.program || '',
      loginIdentifier: login.loginIdentifier,
      loginIdentifierType: login.loginIdentifierType,
      authEmail: login.authEmail,
      password: makePassword(usedPasswords),
      linkedStudentRecordIds: student.id ? [student.id] : [],
      linkedStudentIds: student.studentId ? [student.studentId] : [],
    });
  }

  return rows;
}

async function upsertAuthUser(row) {
  try {
    const existing = await auth.getUserByEmail(row.authEmail);
    await auth.updateUser(existing.uid, {
      displayName: row.name,
      emailVerified: true,
      password: row.password,
      disabled: false,
    });
    return { uid: existing.uid, action: 'updated' };
  } catch (error) {
    if (error?.code !== 'auth/user-not-found') throw error;
    const created = await auth.createUser({
      displayName: row.name,
      email: row.authEmail,
      emailVerified: true,
      password: row.password,
      disabled: false,
    });
    return { uid: created.uid, action: 'created' };
  }
}

function isStaleProfile(doc, targetAuthEmails) {
  const data = doc.data();
  const email = normalizeEmail(data.email || '');
  const authEmail = normalizeEmail(data.authEmail || '');
  return (
    doc.id.startsWith('seed-')
    || OLD_SEED_EMAILS.has(email)
    || OLD_SEED_EMAILS.has(authEmail)
    || (data.credentialManagedBy === MANAGED_BY && !targetAuthEmails.has(authEmail || email))
  );
}

async function deleteStaleFirestoreCredentials(targetAuthEmails) {
  if (!destructiveCleanupUnlocked) {
    console.log('Credential cleanup deletes are locked; stale Firestore profiles and parent links were preserved.');
    return { deletedProfiles: 0, deletedLinks: 0, staleEmails: new Set() };
  }

  const usersSnapshot = await db.collection('users').get();
  const staleProfiles = usersSnapshot.docs.filter((doc) => isStaleProfile(doc, targetAuthEmails));
  const staleEmails = new Set(
    staleProfiles.flatMap((doc) => {
      const data = doc.data();
      return [normalizeEmail(data.email || ''), normalizeEmail(data.authEmail || '')].filter(Boolean);
    })
  );

  let deletedProfiles = 0;
  let batch = db.batch();
  let operationCount = 0;
  for (const profile of staleProfiles) {
    batch.delete(profile.ref);
    deletedProfiles += 1;
    operationCount += 1;
  }

  const linksSnapshot = await db.collection('parentPortalLinks').get();
  let deletedLinks = 0;
  for (const link of linksSnapshot.docs) {
    const data = link.data();
    if (link.id.startsWith('seed-') || data.credentialManagedBy === MANAGED_BY) {
      batch.delete(link.ref);
      deletedLinks += 1;
      operationCount += 1;
    }
    if (operationCount >= 450) {
      await batch.commit();
      batch = db.batch();
      operationCount = 0;
    }
  }

  if (operationCount) await batch.commit();
  return { deletedProfiles, deletedLinks, staleEmails };
}

async function deleteStaleAuthUsers(targetAuthEmails, staleProfileEmails) {
  if (!destructiveCleanupUnlocked) {
    console.log('Credential cleanup auth deletes are locked; stale Firebase Auth users were preserved.');
    return 0;
  }

  const staleUids = [];
  let pageToken;
  do {
    const result = await auth.listUsers(1000, pageToken);
    for (const user of result.users) {
      const email = normalizeEmail(user.email || '');
      const isOldSeed = OLD_SEED_EMAILS.has(email) || staleProfileEmails.has(email);
      const isOldGeneratedMaurya = email.endsWith('@maurya.edu') && !targetAuthEmails.has(email);
      if (email && !targetAuthEmails.has(email) && (isOldSeed || isOldGeneratedMaurya)) {
        staleUids.push(user.uid);
      }
    }
    pageToken = result.pageToken;
  } while (pageToken);

  if (!staleUids.length) return 0;
  const result = await auth.deleteUsers(staleUids);
  if (result.failureCount) {
    console.warn(`Failed to delete ${result.failureCount} stale auth users.`);
  }
  return result.successCount;
}

async function writeProfiles(rows) {
  const pdfRows = [];
  let created = 0;
  let updated = 0;
  let batch = db.batch();
  let operationCount = 0;

  for (const row of rows) {
    const result = await upsertAuthUser(row);
    if (result.action === 'created') created += 1;
    if (result.action === 'updated') updated += 1;

    const profile = {
      uid: result.uid,
      name: row.name,
      email: row.authEmail,
      authEmail: row.authEmail,
      loginIdentifier: row.loginIdentifier,
      loginIdentifierType: row.loginIdentifierType,
      roleId: row.roleId,
      displayId: row.displayId,
      department: row.department || '',
      collegeIds: ['main-campus'],
      status: 'Active',
      linkedStudentRecordIds: row.linkedStudentRecordIds,
      linkedStudentIds: row.linkedStudentIds,
      sourceCollection: row.sourceCollection,
      sourceRecordId: row.recordId,
      credentialSeed: CREDENTIAL_SEED,
      credentialManagedBy: MANAGED_BY,
      createdAtText: '30 Jun 2026',
      updatedAt: FieldValue.serverTimestamp(),
    };

    batch.set(db.collection('users').doc(result.uid), profile, { merge: true });
    operationCount += 1;

    if (row.role === 'Student' && row.recordId) {
      batch.set(db.collection('parentPortalLinks').doc(`maurya-login-${row.recordId}`), {
        parentUserId: result.uid,
        parentEmail: row.authEmail,
        loginIdentifier: row.loginIdentifier,
        studentRecordId: row.recordId,
        studentId: row.displayId,
        relationship: 'Self',
        status: 'Active',
        credentialSeed: CREDENTIAL_SEED,
        credentialManagedBy: MANAGED_BY,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      operationCount += 1;
    }

    if (operationCount >= 400) {
      await batch.commit();
      batch = db.batch();
      operationCount = 0;
    }

    pdfRows.push({
      role: row.role,
      name: row.name,
      recordId: row.displayId || row.recordId,
      courseOrDepartment: row.courseName || row.department || '',
      loginIdentifier: row.loginIdentifier,
      loginIdentifierType: row.loginIdentifierType,
      authEmail: row.authEmail,
      password: row.password,
    });
  }

  if (operationCount) await batch.commit();
  return { rows: pdfRows, created, updated };
}

const rows = await buildCredentialRows();
const targetAuthEmails = new Set(rows.map((row) => normalizeEmail(row.authEmail)));
const cleanup = await deleteStaleFirestoreCredentials(targetAuthEmails);
const deletedAuthUsers = await deleteStaleAuthUsers(targetAuthEmails, cleanup.staleEmails);
const written = await writeProfiles(rows);

mkdirSync(dirname(fileURLToPath(OUTPUT_JSON)), { recursive: true });
writeFileSync(fileURLToPath(OUTPUT_JSON), JSON.stringify({
  generatedAt: new Date().toISOString(),
  credentialSeed: CREDENTIAL_SEED,
  counts: {
    admin: rows.filter((row) => row.role === 'Admin').length,
    faculty: rows.filter((row) => row.role === 'Faculty').length,
    students: rows.filter((row) => row.role === 'Student').length,
    total: rows.length,
  },
  firebase: {
    authUsersCreated: written.created,
    authUsersUpdated: written.updated,
    staleAuthUsersDeleted: deletedAuthUsers,
    staleProfilesDeleted: cleanup.deletedProfiles,
    staleParentPortalLinksDeleted: cleanup.deletedLinks,
  },
  rows: written.rows,
}, null, 2));

console.log(`Created/updated ${rows.length} Maurya login credentials.`);
console.log(`Auth users created: ${written.created}; updated: ${written.updated}; stale auth users deleted: ${deletedAuthUsers}.`);
console.log(`Stale user profiles deleted: ${cleanup.deletedProfiles}; stale parent links deleted: ${cleanup.deletedLinks}.`);
console.log(`Credential data written to ${fileURLToPath(OUTPUT_JSON)}`);
