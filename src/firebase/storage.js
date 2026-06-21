import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage, isFirebaseConfigured } from './config';

const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024;
const ALLOWED_DOCUMENT_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

function sanitizePathSegment(value) {
  return String(value || 'unknown')
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-');
}

function validateDocumentFile(file) {
  if (!file) {
    throw new Error('Choose a file to upload.');
  }
  if (file.size > MAX_DOCUMENT_SIZE) {
    throw new Error('Document uploads must be 10 MB or smaller.');
  }
  if (!ALLOWED_DOCUMENT_TYPES.has(file.type)) {
    throw new Error('Only PDF, JPEG, PNG, and WebP documents can be uploaded.');
  }
}

export async function uploadStudentDocumentFile({ student, file }) {
  if (!isFirebaseConfigured || !storage) {
    throw new Error('Firebase Storage is not configured.');
  }
  validateDocumentFile(file);

  const studentKey = sanitizePathSegment(student.studentId || student.id);
  const timestamp = Date.now();
  const fileName = sanitizePathSegment(file.name);
  const storagePath = `student-documents/${studentKey}/${timestamp}-${fileName}`;
  const fileRef = ref(storage, storagePath);

  await uploadBytes(fileRef, file, {
    contentType: file.type || 'application/octet-stream',
    customMetadata: {
      studentId: student.studentId || '',
      studentRecordId: student.id || '',
    },
  });

  const fileUrl = await getDownloadURL(fileRef);

  return {
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type || 'application/octet-stream',
    fileUrl,
    storagePath,
  };
}

export async function uploadManagedDocumentFile({ ownerType, ownerId, file }) {
  if (!isFirebaseConfigured || !storage) {
    throw new Error('Firebase Storage is not configured.');
  }
  validateDocumentFile(file);

  const ownerKey = sanitizePathSegment(ownerId);
  const typeKey = sanitizePathSegment(ownerType);
  const timestamp = Date.now();
  const fileName = sanitizePathSegment(file.name);
  const storagePath = `managed-documents/${typeKey}/${ownerKey}/${timestamp}-${fileName}`;
  const fileRef = ref(storage, storagePath);

  await uploadBytes(fileRef, file, {
    contentType: file.type || 'application/octet-stream',
    customMetadata: {
      ownerType: ownerType || '',
      ownerId: ownerId || '',
    },
  });

  const fileUrl = await getDownloadURL(fileRef);

  return {
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type || 'application/octet-stream',
    fileUrl,
    storagePath,
  };
}
