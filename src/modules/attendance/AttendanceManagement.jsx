import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, CheckCircle, Search, UserCheck, Users, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  createStudentAttendanceRecord,
  createStaffAttendanceRecord,
  getAttendanceManagementData,
  updateStaffAttendanceRecord,
  updateStudentAttendanceRecord,
} from '../../firebase/db';
import { isFirebaseConfigured } from '../../firebase/config';
import { canAccess, defaultRoles } from '../userRoles/rolePermissions';
import {
  buildAttendanceKey,
  formatAttendanceDateInput,
  formatAttendanceTimeRange,
  formatDisplayDate,
  getAttendanceReportDateText,
  isAttendanceTimeRangeValid,
  isAttendanceRecordEditable,
  mergeAttendanceRecords,
  normalizeAttendanceTime,
  recordMatchesAttendanceTimeRange,
  summarizeAttendance,
} from './attendanceUtils';
import AttendanceTable from './components/AttendanceTable';
import { demoStaffMembers } from '../facultyStaff/demoFacultyStaff';
import { filterStudentScopedRecords, filterStudentsByCourse } from '../shared/courseFilters';
import {
  buildSemesterOptions,
  getSemesterDisplayForRecord,
  getSemesterLabels,
  getSemesterNumbersForAcademicRecord,
  getSemesterNumbersForStudent,
  parseSemesterNumber,
  recordMatchesSemester,
} from '../shared/semesterUtils';

function getTodayInputValue() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getStudentSemester(student = {}) {
  return getSemesterDisplayForRecord(student) || student.semester || student.courseYear || student.yearLabel || student.className || '';
}

function getStudentAttendanceScope(branchId = '', fallback = 'subject') {
  if (branchId === 'mark-general-students') return 'general';
  if (branchId === 'mark-students' || branchId === 'mark-subject-students') return 'subject';
  return fallback;
}

function getSubjectTopics(subject = {}) {
  const rawTopics = Array.isArray(subject.topics) ? subject.topics : [];
  return [...new Set(rawTopics.map((item) => String(item).trim()).filter(Boolean))];
}

const EMPTY_TOPIC_SUGGESTIONS = [];

function normalizeTeacherKey(value = '') {
  return String(value || '').trim().toLowerCase();
}

function isTeacherStaffRecord(member = {}) {
  const type = normalizeTeacherKey(member.staffType || member.role || member.designation);
  if (!type) return true;
  return type.includes('faculty') || type.includes('teacher') || type.includes('teaching');
}

function buildTeacherOptionId(prefix, index, name = '') {
  return `${prefix}-${index}-${normalizeTeacherKey(name).replace(/[^a-z0-9]+/g, '-') || 'teacher'}`;
}

function addTeacherOption(map, option = {}) {
  const name = String(option.name || option.facultyName || '').trim();
  if (!name) return;
  const identity = normalizeTeacherKey(option.id || option.employeeId || option.facultyId || option.facultyRecordId || name);
  const nameKey = normalizeTeacherKey(name);
  if (map.has(identity) || map.has(nameKey)) return;
  const normalized = {
    id: option.id || option.facultyRecordId || option.facultyId || name,
    employeeId: option.employeeId || option.facultyId || '',
    name,
  };
  map.set(identity, normalized);
  map.set(nameKey, normalized);
}

function addCurrentUserTeacherOption(map, currentUser = {}) {
  if (!currentUser?.name && !currentUser?.displayName && !currentUser?.email) return;
  addTeacherOption(map, {
    id: currentUser.staffRecordId || currentUser.uid || currentUser.employeeId || currentUser.email || 'current-faculty',
    employeeId: currentUser.employeeId || currentUser.displayId || '',
    name: currentUser.name || currentUser.displayName || currentUser.email,
  });
}

