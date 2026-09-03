function normalizeIdentity(value = '') {
  return String(value || '').trim().toLowerCase();
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

// Faculty may mark attendance for any department, branch or semester. The profile is
// still resolved so the marking screen can pre-select the signed-in teacher, but it
// no longer narrows which students or faculty options are available.
export function getFacultyAttendanceAccess(currentUser = {}, staff = []) {
  const isFaculty = currentUser?.roleId === 'faculty';
  return {
    isFacultyRestricted: false,
    canMarkStudents: true,
    department: '',
    faculty: isFaculty ? resolveAttendanceFacultyProfile(currentUser, staff) : null,
    message: '',
  };
}

export function filterStudentsByFacultyAttendanceAccess(students = []) {
  return students;
}

export function filterAttendanceFacultyOptions(options = []) {
  return options;
}

export function canMarkStudentAttendanceForEntity() {
  return true;
}
