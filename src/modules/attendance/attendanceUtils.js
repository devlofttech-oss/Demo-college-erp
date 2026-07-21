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

export function buildAttendanceKey(entityId, dateText, subjectName = '') {
  return [entityId, dateText, subjectName].filter(Boolean).join('-');
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
