export function formatDisplayDate(date = new Date()) {
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function getMonthKey(dateText = '') {
  const parts = dateText.split(' ');
  return parts.length === 3 ? `${parts[1]} ${parts[2]}` : dateText;
}

export function getYearKey(dateText = '') {
  const parts = dateText.split(' ');
  return parts.length === 3 ? parts[2] : dateText;
}

export function normalizeAttendanceTime(value = '') {
  const trimmed = String(value || '').trim();
  const match = /^(\d{1,2}):(\d{2})$/.exec(trimmed);
  if (!match) return '';
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return '';
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function getAttendanceTimeMinutes(value = '') {
  const normalized = normalizeAttendanceTime(value);
  if (!normalized) return null;
  const [hours, minutes] = normalized.split(':').map(Number);
  return hours * 60 + minutes;
}

export function isAttendanceTimeRangeValid(openingTime = '', closingTime = '') {
  const openingMinutes = getAttendanceTimeMinutes(openingTime);
  const closingMinutes = getAttendanceTimeMinutes(closingTime);
  return openingMinutes !== null && closingMinutes !== null && closingMinutes > openingMinutes;
}

export function formatAttendanceTimeRange(recordOrOpeningTime = '', closingTime = '') {
  const opening = typeof recordOrOpeningTime === 'object'
    ? normalizeAttendanceTime(recordOrOpeningTime.openingTime || recordOrOpeningTime.sessionOpeningTime || recordOrOpeningTime.startTime)
    : normalizeAttendanceTime(recordOrOpeningTime);
  const closing = typeof recordOrOpeningTime === 'object'
    ? normalizeAttendanceTime(recordOrOpeningTime.closingTime || recordOrOpeningTime.sessionClosingTime || recordOrOpeningTime.endTime)
    : normalizeAttendanceTime(closingTime);
  return opening && closing ? `${opening} - ${closing}` : '';
}

export function recordMatchesAttendanceTimeRange(record = {}, openingTime = '', closingTime = '') {
  return formatAttendanceTimeRange(record) === formatAttendanceTimeRange(openingTime, closingTime);
}

export function buildAttendanceKey(entityId, dateText, subjectName = '', openingTime = '', closingTime = '') {
  return [
    entityId,
    dateText,
    subjectName,
    normalizeAttendanceTime(openingTime),
    normalizeAttendanceTime(closingTime),
  ].filter(Boolean).join('-');
}

export function getAttendanceMarkedAt(record = {}) {
  const timestamp = record.markedAtIso || record.createdAtIso || '';
  if (timestamp) {
    const parsed = new Date(timestamp);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const textDate = record.markedAtText || record.dateText || '';
  if (!textDate) return null;
  const parsedTextDate = new Date(textDate);
  return Number.isNaN(parsedTextDate.getTime()) ? null : parsedTextDate;
}

export function isAttendanceRecordEditable(record, now = new Date()) {
  if (!record) return true;
  const markedAt = getAttendanceMarkedAt(record);
  if (!markedAt) return true;
  const elapsedMs = now.getTime() - markedAt.getTime();
  return elapsedMs >= 0 && elapsedMs <= 24 * 60 * 60 * 1000;
}

export function relationMatchesEntity(record, entity) {
  return record.entityRecordId === entity.id || record.entityId === entity.studentId || record.entityId === entity.employeeId;
}

export function summarizeAttendance(records) {
  const total = records.length;
  const present = records.filter((record) => record.status === 'Present').length;
  const absent = records.filter((record) => record.status === 'Absent').length;
  const leave = records.filter((record) => record.status === 'Leave').length;
  const percentage = total ? Math.round((present / total) * 100) : 0;
  return { total, present, absent, leave, percentage };
}

export function buildReport(records, scope) {
  return records.reduce((acc, record) => {
    const key = scope === 'yearly' ? getYearKey(record.dateText) : scope === 'monthly' ? getMonthKey(record.dateText) : record.dateText;
    if (!acc[key]) acc[key] = [];
    acc[key].push(record);
    return acc;
  }, {});
}

export function buildSubjectReport(records = []) {
  return records.reduce((acc, record) => {
    const key = record.subjectName || record.subject;
    if (!key) return acc;
    if (!acc[key]) acc[key] = [];
    acc[key].push(record);
    return acc;
  }, {});
}

export function buildSemesterReport(records = []) {
  return records.reduce((acc, record) => {
    const key = record.semester || record.className || record.classKey;
    if (!key) return acc;
    if (!acc[key]) acc[key] = [];
    acc[key].push(record);
    return acc;
  }, {});
}