export default function AttendanceManagement({
  currentUser,
  academicYear = '',
  initialBranch = '',
  initialMode = 'students',
  initialTask = '',
  onAttendanceSaved,
  scopedStudents = [],
  selectedCourse = null,
  selectedCourseCode = 'all',
}) {
  const [students, setStudents] = useState([]);
  const [staff, setStaff] = useState([]);
  const [studentAttendance, setStudentAttendance] = useState([]);
  const [staffAttendance, setStaffAttendance] = useState([]);
  const [academicSubjects, setAcademicSubjects] = useState([]);
  const [timetableEntries, setTimetableEntries] = useState([]);
  const [mode, setMode] = useState(initialMode || 'students');
  const [selectedSubjectCode, setSelectedSubjectCode] = useState('');
  const [search, setSearch] = useState('');
  const [selectedDateInput, setSelectedDateInput] = useState(getTodayInputValue);
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [loadError, setLoadError] = useState('');
  const [activeAttendanceTask, setActiveAttendanceTask] = useState(initialTask || '');
  const [activeAttendanceBranch, setActiveAttendanceBranch] = useState(initialBranch || '');
  const [studentAttendanceScope, setStudentAttendanceScope] = useState(getStudentAttendanceScope(initialBranch, 'subject'));
  const [selectedEntityId, setSelectedEntityId] = useState('');
  const [selectedSemester, setSelectedSemester] = useState('');
  const [selectedFacultyId, setSelectedFacultyId] = useState('');
  const [openingTime, setOpeningTime] = useState('');
  const [closingTime, setClosingTime] = useState('');
  const [topic, setTopic] = useState('');
  const [draftAttendance, setDraftAttendance] = useState({ contextKey: '', statuses: {} });
  const [savingDraft, setSavingDraft] = useState(false);

  useEffect(() => {
    const loadAttendance = async () => {
      if (!isFirebaseConfigured) {
        setLoadError('Live Firebase data is not configured.');
        setLoading(false);
        return;
      }
      try {
        const data = await getAttendanceManagementData(academicYear);
        setStudents(data.students.filter((student) => student.status !== 'Archived'));
        setStaff(data.staff.filter((member) => member.status !== 'Archived'));
        setStudentAttendance(data.studentAttendance);
        setStaffAttendance(data.staffAttendance);
        setAcademicSubjects(data.academicSubjects || []);
        setTimetableEntries(data.timetableEntries || []);
        setLoadError('');
      } catch (error) {
        console.warn('Unable to load live attendance data.', error);
        setLoadError('Unable to load live attendance records.');
      } finally {
        setLoading(false);
      }
    };
    loadAttendance();
  }, [academicYear]);

  useEffect(() => {
    const currentState = window.history.state || {};
    window.history.replaceState({
      ...currentState,
      attendanceFlow: currentState.attendanceFlow || {
        task: initialTask || '',
        branch: initialBranch || '',
        mode: initialMode || 'students',
        scope: initialMode === 'students' ? getStudentAttendanceScope(initialBranch, 'subject') : 'staff',
      },
    }, '');

    const handleHistoryBack = (event) => {
      const flow = event.state?.attendanceFlow;
      if (!flow) {
        setActiveAttendanceTask('');
        setActiveAttendanceBranch('');
        setSelectedEntityId('');
        return;
      }
      setActiveAttendanceTask(flow.task || '');
      setActiveAttendanceBranch(flow.branch || '');
      setMode(flow.mode || 'students');
      setStudentAttendanceScope(flow.scope || getStudentAttendanceScope(flow.branch, 'subject'));
      setSelectedEntityId('');
      setSearch('');
    };

    window.addEventListener('popstate', handleHistoryBack);
    return () => window.removeEventListener('popstate', handleHistoryBack);
  }, [initialBranch, initialMode, initialTask]);

  const currentRoleId = currentUser?.roleId || 'admin';
  const canMarkStudents = canAccess(defaultRoles, currentRoleId, 'attendance.markStudents');
  const canMarkStaff = canAccess(defaultRoles, currentRoleId, 'attendance.markStaff');

  const courseStudents = scopedStudents.length ? scopedStudents : filterStudentsByCourse(students, selectedCourseCode, selectedCourse);
  const semesterOptions = useMemo(() => {
    const courseSubjects = academicSubjects.filter((subject) =>
      selectedCourseCode === 'all' || subject.courseCode === selectedCourseCode || subject.programName === selectedCourse?.courseName
    );
    return buildSemesterOptions([...courseSubjects, ...courseStudents]);
  }, [academicSubjects, courseStudents, selectedCourse, selectedCourseCode]);
  const semesterStudents = selectedSemester
    ? courseStudents.filter((student) => recordMatchesSemester(student, selectedSemester))
    : courseStudents;
  const facultyOptions = useMemo(() => {
    const teacherMap = new Map();
    const activeStaff = staff.filter((member) => member.status !== 'Archived');
    const typedTeachers = activeStaff.filter(isTeacherStaffRecord);
    (typedTeachers.length ? typedTeachers : activeStaff).forEach((member) => addTeacherOption(teacherMap, member));
    if (currentRoleId === 'faculty') {
      demoStaffMembers
        .filter((member) => member.status !== 'Archived' && isTeacherStaffRecord(member))
        .forEach((member) => addTeacherOption(teacherMap, member));
      addCurrentUserTeacherOption(teacherMap, currentUser);
    }
    timetableEntries
      .filter((entry) => entry.status !== 'Archived')
      .forEach((entry, index) => addTeacherOption(teacherMap, {
        id: entry.facultyRecordId || entry.facultyId || buildTeacherOptionId('timetable', index, entry.facultyName),
        employeeId: entry.facultyId || '',
        name: entry.facultyName,
      }));
    academicSubjects
      .filter((subject) => subject.status !== 'Archived')
      .forEach((subject, index) => addTeacherOption(teacherMap, {
        id: subject.facultyRecordId || subject.facultyId || buildTeacherOptionId('subject', index, subject.facultyName),
        employeeId: subject.facultyId || '',
        name: subject.facultyName,
      }));
    studentAttendance
      .filter((record) => record.attendanceScope === 'subject' || record.subjectName || record.subject)
      .forEach((record, index) => addTeacherOption(teacherMap, {
        id: record.facultyRecordId || record.facultyId || buildTeacherOptionId('attendance', index, record.facultyName),
        employeeId: record.facultyId || '',
        name: record.facultyName,
      }));
    return [...new Set(teacherMap.values())].sort((first, second) => first.name.localeCompare(second.name));
  }, [academicSubjects, currentRoleId, currentUser, staff, studentAttendance, timetableEntries]);
  const selectedFaculty = facultyOptions.find((member) => member.id === selectedFacultyId) || null;
  const subjectOptions = useMemo(() => {
    return academicSubjects
      .filter((subject) => selectedCourseCode === 'all' || subject.courseCode === selectedCourseCode || subject.programName === selectedCourse?.courseName)
      .filter((subject) => !selectedSemester || recordMatchesSemester(subject, selectedSemester))
      .map((subject) => ({
        code: subject.subjectCode || subject.id || subject.subjectName,
        name: subject.subjectName || subject.name,
        topics: getSubjectTopics(subject),
        semesterNumbers: getSemesterNumbersForAcademicRecord(subject),
        semesterLabels: getSemesterLabels(getSemesterNumbersForAcademicRecord(subject)),
      }))
      .filter((subject) => subject.name);
  }, [academicSubjects, selectedCourse, selectedCourseCode, selectedSemester]);
  const selectedSubject = subjectOptions.find((subject) => subject.code === selectedSubjectCode) || null;
  const topicSuggestions = selectedSubject?.topics || EMPTY_TOPIC_SUGGESTIONS;
  const visibleTopicSuggestions = useMemo(() => {
    const topicSearch = topic.trim().toLowerCase();
    if (!topicSearch) return topicSuggestions;
    return topicSuggestions.filter((item) => item.toLowerCase().includes(topicSearch));
  }, [topic, topicSuggestions]);
  const selectedOpeningTime = normalizeAttendanceTime(openingTime);
  const selectedClosingTime = normalizeAttendanceTime(closingTime);
  const selectedTimeRange = formatAttendanceTimeRange(selectedOpeningTime, selectedClosingTime);
  const courseStudentAttendance = filterStudentScopedRecords(studentAttendance, semesterStudents, selectedCourseCode, selectedCourse);
  const allModeRecords = mode === 'students' ? courseStudentAttendance : staffAttendance;
  const isSubjectStudentAttendance = mode === 'students' && Boolean(activeAttendanceBranch) && studentAttendanceScope === 'subject';
  const isGeneralStudentAttendance = mode === 'students' && Boolean(activeAttendanceBranch) && studentAttendanceScope === 'general';
  const activeRecords = mode === 'students'
    ? allModeRecords.filter((record) => {
      const recordSubject = record.subjectName || record.subject || '';
      if (selectedSemester && !recordMatchesSemester(record, selectedSemester)) return false;
      if (isGeneralStudentAttendance) return !recordSubject;
      if (isSubjectStudentAttendance) {
        return Boolean(selectedSubject?.name && selectedTimeRange)
          && recordSubject === selectedSubject.name
          && recordMatchesAttendanceTimeRange(record, selectedOpeningTime, selectedClosingTime);
      }
      return true;
    })
    : allModeRecords;
  const selectedDate = formatAttendanceDateInput(selectedDateInput);
  const selectedDateRecords = activeRecords.filter((record) => getAttendanceReportDateText(record) === selectedDate);
  const activeEntities = useMemo(() => {
    const term = search.trim().toLowerCase();
    const source = mode === 'students' ? semesterStudents : staff;
    if (!term) return source;
    return source.filter((entity) =>
      [entity.name, entity.studentId, entity.employeeId, entity.className, entity.department]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(term))
    );
  }, [mode, search, semesterStudents, staff]);
  const attendanceDraftContextKey = [
    activeAttendanceBranch,
    mode,
    selectedDateInput,
    selectedFacultyId,
    selectedSemester,
    selectedSubjectCode,
    selectedOpeningTime,
    selectedClosingTime,
    studentAttendanceScope,
  ].join('|');
  const draftStatuses = draftAttendance.contextKey === attendanceDraftContextKey ? draftAttendance.statuses : {};
  const draftCount = Object.keys(draftStatuses).length;
  const setScopedDraftStatuses = (updater) => {
    setDraftAttendance((prev) => {
      const currentStatuses = prev.contextKey === attendanceDraftContextKey ? prev.statuses : {};
      const nextStatuses = typeof updater === 'function' ? updater(currentStatuses) : updater;
      return { contextKey: attendanceDraftContextKey, statuses: nextStatuses };
    });
  };
  const clearScopedDraftStatuses = () => {
    setDraftAttendance({ contextKey: attendanceDraftContextKey, statuses: {} });
  };

  const summary = summarizeAttendance(selectedDateRecords);
  const stats = [
    { label: 'Present', value: summary.present, icon: <CheckCircle size={22} /> },
    { label: 'Absent', value: summary.absent, icon: <XCircle size={22} /> },
    { label: 'Attendance %', value: `${summary.percentage}%`, icon: <CalendarDays size={22} /> },
  ];
  const openAttendanceTask = (taskId, nextMode = mode) => {
    setActiveAttendanceTask(taskId);
    setActiveAttendanceBranch('');
    setSelectedEntityId('');
    setSearch('');
    setMode(nextMode);
    const nextScope = nextMode === 'students' ? 'subject' : 'staff';
    setStudentAttendanceScope(nextScope);
    window.history.pushState({ ...(window.history.state || {}), attendanceFlow: { task: taskId, branch: '', mode: nextMode, scope: nextScope } }, '');
  };

  const openAttendanceBranch = ({ branchId, nextMode = mode, scope = '' }) => {
    const nextScope = nextMode === 'students' ? (scope || getStudentAttendanceScope(branchId, studentAttendanceScope)) : 'staff';
    setActiveAttendanceBranch(branchId);
    setSelectedEntityId('');
    setSearch('');
    setMode(nextMode);
    setStudentAttendanceScope(nextScope);
    if (nextMode === 'students' && nextScope === 'subject') {
      setSelectedSemester('');
      setSelectedSubjectCode('');
      setSelectedFacultyId('');
      setOpeningTime('');
      setClosingTime('');
      setTopic('');
    }
    window.history.pushState({ ...(window.history.state || {}), attendanceFlow: { task: activeAttendanceTask, branch: branchId, mode: nextMode, scope: nextScope } }, '');
  };

  const goBackOneAttendanceStep = () => {
    const flow = window.history.state?.attendanceFlow;
    if (flow?.branch || flow?.task) {
      window.history.back();
      return;
    }
    if (activeAttendanceBranch) {
      setActiveAttendanceBranch('');
      setSelectedEntityId('');
      return;
    }
    setActiveAttendanceTask('');
  };

  const attendanceTaskOptions = [
    {
      id: 'students',
      title: 'Student Attendance',
      description: 'Mark students and follow up absentees.',
      icon: <Users size={22} />,
      meta: [`${courseStudents.length} students`, canMarkStudents ? 'Mark enabled' : 'View only'],
      onOpen: () => openAttendanceTask('students', 'students'),
    },
    {
      id: 'staff',
      title: 'Staff Attendance',
      description: 'Mark faculty and staff attendance.',
      icon: <UserCheck size={22} />,
      meta: [`${staff.length} staff`, canMarkStaff ? 'Mark enabled' : 'View only'],
      onOpen: () => openAttendanceTask('staff', 'staff'),
    },
  ].filter(Boolean);

  const attendanceBranchOptions = {
    students: [
      { id: 'mark-general-students', title: 'Mark General Attendance', description: 'Mark daily student attendance without selecting a subject.', icon: <CalendarDays size={20} />, nextMode: 'students', scope: 'general' },
      { id: 'mark-students', title: 'Mark Subject Attendance', description: 'Select a subject, then mark student attendance.', icon: <CheckCircle size={20} />, nextMode: 'students', scope: 'subject' },
    ],
    staff: [
      { id: 'mark-staff', title: 'Mark Staff Attendance', description: 'Select a staff member, then mark attendance.', icon: <UserCheck size={20} />, nextMode: 'staff' },
    ],
  };

  const activeTask = attendanceTaskOptions.find((task) => task.id === activeAttendanceTask);
  const activeBranches = attendanceBranchOptions[activeAttendanceTask] || [];
  const activeBranch = activeBranches.find((branch) => branch.id === activeAttendanceBranch);

  const validateAttendanceContext = () => {
    if (mode === 'students' && studentAttendanceScope === 'subject' && !selectedSemester) {
      toast.error('Select a semester before marking subject attendance.');
      return false;
    }
    if (mode === 'students' && studentAttendanceScope === 'subject' && !selectedSubject) {
      toast.error('Select a live subject before marking student attendance.');
      return false;
    }
    if (mode === 'students' && studentAttendanceScope === 'subject' && !selectedFaculty) {
      toast.error('Select the faculty member before saving subject attendance.');
      return false;
    }
    if (mode === 'students' && studentAttendanceScope === 'subject' && !selectedOpeningTime) {
      toast.error('Select the opening time before saving subject attendance.');
      return false;
    }
    if (mode === 'students' && studentAttendanceScope === 'subject' && !selectedClosingTime) {
      toast.error('Select the closing time before saving subject attendance.');
      return false;
    }
    if (mode === 'students' && studentAttendanceScope === 'subject' && !isAttendanceTimeRangeValid(selectedOpeningTime, selectedClosingTime)) {
      toast.error('Closing time must be after opening time.');
      return false;
    }
    if (mode === 'students' && studentAttendanceScope === 'subject' && !topic.trim()) {
      toast.error('Enter the class topic before saving subject attendance.');
      return false;
    }
    return true;
  };

  const getAttendanceSubjectName = () => (
    mode === 'students' && studentAttendanceScope === 'subject' ? selectedSubject?.name || '' : ''
  );

  const findExistingAttendanceRecord = (entity) => {
    const entityId = entity.studentId || entity.employeeId;
    const subjectName = getAttendanceSubjectName();
    const key = buildAttendanceKey(
      entityId,
      selectedDate,
      subjectName,
      mode === 'students' && studentAttendanceScope === 'subject' ? selectedOpeningTime : '',
      mode === 'students' && studentAttendanceScope === 'subject' ? selectedClosingTime : ''
    );
    return allModeRecords.find((record) => buildAttendanceKey(
      record.entityId || record.studentId || record.employeeId,
      getAttendanceReportDateText(record),
      record.subjectName || record.subject || '',
      mode === 'students' && studentAttendanceScope === 'subject' ? record.openingTime || record.sessionOpeningTime || record.startTime : '',
      mode === 'students' && studentAttendanceScope === 'subject' ? record.closingTime || record.sessionClosingTime || record.endTime : ''
    ) === key);
  };

  const markAttendance = (entity, status) => {
    if (mode === 'students' && !canMarkStudents) {
      toast.error('You do not have permission to mark student attendance.');
      return;
    }
    if (mode === 'staff' && !canMarkStaff) {
      toast.error('You do not have permission to mark staff attendance.');
      return;
    }
    if (!validateAttendanceContext()) return;
    const entityId = entity.studentId || entity.employeeId;
    const exists = findExistingAttendanceRecord(entity);
    if (exists) {
      if (exists.status === status) {
        setScopedDraftStatuses((prev) => {
          const next = { ...prev };
          delete next[entityId];
          return next;
        });
        toast.success(`${entity.name} is already marked ${status.toLowerCase()}`);
        return;
      }
      if (!isAttendanceRecordEditable(exists)) {
        toast.error('Attendance can only be edited within 24 hours of marking.');
        return;
      }
    }
    setScopedDraftStatuses((prev) => ({ ...prev, [entityId]: status }));
  };

  const markRemainingPresent = () => {
    if (!validateAttendanceContext()) return;
    let changed = 0;
    const nextDraftStatuses = { ...draftStatuses };
    activeEntities.forEach((entity) => {
      const entityId = entity.studentId || entity.employeeId;
      const exists = findExistingAttendanceRecord(entity);
      if (exists && !isAttendanceRecordEditable(exists)) return;
      if (nextDraftStatuses[entityId] === 'Absent') return;
      if (exists?.status === 'Present' && !nextDraftStatuses[entityId]) return;
      nextDraftStatuses[entityId] = 'Present';
      changed += 1;
    });
    setScopedDraftStatuses(nextDraftStatuses);
    toast.success(changed ? `${changed} remaining record${changed === 1 ? '' : 's'} set to present in draft` : 'No remaining records to mark present.');
  };

  const clearDraftAttendance = () => {
    clearScopedDraftStatuses();
    toast.success('Attendance draft cleared');
  };

  const closeAttendanceSession = () => {
    setActiveAttendanceBranch('');
    setSelectedEntityId('');
    setSearch('');
    setSelectedSemester('');
    setSelectedSubjectCode('');
    setSelectedFacultyId('');
    setOpeningTime('');
    setClosingTime('');
    setTopic('');
    clearScopedDraftStatuses();
    window.history.replaceState({
      ...(window.history.state || {}),
      attendanceFlow: {
        task: activeAttendanceTask,
        branch: '',
        mode,
        scope: studentAttendanceScope,
      },
    }, '');
  };

  const buildAttendancePayload = (entity, status, sessionId, now) => {
    const entityId = entity.studentId || entity.employeeId;
    const subjectName = getAttendanceSubjectName();
    const normalizedTopic = topic.trim();
    const matchedTopic = topicSuggestions.find((item) => item.toLowerCase() === normalizedTopic.toLowerCase()) || '';
    const selectedSemesterNumber = parseSemesterNumber(selectedSemester);
    const entitySemesterNumbers = selectedSemesterNumber ? [selectedSemesterNumber] : getSemesterNumbersForStudent(entity);
    const entitySemesterLabels = getSemesterLabels(entitySemesterNumbers);
    const payload = {
      entityType: mode === 'students' ? 'Student' : 'Staff',
      entityRecordId: entity.id,
      entityId,
      studentRecordId: mode === 'students' ? entity.id : '',
      studentId: mode === 'students' ? entity.studentId || '' : '',
      staffRecordId: mode === 'staff' ? entity.id : '',
      employeeId: mode === 'staff' ? entity.employeeId || '' : '',
      entityName: entity.name,
      academicYear,
      className: entity.className || '',
      section: entity.section || '',
      semester: mode === 'students' ? selectedSemester || getStudentSemester(entity) : '',
      semesterNumber: mode === 'students' ? selectedSemesterNumber || entitySemesterNumbers[0] || '' : '',
      semesterNumbers: mode === 'students' ? entitySemesterNumbers : [],
      semesterLabels: mode === 'students' ? entitySemesterLabels : [],
      department: entity.department || '',
      courseCode: entity.courseCode || selectedCourseCode,
      courseName: entity.courseName || entity.program || selectedCourse?.courseName || '',
      attendanceScope: mode === 'students' ? studentAttendanceScope : 'staff',
      subjectCode: mode === 'students' && studentAttendanceScope === 'subject' ? selectedSubject?.code || '' : '',
      subjectName,
      facultyRecordId: mode === 'students' && studentAttendanceScope === 'subject' ? selectedFaculty?.id || '' : '',
      facultyId: mode === 'students' && studentAttendanceScope === 'subject' ? selectedFaculty?.employeeId || '' : '',
      facultyName: mode === 'students' && studentAttendanceScope === 'subject' ? selectedFaculty?.name || '' : '',
      openingTime: mode === 'students' && studentAttendanceScope === 'subject' ? selectedOpeningTime : '',
      closingTime: mode === 'students' && studentAttendanceScope === 'subject' ? selectedClosingTime : '',
      timeRange: mode === 'students' && studentAttendanceScope === 'subject' ? selectedTimeRange : '',
      topic: mode === 'students' && studentAttendanceScope === 'subject' ? normalizedTopic : '',
      syllabusTopic: mode === 'students' && studentAttendanceScope === 'subject' ? matchedTopic : '',
      syllabusTopicMatched: mode === 'students' && studentAttendanceScope === 'subject' ? Boolean(matchedTopic) : false,
      dateInput: selectedDateInput,
      dateText: selectedDate,
      status,
      sessionId,
      markedAtText: formatDisplayDate(now),
      markedAtIso: now.toISOString(),
      parentNotified: false,
    };
    return payload;
  };

  const saveDraftAttendance = async () => {
    if (savingDraft) return;
    if (!isFirebaseConfigured) {
      toast.error('Live Firebase data is not configured.');
      return;
    }
    if (mode === 'students' && !canMarkStudents) {
      toast.error('You do not have permission to mark student attendance.');
      return;
    }
    if (mode === 'staff' && !canMarkStaff) {
      toast.error('You do not have permission to mark staff attendance.');
      return;
    }
    if (!validateAttendanceContext()) return;

    const draftRows = activeEntities
      .map((entity) => {
        const entityId = entity.studentId || entity.employeeId;
        return { entity, entityId, status: draftStatuses[entityId] };
      })
      .filter((row) => row.status);

    if (!draftRows.length) {
      toast.error('No attendance changes to save.');
      return;
    }

    try {
      setSavingDraft(true);
      const now = new Date();
      const sessionContext = [
        mode,
        selectedDateInput,
        selectedSemester,
        selectedSubjectCode,
        selectedOpeningTime,
        selectedClosingTime,
        draftRows.length,
        now.getTime(),
      ].filter(Boolean).join('-').replace(/[^a-z0-9-]+/gi, '-').toLowerCase();
      const sessionId = `attendance-${sessionContext}`;
      const results = await Promise.all(draftRows.map(async ({ entity, status }) => {
        const exists = findExistingAttendanceRecord(entity);
        if (exists && !isAttendanceRecordEditable(exists)) {
          return { skipped: true, name: entity.name };
        }
        const payload = buildAttendancePayload(entity, status, sessionId, now);
        if (exists) {
          const updates = {
            ...payload,
            editedAtText: formatDisplayDate(now),
            editedAtIso: now.toISOString(),
          };
          if (mode === 'students') await updateStudentAttendanceRecord(exists.id, updates);
          else await updateStaffAttendanceRecord(exists.id, updates);
          return { action: 'updated', record: { ...exists, ...updates } };
        }
        const id = mode === 'students'
          ? await createStudentAttendanceRecord(payload)
          : await createStaffAttendanceRecord(payload);
        if (!id) throw new Error('Live attendance record was not created.');
        return { action: 'created', record: { id, ...payload } };
      }));

      const savedRecords = results.filter((result) => result.record).map((result) => result.record);

      if (mode === 'students') {
        setStudentAttendance((prev) => mergeAttendanceRecords(prev, savedRecords));
        onAttendanceSaved?.(savedRecords);
      } else {
        setStaffAttendance((prev) => mergeAttendanceRecords(prev, savedRecords));
      }

      const skipped = results.filter((result) => result.skipped).length;
      toast.success(`${savedRecords.length} attendance record${savedRecords.length === 1 ? '' : 's'} saved${skipped ? `, ${skipped} skipped` : ''}`);
      closeAttendanceSession();
    } catch (error) {
      console.error('Unable to save live attendance records.', error);
      toast.error('Attendance was not saved to live data.');
    } finally {
      setSavingDraft(false);
    }
  };

  return (
    <div>
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <div className="text-sm font-bold text-slate-500 mb-2">Academics / <span className="text-[#f39a5f]">Attendance Management</span></div>
          <h1 className="text-2xl font-bold text-slate-900">Attendance Management</h1>
          <p className="text-sm text-slate-500 mt-1">Student and faculty attendance tracking. Attendance summaries open from the Reports module.</p>
          {!isFirebaseConfigured && <p className="text-xs text-rose-600 mt-2">Live Firebase data is not configured.</p>}
          {loadError && <p className="text-xs text-rose-600 mt-2">{loadError}</p>}
        </div>
        <div className="flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center">
          {mode === 'students' && activeAttendanceBranch && (
            <span className="hidden rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 sm:inline-flex">
              {studentAttendanceScope === 'general' ? 'General Attendance' : 'Subject Attendance'}
            </span>
          )}
          <label className="erp-attendance-date-control">
            <span className="erp-attendance-date-label">
              <CalendarDays size={15} />
              Attendance Date
            </span>
            <input
              type="date"
              value={selectedDateInput}
              onChange={(event) => event.target.value && setSelectedDateInput(event.target.value)}
              className="erp-attendance-date-input"
            />
          </label>
        </div>
      </div>

      {!activeAttendanceTask ? (
      <>
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4 py-5">
        {stats.map(({ label, value, icon }) => (
          <div key={label} className="bg-[#f5f5f6] rounded-lg p-4 flex items-center gap-4">
            <div className="h-12 w-12 bg-white rounded-lg flex items-center justify-center text-[#34363d] shadow-sm">{icon}</div>
            <div>
              <div className="text-xs text-slate-500">{label}</div>
              <div className="text-xl font-bold text-slate-900">{loading ? '...' : value}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {attendanceTaskOptions.map((task) => (
          <button key={task.id} onClick={task.onOpen} className="group min-h-40 text-left rounded-lg border border-slate-100 bg-white p-5 shadow-sm hover:-translate-y-1 transition-all">
            <div className="flex items-start justify-between gap-4">
              <div className="h-12 w-12 rounded-lg bg-[#f5f5f6] text-[#34363d] flex items-center justify-center">{task.icon}</div>
              <ArrowRight size={18} className="text-slate-400 group-hover:text-[#fb8d49]" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 mt-5">{task.title}</h2>
            <p className="text-sm text-slate-500 mt-2">{task.description}</p>
            <div className="flex flex-wrap gap-2 mt-4">
              {task.meta.map((item) => (
                <span key={item} className="rounded-full bg-[#f5f5f6] px-3 py-1 text-xs font-semibold text-slate-600">{item}</span>
              ))}
            </div>
          </button>
        ))}
      </div>
      </>
      ) : !activeAttendanceBranch ? (
      <>
      <div className="erp-back-row my-5">
        <button onClick={goBackOneAttendanceStep} className="erp-back-button h-10 px-4 rounded-lg bg-white border border-slate-200 text-slate-700 font-semibold text-sm flex items-center gap-2">
          <ArrowLeft size={15} /> Back
        </button>
      </div>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-5 rounded-lg bg-[#f5f5f6] p-4">
        <div>
          <div className="text-xs font-bold text-slate-500">Attendance / <span className="text-[#fb8d49]">{activeTask?.title}</span></div>
          <h2 className="text-lg font-bold text-slate-900 mt-1">Choose next step</h2>
        </div>
      </div>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {activeBranches.map((branch) => (
          <button
            key={branch.id}
            onClick={() => openAttendanceBranch({ branchId: branch.id, nextMode: branch.nextMode || mode, scope: branch.scope })}
            className="group min-h-36 text-left rounded-lg border border-slate-100 bg-white p-5 shadow-sm"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="h-11 w-11 rounded-lg bg-[#f5f5f6] text-[#34363d] flex items-center justify-center">{branch.icon}</div>
              <ArrowRight size={17} className="text-slate-400 group-hover:text-[#fb8d49]" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mt-4">{branch.title}</h3>
            <p className="text-sm text-slate-500 mt-2">{branch.description}</p>
          </button>
        ))}
      </div>
      </>
      ) : (
      <>
      <div className="erp-back-row my-5">
        <button onClick={goBackOneAttendanceStep} className="erp-back-button h-10 px-4 rounded-lg bg-white border border-slate-200 text-slate-700 font-semibold text-sm flex items-center gap-2">
          <ArrowLeft size={15} /> Back
        </button>
      </div>
      <div className="erp-branch-focus flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5 rounded-lg bg-[#f5f5f6] p-5 border border-slate-100">
        <div className="flex items-center gap-4 min-w-0">
          <div className="erp-branch-icon h-16 w-16 rounded-lg bg-white text-[#fb8d49] flex items-center justify-center shrink-0">{activeBranch?.icon}</div>
          <div className="min-w-0">
            <h2 className="text-2xl font-extrabold text-slate-900">{activeBranch?.title}</h2>
          </div>
        </div>
      </div>

      <div>
        <div className="min-w-0">
          {!canMarkStudents && mode === 'students' && (
            <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 text-sm">
              You can view student attendance but cannot mark it.
            </div>
          )}
          {!canMarkStaff && mode === 'staff' && (
            <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 text-sm">
              You can view staff attendance but cannot mark it.
            </div>
          )}

          {mode === 'students' && (
            <div className="erp-attendance-context-panel mb-4 grid md:grid-cols-2 xl:grid-cols-6 gap-3 rounded-lg border border-slate-100 bg-[#f5f5f6] p-4">
              <label className="erp-attendance-field">
                <span className="erp-attendance-field-label block text-xs font-semibold text-slate-500 mb-1.5">Semester</span>
                <select
                  value={selectedSemester}
                  onChange={(event) => {
                    setSelectedSemester(event.target.value);
                    setSelectedSubjectCode('');
                    setTopic('');
                  }}
                  className="erp-attendance-select w-full h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="">{studentAttendanceScope === 'subject' ? 'Select Semester' : 'All semesters'}</option>
                  {semesterOptions.map((semester) => (
                    <option key={semester.value} value={semester.value}>{semester.label}</option>
                  ))}
                </select>
              </label>
              {studentAttendanceScope === 'subject' && (
                <>
                  <label className="erp-attendance-field">
                    <span className="erp-attendance-field-label block text-xs font-semibold text-slate-500 mb-1.5">Subject</span>
                    <select
                      value={selectedSubject?.code || ''}
                      onChange={(event) => {
                        setSelectedSubjectCode(event.target.value);
                        setTopic('');
                      }}
                      className="erp-attendance-select w-full h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm"
                    >
                      <option value="">{subjectOptions.length ? 'Select Subject' : 'No Live Subjects'}</option>
                      {subjectOptions.map((subject) => (
                        <option key={subject.code} value={subject.code}>{subject.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="erp-attendance-field">
                    <span className="erp-attendance-field-label block text-xs font-semibold text-slate-500 mb-1.5">Faculty</span>
                    <select
                      value={selectedFacultyId}
                      onChange={(event) => setSelectedFacultyId(event.target.value)}
                      className="erp-attendance-select w-full h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm"
                    >
                      <option value="">{facultyOptions.length ? 'Select Faculty' : 'No Faculty Records'}</option>
                      {facultyOptions.map((member) => (
                        <option key={member.id} value={member.id}>{member.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="erp-attendance-field">
                    <span className="erp-attendance-field-label block text-xs font-semibold text-slate-500 mb-1.5">Opening Time</span>
                    <input
                      type="time"
                      value={openingTime}
                      onChange={(event) => setOpeningTime(event.target.value)}
                      className="erp-attendance-input w-full h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm"
                    />
                  </label>
                  <label className="erp-attendance-field">
                    <span className="erp-attendance-field-label block text-xs font-semibold text-slate-500 mb-1.5">Closing Time</span>
                    <input
                      type="time"
                      value={closingTime}
                      onChange={(event) => setClosingTime(event.target.value)}
                      className="erp-attendance-input w-full h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm"
                    />
                  </label>
                  <div className="erp-attendance-field">
                    <span className="erp-attendance-field-label block text-xs font-semibold text-slate-500 mb-1.5">Topic</span>
                    <input
                      value={topic}
                      onChange={(event) => setTopic(event.target.value)}
                      placeholder={topicSuggestions.length ? 'Type or choose topic taught' : 'Topic taught'}
                      className="erp-attendance-input w-full h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm"
                    />
                    {topicSuggestions.length > 0 && (
                      <div className="erp-topic-picker mt-2 rounded-lg border border-slate-200 bg-white p-2">
                        <div className="erp-topic-picker-scroll space-y-1 pr-1">
                          {visibleTopicSuggestions.length ? (
                            visibleTopicSuggestions.map((item) => {
                              const isSelectedTopic = item.toLowerCase() === topic.trim().toLowerCase();
                              return (
                                <button
                                  key={item}
                                  type="button"
                                  onClick={() => setTopic(item)}
                                  className={`erp-topic-picker-option ${isSelectedTopic ? 'is-selected' : ''}`}
                                >
                                  {item}
                                </button>
                              );
                            })
                          ) : (
                            <div className="erp-topic-picker-empty rounded-md px-3 py-2 text-xs font-semibold">
                              No matching syllabus topics
                            </div>
                          )}
                        </div>
                        <p className="erp-attendance-field-note mt-2 text-[11px] font-semibold">
                          {topicSuggestions.length} syllabus topic{topicSuggestions.length === 1 ? '' : 's'} available
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          <div className="relative mb-4">
            <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search attendance roster..."
              className="erp-attendance-search-input w-full h-11 rounded-lg bg-[#f0f0f2] border-0 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-orange-100"
            />
          </div>

          <div className="erp-attendance-draft-panel mb-4 flex flex-col gap-3 rounded-lg border border-slate-100 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs font-bold uppercase text-slate-500">Draft Attendance</div>
              <div className="text-sm font-bold text-slate-900">
                {draftCount} unsaved change{draftCount === 1 ? '' : 's'}
              </div>
            </div>
            <div className="erp-attendance-draft-actions flex flex-wrap gap-2">
              <button
                type="button"
                onClick={markRemainingPresent}
                disabled={mode === 'students' ? !canMarkStudents : !canMarkStaff}
                className="h-10 px-4 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-sm font-bold disabled:opacity-50"
              >
                Mark Remaining Present
              </button>
              <button
                type="button"
                onClick={clearDraftAttendance}
                disabled={!draftCount}
                className="h-10 px-4 rounded-lg bg-slate-100 text-slate-700 text-sm font-bold disabled:opacity-50"
              >
                Clear Draft
              </button>
              <button
                type="button"
                onClick={saveDraftAttendance}
                disabled={!draftCount || savingDraft || (mode === 'students' ? !canMarkStudents : !canMarkStaff)}
                className="h-10 px-4 rounded-lg bg-[#033500] text-white text-sm font-bold shadow-[0_10px_22px_rgba(3,53,0,0.2)] disabled:opacity-50"
              >
                {savingDraft ? 'Saving...' : 'Save & Close'}
              </button>
            </div>
          </div>

          <AttendanceTable
            canMark={mode === 'students' ? canMarkStudents : canMarkStaff}
            draftStatuses={draftStatuses}
            entities={activeEntities}
            isRecordEditable={isAttendanceRecordEditable}
            mode={mode}
            records={activeRecords}
            selectedDate={selectedDate}
            onMark={markAttendance}
            onSelect={setSelectedEntityId}
            selectedId={selectedEntityId}
            showActions={false}
          />
        </div>
      </div>
      </>
      )}
    </div>
  );
}
