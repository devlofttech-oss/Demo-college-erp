export const noticeTypes = ['Digital Notice', 'Circular', 'Event Announcement'];
export const noticeAudiences = ['All', 'Students', 'Faculty', 'Parents', 'Administration'];
export const noticePriorities = ['Normal', 'Important', 'Urgent'];

export function formatDisplayDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function isPublished(item, now = new Date()) {
  if (item.status !== 'Published') return false;
  if (!item.publishDate) return true;
  const publishAt = new Date(`${item.publishDate}T00:00:00`);
  return Number.isNaN(publishAt.getTime()) || publishAt <= now;
}

export function isExpired(item, now = new Date()) {
  if (!item.expiryDate) return false;
  const expiresAt = new Date(`${item.expiryDate}T23:59:59`);
  return !Number.isNaN(expiresAt.getTime()) && expiresAt < now;
}

export function getNoticeDisplayStatus(item, now = new Date()) {
  if (item.status === 'Archived') return 'Archived';
  if (item.status === 'Draft') return 'Draft';
  if (isExpired(item, now)) return 'Expired';
  if (isPublished(item, now)) return 'Published';
  return 'Scheduled';
}

export function summarizeNotices(items = [], now = new Date()) {
  return items.reduce((summary, item) => {
    const status = getNoticeDisplayStatus(item, now);
    return {
      total: summary.total + 1,
      published: summary.published + (status === 'Published' ? 1 : 0),
      drafts: summary.drafts + (status === 'Draft' ? 1 : 0),
      scheduled: summary.scheduled + (status === 'Scheduled' ? 1 : 0),
      expired: summary.expired + (status === 'Expired' ? 1 : 0),
      urgent: summary.urgent + (item.priority === 'Urgent' ? 1 : 0),
    };
  }, {
    total: 0,
    published: 0,
    drafts: 0,
    scheduled: 0,
    expired: 0,
    urgent: 0,
  });
}

export function filterNotices(items = [], filters = {}) {
  const term = (filters.search || '').trim().toLowerCase();
  return items.filter((item) => {
    const typeMatches = !filters.type || item.type === filters.type;
    const audienceMatches = !filters.audience || item.audience === filters.audience;
    const statusMatches = !filters.status || getNoticeDisplayStatus(item) === filters.status;
    const textMatches = !term || [item.title, item.referenceNo, item.body, item.createdByName]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(term));
    return typeMatches && audienceMatches && statusMatches && textMatches;
  });
}

export function validateNoticeForm(form) {
  if (!form.title?.trim()) return 'Title is required.';
  if (!noticeTypes.includes(form.type)) return 'Notice type is required.';
  if (!noticeAudiences.includes(form.audience)) return 'Audience is required.';
  if (!form.body?.trim()) return 'Notice content is required.';
  if (!form.publishDate) return 'Publish date is required.';
  if (form.expiryDate && form.expiryDate < form.publishDate) return 'Expiry date cannot be before publish date.';
  return '';
}
