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
    const key = record.subjectName || record.subject || 'General Attendance';
    if (!acc[key]) acc[key] = [];
    acc[key].push(record);
    return acc;
  }, {});
}
