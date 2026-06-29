export const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const timeSlots = [
  '09:00 - 10:00',
  '10:00 - 11:00',
  '11:00 - 12:00',
  '11:15 - 12:15',
  '12:00 - 01:00',
  '12:15 - 01:15',
  '01:00 - 02:00',
  '02:00 - 03:00',
  '03:00 - 04:00',
  '04:00 - 05:00',
];

function parseTimePart(value = '') {
  const match = String(value).trim().match(/^(\d{1,2})(?::?(\d{2}))?\s*(am|pm)?$/i);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2] || 0);
  const meridiem = match[3]?.toLowerCase();
  if (meridiem === 'pm' && hours < 12) hours += 12;
  if (meridiem === 'am' && hours === 12) hours = 0;
  if (!meridiem && hours >= 1 && hours <= 5) hours += 12;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function parseTimeSlot(timeSlot = '') {
  const [start = '', end = ''] = String(timeSlot).split(/\s*-\s*/);
  return {
    startTime: parseTimePart(start) || '',
    endTime: parseTimePart(end) || '',
  };
}

function timeToMinutes(value = '') {
  const parsed = parseTimePart(value);
  if (!parsed) return Number.MAX_SAFE_INTEGER;
  const [hours, minutes] = parsed.split(':').map(Number);
  return hours * 60 + minutes;
}

export function getTimeSlotLabel(entry = {}) {
  if (entry.timeSlot) return entry.timeSlot;
  if (entry.startTime && entry.endTime) return `${entry.startTime} - ${entry.endTime}`;
  return '';
}

export function normalizeTimeSlotFields(entry = {}) {
  const parsed = parseTimeSlot(entry.timeSlot);
  return {
    ...entry,
    timeSlot: getTimeSlotLabel(entry),
    startTime: entry.startTime || parsed.startTime,
    endTime: entry.endTime || parsed.endTime,
  };
}

export function getTimeSlotOptions(entries = [], { includeArchived = false } = {}) {
  const options = new Map();
  entries
    .filter((entry) => includeArchived || entry.status !== 'Archived')
    .map(normalizeTimeSlotFields)
    .forEach((entry) => {
      const label = getTimeSlotLabel(entry);
      if (!label) return;
      options.set(label, {
        label,
        startTime: entry.startTime,
        endTime: entry.endTime,
      });
    });
  return [...options.values()].sort((a, b) => (
    timeToMinutes(a.startTime || a.label.split('-')[0]) - timeToMinutes(b.startTime || b.label.split('-')[0])
  ));
}

export function formatDisplayDate(date = new Date()) {
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function getClassKey(student) {
  return `${student.className} - ${student.section}`;
}

export function getClassOptions(students) {
  return [...new Set(students.filter((student) => student.status !== 'Archived').map(getClassKey))].sort();
}

export function filterTimetableEntriesByCourse(entries = [], selectedCourseCode = 'all', courseCodes = []) {
  if (!selectedCourseCode || selectedCourseCode === 'all') {
    const scopedCodes = new Set(courseCodes.filter(Boolean));
    return scopedCodes.size ? entries.filter((entry) => scopedCodes.has(entry.courseCode)) : entries;
  }
  return entries.filter((entry) => entry.courseCode === selectedCourseCode);
}

export function hasTimetableConflict(entries, candidate, ignoreId = '') {
  const candidateSlot = getTimeSlotLabel(candidate);
  return entries.some((entry) => {
    if (entry.id === ignoreId || entry.status === 'Archived') return false;
    const sameSlot = entry.day === candidate.day && getTimeSlotLabel(entry) === candidateSlot;
    if (!sameSlot) return false;
    return entry.classKey === candidate.classKey || entry.facultyId === candidate.facultyId || entry.classroomId === candidate.classroomId;
  });
}

export function validateTimetableEntry(form) {
  const requiredFields = [
    ['classKey', 'Class'],
    ['subject', 'Subject'],
    ['facultyId', 'Faculty'],
    ['classroomId', 'Classroom'],
    ['day', 'Day'],
    ['timeSlot', 'Time slot'],
  ];
  const missing = requiredFields.find(([key]) => !String(form[key] || '').trim());
  return missing ? `${missing[1]} is required.` : '';
}
