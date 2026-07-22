import assert from 'node:assert/strict';
import {
  canEditSubjectNote,
  collectUserIdentityTokens,
  filterSubjectNotes,
  formatFileSize,
  getNoteSubjectLabel,
  getSubjectLabel,
  noteMatchesUser,
  summarizeSubjectNotes,
  validateSubjectNoteForm,
} from '../src/modules/subjectNotes/subjectNoteUtils.js';

const subject = {
  id: 'sub-1',
  subjectName: 'Physics',
  subjectCode: 'PHY-12',
  displayPeriod: 'Semester 2',
};
const notes = [
  {
    id: 'n1',
    title: 'Motion Notes',
    subjectRecordId: 'sub-1',
    subjectName: 'Physics',
    subjectCode: 'PHY-12',
    facultyId: 'EMP-1001',
    facultyName: 'Dr. Kavita Menon',
    uploadedByEmail: 'faculty@example.com',
    fileName: 'motion.pdf',
    fileSize: 1048576,
    status: 'Published',
  },
  {
    id: 'n2',
    title: 'Chemistry Draft',
    subjectRecordId: 'sub-2',
    subjectName: 'Chemistry',
    subjectCode: 'CHEM-12',
    facultyId: 'EMP-2002',
    facultyName: 'Prof. Ramesh Iyer',
    status: 'Draft',
  },
];

const tokens = collectUserIdentityTokens({ uid: 'u1', email: 'faculty@example.com', displayId: 'EMP-1001' });

assert.equal(getSubjectLabel(subject), 'Physics / PHY-12 / Semester 2');
assert.equal(getNoteSubjectLabel(notes[0]), 'Physics / PHY-12');
assert.equal(formatFileSize(1048576), '1.0 MB');

assert.equal(noteMatchesUser(notes[0], tokens), true);
assert.equal(noteMatchesUser(notes[1], tokens), false);
assert.equal(canEditSubjectNote(notes[0], { canEdit: true, identityTokens: tokens }), true);
assert.equal(canEditSubjectNote(notes[1], { canEdit: true, identityTokens: tokens }), false);
assert.equal(canEditSubjectNote(notes[1], { canEdit: true, canManageAll: true, identityTokens: tokens }), true);
assert.equal(canEditSubjectNote(notes[0], { canEdit: false, identityTokens: tokens }), false);

assert.equal(filterSubjectNotes(notes, { search: 'motion' }).length, 1);
assert.equal(filterSubjectNotes(notes, { status: 'Draft' }).length, 1);
assert.equal(filterSubjectNotes(notes, { subjectRecordId: 'sub-1' }).length, 1);
assert.equal(filterSubjectNotes(notes, { facultyId: 'EMP-2002' }).length, 1);

assert.deepEqual(summarizeSubjectNotes(notes, tokens), {
  total: 2,
  published: 1,
  drafts: 1,
  archived: 0,
  own: 1,
});

assert.equal(validateSubjectNoteForm({}, { requireFile: true }), 'Subject is required.');
assert.equal(validateSubjectNoteForm({ subjectRecordId: 'sub-1', title: '', status: 'Published', file: {} }, { requireFile: true }), 'Title is required.');
assert.equal(validateSubjectNoteForm({ subjectRecordId: 'sub-1', title: 'Notes', status: 'Missing', file: {} }, { requireFile: true }), 'Status is required.');
assert.equal(validateSubjectNoteForm({ subjectRecordId: 'sub-1', title: 'Notes', status: 'Published' }, { requireFile: true }), 'PDF file is required.');
assert.equal(validateSubjectNoteForm({ subjectRecordId: 'sub-1', title: 'Notes', status: 'Published', file: {} }, { requireFile: true }), '');

console.log('Subject note tests passed.');
