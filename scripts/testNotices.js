import assert from 'node:assert/strict';
import {
  filterNotices,
  filterVisibleNoticesForRole,
  getNoticeDisplayStatus,
  isExpired,
  isPublished,
  noticeMatchesCourseScope,
  summarizeNotices,
  validateNoticeForm,
} from '../src/modules/notices/noticeUtils.js';

const now = new Date('2026-06-19T10:00:00');
const notices = [
  {
    id: 'n1',
    type: 'Digital Notice',
    title: 'Published notice',
    audience: 'Students',
    priority: 'Normal',
    body: 'Body',
    publishDate: '2026-06-18',
    expiryDate: '2026-06-30',
    status: 'Published',
    createdByName: 'Admin',
  },
  {
    id: 'n2',
    type: 'Circular',
    title: 'Future circular',
    audience: 'Faculty',
    priority: 'Important',
    body: 'Body',
    publishDate: '2026-06-25',
    expiryDate: '2026-06-30',
    status: 'Published',
    createdByName: 'Admin',
  },
  {
    id: 'n3',
    type: 'Event Announcement',
    title: 'Old event',
    audience: 'All',
    priority: 'Urgent',
    body: 'Body',
    publishDate: '2026-06-01',
    expiryDate: '2026-06-10',
    status: 'Published',
    createdByName: 'Admin',
  },
  {
    id: 'n4',
    type: 'Digital Notice',
    title: 'Draft notice',
    audience: 'Parents',
    priority: 'Normal',
    body: 'Body',
    publishDate: '2026-06-20',
    expiryDate: '',
    status: 'Draft',
    createdByName: 'Admin',
  },
];

assert.equal(isPublished(notices[0], now), true);
assert.equal(isPublished(notices[1], now), false);
assert.equal(isExpired(notices[2], now), true);
assert.equal(getNoticeDisplayStatus(notices[0], now), 'Published');
assert.equal(getNoticeDisplayStatus(notices[1], now), 'Scheduled');
assert.equal(getNoticeDisplayStatus(notices[2], now), 'Expired');
assert.equal(getNoticeDisplayStatus(notices[3], now), 'Draft');

assert.deepEqual(summarizeNotices(notices, now), {
  total: 4,
  published: 1,
  drafts: 1,
  scheduled: 1,
  expired: 1,
  urgent: 1,
});

assert.equal(filterNotices(notices, { type: 'Circular' }).length, 1);
assert.equal(filterNotices(notices, { audience: 'Students' }).length, 1);
assert.equal(filterNotices(notices, { search: 'old' }).length, 1);

const courseScopedNotices = [
  { ...notices[0], id: 'global', courseCode: '' },
  { ...notices[0], id: 'bsc', courseCode: 'BSC-NURSING', courseName: 'B.Sc Nursing' },
  { ...notices[0], id: 'gnm', courseCode: 'GNM', courseName: 'GNM Nursing' },
];
assert.deepEqual(
  courseScopedNotices
    .filter((item) => noticeMatchesCourseScope(item, 'BSC-NURSING', { courseName: 'B.Sc Nursing' }))
    .map((item) => item.id),
  ['global', 'bsc'],
);
assert.equal(noticeMatchesCourseScope(courseScopedNotices[2], 'all', null), true);
assert.deepEqual(
  filterVisibleNoticesForRole(notices, 'faculty', false, now).map((item) => item.id),
  [],
);
assert.deepEqual(
  filterVisibleNoticesForRole(notices, 'student', false, now).map((item) => item.id),
  ['n1'],
);
assert.deepEqual(
  filterVisibleNoticesForRole([
    { ...notices[0], id: 'all-notice', audience: 'All' },
    { ...notices[0], id: 'parent-notice', audience: 'Parents' },
  ], 'parent', false, now).map((item) => item.id),
  ['parent-notice'],
);
assert.equal(filterVisibleNoticesForRole(notices, 'admin', true, now).length, 4);

assert.equal(validateNoticeForm({}), 'Title is required.');
assert.equal(validateNoticeForm({
  title: 'Notice',
  type: 'Digital Notice',
  audience: 'All',
  body: 'Content',
  publishDate: '2026-06-20',
  expiryDate: '2026-06-19',
}), 'Expiry date cannot be before publish date.');
assert.equal(validateNoticeForm({
  title: 'Notice',
  type: 'Digital Notice',
  audience: 'All',
  body: 'Content',
  publishDate: '2026-06-20',
}), '');

console.log('Notice tests passed.');
