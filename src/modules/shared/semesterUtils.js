export const CURRICULUM_SEMESTER_SUMMARY = {
  AOTT: {
    academicStructure: 'Yearly syllabus mapped to semesters',
    teachingSemesterCount: 6,
    totalSemesterCount: 8,
    internshipSemesterCount: 2,
  },
  MIT: {
    academicStructure: 'Yearly syllabus mapped to semesters',
    teachingSemesterCount: 6,
    totalSemesterCount: 8,
    internshipSemesterCount: 2,
  },
  MLT: {
    academicStructure: 'Yearly syllabus mapped to semesters',
    teachingSemesterCount: 6,
    totalSemesterCount: 8,
    internshipSemesterCount: 2,
  },
  BPT: {
    academicStructure: 'Yearly syllabus mapped to semesters',
    teachingSemesterCount: 8,
    totalSemesterCount: 8,
    internshipSemesterCount: 0,
  },
  BOT: {
    academicStructure: 'Semester syllabus',
    teachingSemesterCount: 8,
    totalSemesterCount: 8,
    internshipSemesterCount: 0,
  },
  BSCN: {
    academicStructure: 'Semester syllabus',
    teachingSemesterCount: 8,
    totalSemesterCount: 8,
    internshipSemesterCount: 0,
  },
};

const YEAR_WORDS = {
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
};

const ROMAN_SEMESTERS = {
  i: 1,
  ii: 2,
  iii: 3,
  iv: 4,
  v: 5,
  vi: 6,
  vii: 7,
  viii: 8,
};

export function getSemesterLabel(number) {
  return `Semester ${Number(number)}`;
}

export function getSemesterLabels(numbers = []) {
  return normalizeSemesterNumbers(numbers).map(getSemesterLabel);
}

export function normalizeSemesterNumbers(numbers = []) {
  return [...new Set(
    numbers
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0)
  )].sort((a, b) => a - b);
}

export function getSemesterNumbersForYear(yearNumber) {
  const normalized = Number(yearNumber);
  if (!Number.isInteger(normalized) || normalized < 1) return [];
  return [normalized * 2 - 1, normalized * 2];
}

export function parseSemesterNumber(value = '') {
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return 0;
  const digitMatch = normalized.match(/(?:semester|sem)\s*[-:]?\s*(\d+)/i) || normalized.match(/^(\d+)$/);
  if (digitMatch) return Number(digitMatch[1]);
  const romanMatch = normalized.match(/\b(i|ii|iii|iv|v|vi|vii|viii)\s+(?:semester|sem)\b/i);
  if (romanMatch) return ROMAN_SEMESTERS[romanMatch[1].toLowerCase()] || 0;
  const wordMatch = normalized.match(/\b(first|second|third|fourth|fifth|sixth|seventh|eighth)\s+(?:semester|sem)\b/i);
  const wordMap = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8 };
  return wordMatch ? wordMap[wordMatch[1].toLowerCase()] || 0 : 0;
}

export function parseYearNumber(value = '') {
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return 0;
  const digitMatch = normalized.match(/(\d+)\s*(?:st|nd|rd|th)?\s*year/);
  if (digitMatch) return Number(digitMatch[1]);
  const romanMatch = normalized.match(/\b(i|ii|iii|iv)\s*b\.?\s*sc|\b(i|ii|iii|iv)\s+b\s*sc|\b(i|ii|iii|iv)\s+year/);
  if (romanMatch) return ROMAN_SEMESTERS[(romanMatch[1] || romanMatch[2] || romanMatch[3]).toLowerCase()] || 0;
  const wordMatch = normalized.match(/\b(first|second|third|fourth)\s+year\b/);
  return wordMatch ? YEAR_WORDS[wordMatch[1].toLowerCase()] || 0 : 0;
}

export function getSemesterNumbersForAcademicRecord(record = {}) {
  const directNumbers = normalizeSemesterNumbers(record.semesterNumbers || []);
  if (directNumbers.length) return directNumbers;

  const directNumber = Number(record.semesterNumber || 0) || parseSemesterNumber(record.semester || record.semesterLabel || record.curriculumPeriod);
  if (directNumber) return [directNumber];

  const yearNumber = Number(record.yearNumber || 0) ||
    parseYearNumber(record.courseYear || record.yearLabel || record.className || record.curriculumPeriod || record.classKey);
  return getSemesterNumbersForYear(yearNumber);
}

export function getSemesterNumbersForStudent(student = {}) {
  return getSemesterNumbersForAcademicRecord(student);
}

export function getSemesterDisplayForRecord(record = {}) {
  const labels = getSemesterLabels(getSemesterNumbersForAcademicRecord(record));
  return labels.length ? labels.join(' / ') : '';
}

export function recordMatchesSemester(record = {}, selectedSemester = '') {
  const selectedNumber = parseSemesterNumber(selectedSemester);
  if (!selectedNumber) return true;
  return getSemesterNumbersForAcademicRecord(record).includes(selectedNumber);
}

export function buildSemesterOptions(records = []) {
  const numbers = records.flatMap(getSemesterNumbersForAcademicRecord);
  return normalizeSemesterNumbers(numbers).map((number) => ({
    number,
    value: getSemesterLabel(number),
    label: getSemesterLabel(number),
  }));
}
