export function formatDisplayDate(date = new Date()) {
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatAttendanceDateInput(inputDate = '') {
  const normalized = String(inputDate || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return '';
  const parsed = new Date(`${normalized}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? '' : formatDisplayDate(parsed);
}

export function getAttendanceReportDateText(record = {}) {
  const dateText = String(record.dateText || '').trim();
  if (dateText) return dateText;

  const inputDateText = formatAttendanceDateInput(record.dateInput || record.attendanceDate || record.date);
  if (inputDateText) return inputDateText;

  const markedAtText = String(record.markedAtText || '').trim();
  if (markedAtText) return markedAtText;

  const timestamp = record.markedAtIso || record.createdAtIso || '';
  if (timestamp) {
    const parsed = new Date(timestamp);
    if (!Number.isNaN(parsed.getTime())) return formatDisplayDate(parsed);
  }

  return 'Unspecified date';
}

const DISPLAY_MONTH_INPUTS = {
  Jan: '01',
  Feb: '02',
  Mar: '03',
  Apr: '04',
  May: '05',
  Jun: '06',
  Jul: '07',
  Aug: '08',
  Sep: '09',
  Sept: '09',
  Oct: '10',
  Nov: '11',
  Dec: '12',
};

export function getLocalDateInput(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

// Resolves a record to a sortable YYYY-MM-DD key. Records store a display date
// ("01 Sep 2026"), so reports that need chronological order must go through this
// rather than sorting the display text.
export function getAttendanceDateInput(record = {}) {
  const directDate = String(record.dateInput || record.attendanceDate || record.date || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(directDate)) return directDate;

  const dateText = getAttendanceReportDateText(record);
  const displayMatch = /^(\d{1,2})\s+([A-Za-z]{3,4})\s+(\d{4})$/.exec(dateText);
  if (displayMatch) {
    const [, day, month, year] = displayMatch;
    const monthInput = DISPLAY_MONTH_INPUTS[month];
    if (monthInput) return `${year}-${monthInput}-${String(day).padStart(2, '0')}`;
  }

  const timestamp = record.markedAtIso || record.createdAtIso || '';
  return timestamp ? getLocalDateInput(new Date(timestamp)) : '';
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

// Times are stored as canonical 24-hour "HH:MM" but always shown as 12-hour with a
// meridiem, so every display path goes through this rather than printing the raw value.
export function formatAttendanceTime12Hour(value = '') {
  const normalized = normalizeAttendanceTime(value);
  if (!normalized) return '';
  const [hours, minutes] = normalized.split(':').map(Number);
  const meridiem = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${String(hours12).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${meridiem}`;
}

export function splitAttendanceTimeParts(value = '') {
  const normalized = normalizeAttendanceTime(value);
  if (!normalized) return { hour: '', minute: '', meridiem: '' };
  const [hours, minutes] = normalized.split(':').map(Number);
  return {
    hour: String(hours % 12 === 0 ? 12 : hours % 12).padStart(2, '0'),
    minute: String(minutes).padStart(2, '0'),
    meridiem: hours >= 12 ? 'PM' : 'AM',
  };
}

export function joinAttendanceTimeParts({ hour = '', minute = '', meridiem = '' } = {}) {
  if (!hour || !minute || !meridiem) return '';
  const hours12 = Number(hour) % 12;
  const hours24 = meridiem === 'PM' ? hours12 + 12 : hours12;
  return normalizeAttendanceTime(`${String(hours24).padStart(2, '0')}:${minute}`);
}

export function formatAttendanceTimeRange(recordOrOpeningTime = '', closingTime = '') {
  const opening = typeof recordOrOpeningTime === 'object'
    ? normalizeAttendanceTime(recordOrOpeningTime.openingTime || recordOrOpeningTime.sessionOpeningTime || recordOrOpeningTime.startTime)
    : normalizeAttendanceTime(recordOrOpeningTime);
  const closing = typeof recordOrOpeningTime === 'object'
    ? normalizeAttendanceTime(recordOrOpeningTime.closingTime || recordOrOpeningTime.sessionClosingTime || recordOrOpeningTime.endTime)
    : normalizeAttendanceTime(closingTime);
  return opening && closing ? `${formatAttendanceTime12Hour(opening)} - ${formatAttendanceTime12Hour(closing)}` : '';
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

export function mergeAttendanceRecords(existingRecords = [], savedRecords = []) {
  const normalizedSavedRecords = savedRecords.filter((record) => record?.id);
  if (!normalizedSavedRecords.length) return existingRecords;
  const savedById = new Map(normalizedSavedRecords.map((record) => [record.id, record]));
  const existingIds = new Set(existingRecords.map((record) => record.id).filter(Boolean));
  const createdRecords = normalizedSavedRecords.filter((record) => !existingIds.has(record.id));
  return [
    ...createdRecords,
    ...existingRecords.map((record) => savedById.get(record.id) || record),
  ];
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

export const ATTENDANCE_STATUSES = ['Present', 'Absent', 'Late', 'Leave'];

export function normalizeAttendanceStatus(value = '') {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  const lowered = trimmed.toLowerCase();
  if (lowered === 'on leave') return 'Leave';
  return ATTENDANCE_STATUSES.find((status) => status.toLowerCase() === lowered) || trimmed;
}

export function summarizeAttendance(records = []) {
  const counts = records.reduce((acc, record) => {
    const status = normalizeAttendanceStatus(record.status);
    if (status === 'Present') acc.present += 1;
    else if (status === 'Absent') acc.absent += 1;
    else if (status === 'Late') acc.late += 1;
    else if (status === 'Leave') acc.leave += 1;
    return acc;
  }, { present: 0, absent: 0, late: 0, leave: 0 });
  const total = records.length;
  // `percentage` stays present-only so existing screens keep their meaning; `attended`
  // folds late arrivals in for reports that treat a late student as having attended.
  const attended = counts.present + counts.late;
  const percentage = total ? Math.round((counts.present / total) * 100) : 0;
  const attendedPercentage = total ? Math.round((attended / total) * 100) : 0;
  return { total, ...counts, attended, percentage, attendedPercentage };
}

export function buildReport(records, scope) {
  return records.reduce((acc, record) => {
    const dateText = getAttendanceReportDateText(record);
    const key = scope === 'yearly' ? getYearKey(dateText) : scope === 'monthly' ? getMonthKey(dateText) : dateText;
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

const UNASSIGNED_SUBJECT = 'Unassigned Subject';
const UNASSIGNED_FACULTY = 'Unassigned Faculty';
const UNASSIGNED_CLASS = 'Unassigned Class';
const UNASSIGNED_DEPARTMENT = 'Unassigned Department';
const UNASSIGNED_PERIOD = 'No Period Set';

export function getAttendanceSubjectLabel(record = {}) {
  const subject = String(record.subjectName || record.subject || '').trim();
  if (subject) return subject;
  return record.attendanceScope === 'general' ? 'General Attendance' : UNASSIGNED_SUBJECT;
}

export function getAttendanceFacultyLabel(record = {}) {
  return String(record.facultyName || '').trim() || UNASSIGNED_FACULTY;
}

export function getAttendancePeriodLabel(record = {}) {
  return formatAttendanceTimeRange(record) || String(record.timeRange || '').trim() || UNASSIGNED_PERIOD;
}

export function getAttendanceClassLabel(record = {}) {
  const base = String(record.semester || record.className || record.classKey || '').trim() || UNASSIGNED_CLASS;
  const section = String(record.section || '').trim();
  return section ? `${base} - ${section}` : base;
}

export function getAttendanceDepartmentLabel(record = {}) {
  return String(record.department || record.departmentName || '').trim() || UNASSIGNED_DEPARTMENT;
}

export function getAttendanceStudentLabel(record = {}) {
  return String(record.entityName || record.studentName || record.name || '').trim() || 'Unknown Student';
}

export function getAttendanceStudentId(record = {}) {
  return String(record.entityId || record.studentId || record.admissionNo || '').trim();
}

export function getAttendanceStudentKey(record = {}) {
  return String(
    record.studentRecordId || record.entityRecordId || getAttendanceStudentId(record) || getAttendanceStudentLabel(record)
  );
}

export function getAttendanceTimeRanges(records = []) {
  return [...new Set(records.map((record) => formatAttendanceTimeRange(record)).filter(Boolean))];
}

export function groupAttendanceRecords(records = [], getKey) {
  return records.reduce((acc, record) => {
    const key = getKey(record);
    if (!key) return acc;
    if (!acc[key]) acc[key] = [];
    acc[key].push(record);
    return acc;
  }, {});
}

// Groups records by `getKey` and folds each group into one summary row. `getMeta`
// receives the group's records so a view can carry extra columns (faculty, ids,
// counts of distinct sessions) alongside the present/absent/late totals.
export function buildAttendanceGroupRows(records = [], { getKey, getMeta, sortBy = 'label' } = {}) {
  const grouped = groupAttendanceRecords(records, getKey);
  const rows = Object.entries(grouped).map(([label, items]) => ({
    label,
    records: items,
    timeRanges: getAttendanceTimeRanges(items),
    ...(typeof getMeta === 'function' ? getMeta(items, label) : {}),
    ...summarizeAttendance(items),
  }));
  return sortAttendanceGroupRows(rows, sortBy);
}

export function sortAttendanceGroupRows(rows = [], sortBy = 'label') {
  const sorted = [...rows];
  if (sortBy === 'percentage') {
    sorted.sort((first, second) => first.percentage - second.percentage || first.label.localeCompare(second.label));
  } else if (sortBy === 'date-desc') {
    // Newest period first, then alphabetically within the period. Sorting on the
    // display label would order "02 Aug" above "01 Sep", hence the sortKey.
    sorted.sort((first, second) => (
      String(second.sortKey || '').localeCompare(String(first.sortKey || ''))
      || String(first.label).localeCompare(String(second.label))
    ));
  } else {
    sorted.sort((first, second) => String(first.label).localeCompare(String(second.label)));
  }
  return sorted;
}

export function buildSubjectFacultyRows(records = []) {
  return buildAttendanceGroupRows(records, {
    getKey: (record) => `${getAttendanceSubjectLabel(record)}||${getAttendanceFacultyLabel(record)}`,
    getMeta: (items, key) => {
      const [subject, faculty] = key.split('||');
      return {
        subject,
        faculty,
        label: `${subject} - ${faculty}`,
        periods: [...new Set(items.map(getAttendancePeriodLabel))],
        sessions: new Set(items.map((item) => item.sessionId || `${getAttendanceReportDateText(item)}|${getAttendancePeriodLabel(item)}`)).size,
      };
    },
  });
}

export function buildStudentAttendanceRows(records = []) {
  return buildAttendanceGroupRows(records, {
    getKey: getAttendanceStudentKey,
    getMeta: (items) => {
      const first = items[0] || {};
      return {
        label: getAttendanceStudentLabel(first),
        studentId: getAttendanceStudentId(first),
        classLabel: getAttendanceClassLabel(first),
        department: getAttendanceDepartmentLabel(first),
        subjects: [...new Set(items.map(getAttendanceSubjectLabel))],
      };
    },
    sortBy: 'percentage',
  });
}

export function buildDailySummaryRows(records = [], groupBy = 'class') {
  const getGroupLabel = groupBy === 'period' ? getAttendancePeriodLabel : getAttendanceClassLabel;
  return buildAttendanceGroupRows(records, {
    getKey: (record) => `${getAttendanceReportDateText(record)}||${getGroupLabel(record)}`,
    getMeta: (items, key) => {
      const [dateText, groupLabel] = key.split('||');
      return {
        dateText,
        groupLabel,
        label: `${dateText} - ${groupLabel}`,
        sortKey: getAttendanceDateInput(items[0] || {}),
        subjects: [...new Set(items.map(getAttendanceSubjectLabel))],
      };
    },
    sortBy: 'date-desc',
  });
}

export function buildConsolidatedRows(records = [], { period = 'monthly', dimension = 'department' } = {}) {
  const getPeriodLabel = period === 'yearly'
    ? (record) => getYearKey(getAttendanceReportDateText(record))
    : (record) => getMonthKey(getAttendanceReportDateText(record));
  const dimensionLabellers = {
    class: getAttendanceClassLabel,
    department: getAttendanceDepartmentLabel,
    semester: (record) => String(record.semester || record.className || record.classKey || '').trim() || UNASSIGNED_CLASS,
    subject: getAttendanceSubjectLabel,
  };
  const getDimensionLabel = dimensionLabellers[dimension] || getAttendanceDepartmentLabel;
  return buildAttendanceGroupRows(records, {
    getKey: (record) => `${getPeriodLabel(record)}||${getDimensionLabel(record)}`,
    getMeta: (items, key) => {
      const [periodLabel, dimensionLabel] = key.split('||');
      const dateInput = getAttendanceDateInput(items[0] || {});
      return {
        periodLabel,
        dimensionLabel,
        label: `${periodLabel} - ${dimensionLabel}`,
        sortKey: period === 'yearly' ? dateInput.slice(0, 4) : dateInput.slice(0, 7),
        students: new Set(items.map(getAttendanceStudentKey)).size,
      };
    },
    sortBy: 'date-desc',
  });
}
