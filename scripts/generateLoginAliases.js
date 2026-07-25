import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const OUTPUT_FILE = 'src/firebase/loginAliases.generated.js';
const PHONE_FIELDS = ['phone', 'mobileNo', 'phoneNo', 'alternatePhoneNo'];
const EMAIL_FIELDS = ['email', 'authEmail', 'loginIdentifier'];

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

function phoneDigits(value = '') {
  return String(value).replace(/\D/g, '');
}

function addAlias(candidates, alias, authEmail) {
  const normalized = normalize(alias);
  if (normalized) {
    if (!candidates.has(normalized)) candidates.set(normalized, new Set());
    candidates.get(normalized).add(authEmail);
  }

  const digits = phoneDigits(alias);
  if (digits.length >= 6) {
    if (!candidates.has(digits)) candidates.set(digits, new Set());
    candidates.get(digits).add(authEmail);
  }
}

function getProfileRecordKeys(profile) {
  const recordsToCheck = [];

  if (profile.sourceCollection && profile.sourceRecordId) {
    recordsToCheck.push([profile.sourceCollection, profile.sourceRecordId]);
  }

  for (const studentRecordId of profile.linkedStudentRecordIds || []) {
    recordsToCheck.push(['students', studentRecordId]);
  }

  return recordsToCheck;
}

if (!getApps().length) {
  initializeApp({ credential: getCredential() });
}

const db = getFirestore();
const snapshot = await db.collection('users').get();
const candidates = new Map();
const activeProfiles = [];
const sourceRecordRefs = new Map();

for (const doc of snapshot.docs) {
  if (doc.id === '__schema') continue;
  const profile = doc.data();
  if (profile.status && profile.status !== 'Active') continue;
  if (profile.managedBy === 'store-reviewer-account') continue;

  const authEmail = normalize(profile.authEmail || profile.email || '');
  if (!authEmail) continue;

  activeProfiles.push({ profile, authEmail });
  for (const field of EMAIL_FIELDS) addAlias(candidates, profile[field], authEmail);
  for (const field of PHONE_FIELDS) addAlias(candidates, profile[field], authEmail);

  for (const [collectionName, recordId] of getProfileRecordKeys(profile)) {
    if (!collectionName || !recordId) continue;
    const key = `${collectionName}/${recordId}`;
    if (!sourceRecordRefs.has(key)) {
      sourceRecordRefs.set(key, db.collection(collectionName).doc(recordId));
    }
  }
}

const sourceRecords = new Map();
const refs = [...sourceRecordRefs.entries()];
for (let index = 0; index < refs.length; index += 100) {
  const chunk = refs.slice(index, index + 100);
  const snapshots = await Promise.all(chunk.map(([, ref]) => ref.get()));
  snapshots.forEach((recordSnapshot, snapshotIndex) => {
    if (recordSnapshot.exists) sourceRecords.set(chunk[snapshotIndex][0], recordSnapshot.data());
  });
}

for (const { profile, authEmail } of activeProfiles) {
  for (const [collectionName, recordId] of getProfileRecordKeys(profile)) {
    const record = sourceRecords.get(`${collectionName}/${recordId}`);
    if (!record) continue;
    for (const field of PHONE_FIELDS) addAlias(candidates, record[field], authEmail);
    for (const field of EMAIL_FIELDS) addAlias(candidates, record[field], authEmail);
  }
}

const aliases = {};
const ambiguousAliases = [];

for (const [alias, authEmails] of candidates.entries()) {
  if (authEmails.size === 1) {
    aliases[alias] = [...authEmails][0];
  } else {
    ambiguousAliases.push(alias);
  }
}

const orderedAliases = Object.fromEntries(
  Object.entries(aliases).sort(([left], [right]) => left.localeCompare(right))
);
const output = `// Generated from Firestore user profiles. Do not add passwords here.\nexport const loginAliases = ${JSON.stringify(orderedAliases, null, 2)};\n`;

writeFileSync(OUTPUT_FILE, output);

console.log(`Wrote ${Object.keys(orderedAliases).length} login aliases to ${OUTPUT_FILE}.`);
if (ambiguousAliases.length) {
  console.log(`Skipped ${ambiguousAliases.length} ambiguous aliases: ${ambiguousAliases.slice(0, 10).join(', ')}${ambiguousAliases.length > 10 ? '...' : ''}`);
}
