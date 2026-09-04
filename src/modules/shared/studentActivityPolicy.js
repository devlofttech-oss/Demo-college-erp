// Students suppressed from active rosters regardless of their stored status.
// BSCN-033, BSCN-034 and BSCN-035 were removed from this list: all three are on the
// current roster and were being hidden from every screen.
// BSCN-D001 and BSCN-D002 stay suppressed. Angel Shaji Daniel is stored three times
// - BSCN-002, BSCN-D001 and BSCN-D002, all with the same date of birth and parent -
// so BSCN-002 is the copy that shows and the two "D" copies stay hidden. Neither
// carries attendance, fee or document records of its own.
export const INACTIVE_STUDENT_IDS = ['BSCN-D001', 'BSCN-D002'];

export const INACTIVE_STUDENT_RECORD_IDS = ['seed-student-bscn-d001', 'seed-student-bscn-d002'];

const inactiveStudentIds = new Set(INACTIVE_STUDENT_IDS.map((value) => value.toUpperCase()));
const inactiveStudentRecordIds = new Set(INACTIVE_STUDENT_RECORD_IDS.map((value) => value.toLowerCase()));

function normalizeStudentId(value = '') {
  return String(value || '').trim().toUpperCase();
}

function normalizeRecordId(value = '') {
  return String(value || '').trim().toLowerCase();
}

export function isInactiveStudentOverride(record = {}) {
  const studentIds = [
    record.studentId,
    record.entityId,
    record.ownerId,
    record.displayId,
  ].map(normalizeStudentId).filter(Boolean);
  const recordIds = [
    record.id,
    record.studentRecordId,
    record.entityRecordId,
    record.ownerRecordId,
  ].map(normalizeRecordId).filter(Boolean);
  return (
    studentIds.some((studentId) => inactiveStudentIds.has(studentId)) ||
    recordIds.some((recordId) => inactiveStudentRecordIds.has(recordId))
  );
}

export function applyStudentActivityOverrides(students = []) {
  return students.map((student) => (
    isInactiveStudentOverride(student)
      ? {
        ...student,
        status: 'Archived',
        archivedAtText: student.archivedAtText || '05 Aug 2026',
        archiveReason: student.archiveReason || 'Removed from active roster by administrative request',
      }
      : student
  ));
}

export function isActiveStudentRecord(student = {}) {
  return student.status !== 'Archived' && !isInactiveStudentOverride(student);
}
