export function relationMatches(record, student) {
  if (!record || !student) return false;
  return record.studentRecordId === student.id || record.studentId === student.studentId;
}

export function latestRecord(records) {
  return records[records.length - 1] || null;
}

export function formatDisplayDate(date = new Date()) {
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function validateStudentProfile(form) {
  const requiredFields = [
    ['name', 'Student name'],
    ['guardianName', 'Guardian name'],
    ['idHolder', 'ID holder'],
    ['phone', 'Phone'],
    ['className', 'Class'],
    ['section', 'Section'],
    ['program', 'Program'],
    ['academicYear', 'Academic year'],
  ];

  const missing = requiredFields.find(([key]) => !String(form[key] || '').trim());
  if (missing) return `${missing[1]} is required.`;

  if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    return 'Enter a valid email address.';
  }

  if (!/^[0-9+\-\s()]{7,20}$/.test(form.phone)) {
    return 'Enter a valid phone number.';
  }

  return '';
}

export function getNextClassName(className = '') {
  if (className.includes('XII')) return className;
  if (className.includes('XI')) return className.replace('XI', 'XII');
  if (className.includes('X')) return className.replace('X', 'XI');
  return className;
}
