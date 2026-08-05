import { ACADEMIC_DEPARTMENTS, getDepartmentForAcademicRecord } from '../shared/academicDepartments.js';

export const ATTENDANCE_MARKING_FACULTY_BY_DEPARTMENT = {
  [ACADEMIC_DEPARTMENTS.nursing]: ['anusha', 'chandana', 'chaitra'],
  [ACADEMIC_DEPARTMENTS.alliedHealth]: ['deepa', 'tejas', 'shreya'],
  [ACADEMIC_DEPARTMENTS.physiotherapy]: ['priyanka'],
};

function normalizeIdentity(value = '') {
  return String(value || '').trim().toLowerCase();
}

function normalizeName(value = '') {
  return String(value || '').trim().toLowerCase().replace(/[^a-z]+/g, '');
}

function facultyIdentityValues(faculty = {}) {
  return [
    faculty.id,
    faculty.uid,
    faculty.sourceRecordId,
    faculty.staffRecordId,
    faculty.recordId,
    faculty.employeeId,
    faculty.facultyId,
    faculty.displayId,
    faculty.email,
    faculty.authEmail,
    faculty.name,
    faculty.displayName,
  ].map(normalizeIdentity).filter(Boolean);
}

function facultyNameValues(faculty = {}) {
  return [
    faculty.name,
    faculty.displayName,
    faculty.email,
    faculty.authEmail,
  ].map(normalizeName).filter(Boolean);
}

export function isAllowedDepartmentAttendanceFaculty(faculty = {}, department = '') {
  const normalizedDepartment = getDepartmentForAcademicRecord({ department }) || department;
  const allowedNames = ATTENDANCE_MARKING_FACULTY_BY_DEPARTMENT[normalizedDepartment] || [];
  if (!allowedNames.length) return false;
  const searchableNames = facultyNameValues(faculty);
  return allowedNames.some((allowedName) =>
    searchableNames.some((facultyName) => facultyName.includes(normalizeName(allowedName)))
  );
}

export function optionMatchesAttendanceFaculty(option = {}, faculty = {}) {
  const optionValues = new Set(facultyIdentityValues(option));
  const facultyValues = facultyIdentityValues(faculty);
  return facultyValues.some((value) => optionValues.has(value));
}

export function resolveAttendanceFacultyProfile(currentUser = {}, staff = []) {
  const userValues = new Set(facultyIdentityValues(currentUser));
  const matchedStaff = staff.find((member) =>
    facultyIdentityValues(member).some((value) => userValues.has(value))
  );
  if (matchedStaff) return matchedStaff;
  return {
    id: currentUser.staffRecordId || currentUser.sourceRecordId || currentUser.uid || currentUser.email || '',
    employeeId: currentUser.employeeId || currentUser.displayId || '',
    name: currentUser.name || currentUser.displayName || currentUser.email || '',
    department: currentUser.department || '',
    email: currentUser.email || '',
  };
}

export function getFacultyAttendanceAccess(currentUser = {}, staff = []) {
  if (currentUser?.roleId !== 'faculty') {
    return {
      isFacultyRestricted: false,
      canMarkStudents: true,
      department: '',
      faculty: null,
      message: '',
    };
  }

  const faculty = resolveAttendanceFacultyProfile(currentUser, staff);
  const department = getDepartmentForAcademicRecord(faculty);
  const canMarkStudents = Boolean(department && isAllowedDepartmentAttendanceFaculty(faculty, department));
  return {
    isFacultyRestricted: true,
    canMarkStudents,
    department: canMarkStudents ? department : '',
    faculty,
    message: canMarkStudents
      ? `${department} attendance access`
      : 'Only assigned department faculty can mark student attendance.',
  };
}

export function filterStudentsByFacultyAttendanceAccess(students = [], access = {}) {
  if (!access.isFacultyRestricted) return students;
  if (!access.canMarkStudents || !access.department) return [];
  return students.filter((student) => getDepartmentForAcademicRecord(student) === access.department);
}

export function filterAttendanceFacultyOptions(options = [], access = {}) {
  if (!access.isFacultyRestricted) return options;
  if (!access.canMarkStudents || !access.faculty) return [];
  const filteredOptions = options.filter((option) =>
    optionMatchesAttendanceFaculty(option, access.faculty) &&
    isAllowedDepartmentAttendanceFaculty(option, access.department || getDepartmentForAcademicRecord(option))
  );
  if (filteredOptions.length) return filteredOptions;
  return [{
    id: access.faculty.id || access.faculty.sourceRecordId || access.faculty.employeeId || access.faculty.name,
    employeeId: access.faculty.employeeId || access.faculty.displayId || '',
    name: access.faculty.name || access.faculty.displayName || 'Assigned Faculty',
    department: access.department,
  }];
}

export function canMarkStudentAttendanceForEntity(entity = {}, access = {}) {
  if (!access.isFacultyRestricted) return true;
  return Boolean(
    access.canMarkStudents &&
    access.department &&
    getDepartmentForAcademicRecord(entity) === access.department
  );
}
