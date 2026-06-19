import assert from 'node:assert/strict';
import {
  filterDocuments,
  formatFileSize,
  resolveOwnerName,
  summarizeDocuments,
  validateDocumentForm,
} from '../src/modules/documents/documentUtils.js';

const students = [{ id: 's1', studentId: 'STU-1', name: 'Student One' }];
const staff = [{ id: 't1', employeeId: 'EMP-1', name: 'Staff One' }];
const documents = [
  { id: 'd1', ownerType: 'Student', ownerRecordId: 's1', ownerId: 'STU-1', documentType: 'Aadhaar', category: 'Identity', verificationStatus: 'Verified', fileSize: 1024, tags: 'identity' },
  { id: 'd2', ownerType: 'Staff', ownerRecordId: 't1', ownerId: 'EMP-1', documentType: 'Degree', category: 'HR', verificationStatus: 'Pending Review', fileSize: 1048576, tags: 'qualification' },
  { id: 'd3', ownerType: 'Academic Archive', archiveTitle: 'Result Archive', documentType: 'Result Register', category: 'Academic', verificationStatus: 'Archived', fileSize: 500, tags: 'result' },
];

assert.equal(formatFileSize(500), '500 B');
assert.equal(formatFileSize(1024), '1 KB');
assert.equal(formatFileSize(1048576), '1.0 MB');

assert.equal(resolveOwnerName(documents[0], students, staff), 'Student One');
assert.equal(resolveOwnerName(documents[1], students, staff), 'Staff One');
assert.equal(resolveOwnerName(documents[2], students, staff), 'Result Archive');

assert.deepEqual(summarizeDocuments(documents), {
  total: 3,
  verified: 1,
  pending: 1,
  rejected: 0,
  archived: 1,
});

assert.equal(filterDocuments(documents, { ownerType: 'Student' }).length, 1);
assert.equal(filterDocuments(documents, { category: 'Academic' }).length, 1);
assert.equal(filterDocuments(documents, { search: 'degree' }).length, 1);

assert.equal(validateDocumentForm({}), 'Owner type is required.');
assert.equal(validateDocumentForm({
  ownerType: 'Student',
  ownerRecordId: '',
  documentType: 'Aadhaar',
  category: 'Identity',
}), 'Owner is required.');
assert.equal(validateDocumentForm({
  ownerType: 'Academic Archive',
  archiveTitle: 'Result Archive',
  documentType: 'Result Register',
  category: 'Academic',
}), '');

console.log('Document tests passed.');
