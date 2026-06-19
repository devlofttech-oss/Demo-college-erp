import assert from 'node:assert/strict';
import {
  filterNotices,
  getNoticeDisplayStatus,
  isExpired,
  isPublished,
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
