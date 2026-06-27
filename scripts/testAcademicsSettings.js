import assert from 'node:assert/strict';
import {
  buildClassKey,
  filterAcademicItems,
  summarizeAcademics,
  validateBatch,
  validateCalendarEvent,
  validateProgram,
  validateSubject,
} from '../src/modules/academics/academicUtils.js';
import {
  buildNextId,
  summarizeSettings,
  validateAcademicYearSettings,
  validateInstituteSettings,
} from '../src/modules/settings/settingsUtils.js';
import { normalizeInstituteSettings } from '../src/modules/settings/demoSettings.js';

assert.equal(buildClassKey({ className: 'Class XII', section: 'A' }), 'Class XII - A');
assert.deepEqual(summarizeAcademics([{}], [{}, {}], [{}], [{ status: 'Published' }, { status: 'Draft' }]), {
  programs: 1,
  subjects: 2,
  batches: 1,
  publishedEvents: 1,
});
assert.equal(filterAcademicItems([{ name: 'Science' }, { name: 'Commerce' }], 'sci').length, 1);
assert.equal(validateProgram({}), 'Program name is required.');
assert.equal(validateProgram({ name: 'Science', code: 'SCI', academicYear: '2026-2027' }), '');
assert.equal(validateSubject({}), 'Subject name is required.');
assert.equal(validateSubject({ subjectName: 'Physics', subjectCode: 'PHY', programName: 'Science' }), '');
assert.equal(validateBatch({}), 'Class name is required.');
assert.equal(validateBatch({ className: 'Class XII', section: 'A', programName: 'Science' }), '');
assert.equal(validateCalendarEvent({}), 'Event title is required.');
assert.equal(validateCalendarEvent({ title: 'Orientation', eventDate: '2026-06-01', eventType: 'Academic' }), '');

assert.equal(buildNextId('ADM-{year}-{number}', 7), 'ADM-2026-00007');
assert.deepEqual(
  summarizeSettings({ name: 'College', email: 'admin@college.edu' }, { name: '2026-2027' }, { student: 'STU-{number}' }, { a: true, b: false }),
  {
    instituteConfigured: true,
    academicYear: '2026-2027',
    idFormats: 1,
    enabledDefaults: 1,
  }
);
assert.equal(normalizeInstituteSettings({ name: 'DB College', code: 'DBC' }).name, 'DB College');
assert.equal(normalizeInstituteSettings({ name: 'DB College', code: 'DBC' }).instituteId, 'DBC');
assert.equal(validateInstituteSettings({}), 'Institute name is required.');
assert.equal(validateInstituteSettings({ name: 'College', email: 'bad', phone: '123' }), 'Valid institute email is required.');
assert.equal(validateInstituteSettings({ name: 'College', email: 'admin@college.edu', phone: '123' }), '');
assert.equal(validateAcademicYearSettings({}), 'Academic year name is required.');
assert.equal(validateAcademicYearSettings({ name: '2026', startsOn: '2026-06-01', endsOn: '2026-05-01' }), 'End date cannot be before start date.');
assert.equal(validateAcademicYearSettings({ name: '2026', startsOn: '2026-06-01', endsOn: '2027-03-31' }), '');

console.log('Academics and settings tests passed.');
