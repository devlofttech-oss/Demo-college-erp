export const ACADEMIC_DEPARTMENTS = {
  nursing: 'Nursing',
  alliedHealth: 'Allied Health Sciences',
  physiotherapy: 'Physiotherapy',
};

const DEPARTMENT_ALIASES = [
  { department: ACADEMIC_DEPARTMENTS.nursing, terms: ['nursing', 'bsc nursing', 'b.sc nursing', 'bscn'] },
  { department: ACADEMIC_DEPARTMENTS.physiotherapy, terms: ['physiotherapy', 'physio', 'bpt'] },
  {
    department: ACADEMIC_DEPARTMENTS.alliedHealth,
    terms: [
      'allied health',
      'medical imaging',
      'imaging technology',
      'medical laboratory',
      'mlt',
      'anaesthesia',
      'anesthesia',
      'operation theater',
      'operation theatre',
      'occupational therapy',
      'bot',
      'mit',
      'atot',
      'aott',
    ],
  },
];

const COURSE_CODE_DEPARTMENTS = [
  { prefix: 'BSCN', department: ACADEMIC_DEPARTMENTS.nursing },
  { prefix: 'BPT', department: ACADEMIC_DEPARTMENTS.physiotherapy },
  { prefix: 'BOT', department: ACADEMIC_DEPARTMENTS.alliedHealth },
  { prefix: 'MIT', department: ACADEMIC_DEPARTMENTS.alliedHealth },
  { prefix: 'MLT', department: ACADEMIC_DEPARTMENTS.alliedHealth },
  { prefix: 'ATOT', department: ACADEMIC_DEPARTMENTS.alliedHealth },
  { prefix: 'AOTT', department: ACADEMIC_DEPARTMENTS.alliedHealth },
];

function normalize(value = '') {
  return String(value || '').trim().toLowerCase();
}

export function normalizeAcademicDepartment(value = '') {
  const normalized = normalize(value);
  if (!normalized) return '';
  const exact = Object.values(ACADEMIC_DEPARTMENTS).find((department) => normalize(department) === normalized);
  if (exact) return exact;
  return DEPARTMENT_ALIASES.find(({ terms }) => terms.some((term) => normalized.includes(term)))?.department || '';
}

export function getDepartmentForAcademicRecord(record = {}) {
  const explicitDepartment = normalizeAcademicDepartment(record.department || record.departmentName);
  if (explicitDepartment) return explicitDepartment;

  const courseCode = String(record.courseCode || record.programCode || record.code || '').trim().toUpperCase();
  const codeDepartment = COURSE_CODE_DEPARTMENTS.find(({ prefix }) => courseCode.startsWith(prefix))?.department;
  if (codeDepartment) return codeDepartment;

  const searchableText = [
    record.courseName,
    record.program,
    record.programName,
    record.className,
    record.classKey,
    record.collegeName,
    record.name,
  ].filter(Boolean).join(' ');
  return normalizeAcademicDepartment(searchableText);
}
