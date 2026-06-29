import { useEffect, useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  archiveTimetableEntry,
  createTimetableEntry,
  getTimetableManagementData,
  restoreTimetableEntry,
  updateTimetableEntry,
} from '../../firebase/db';
import { isFirebaseConfigured } from '../../firebase/config';
import { canAccess, defaultRoles } from '../userRoles/rolePermissions';
import { demoStaffMembers } from '../facultyStaff/demoFacultyStaff';
import { demoStudents } from '../students/demoStudents';
import { demoClassrooms, demoTimetableEntries } from './demoTimetable';
import { filterTimetableEntriesByCourse, formatDisplayDate, getClassOptions, getTimeSlotOptions, hasTimetableConflict, normalizeTimeSlotFields, validateTimetableEntry } from './timetableUtils';
import TimetableEntryModal from './components/TimetableEntryModal';
import TimetableGrid from './components/TimetableGrid';
import { filterStudentsByCourse } from '../shared/courseFilters';

export default function TimetableManagement({ currentUser, academicYear = '2026-2027', scopedStudents = [], selectedCourse = null, selectedCourseCode = 'all' }) {
  const [students, setStudents] = useState(isFirebaseConfigured ? [] : demoStudents);
  const [staff, setStaff] = useState(isFirebaseConfigured ? [] : demoStaffMembers);
  const [classrooms, setClassrooms] = useState(isFirebaseConfigured ? [] : demoClassrooms);
  const [entries, setEntries] = useState(isFirebaseConfigured ? [] : demoTimetableEntries);
  const [search, setSearch] = useState('');
  const [statusView, setStatusView] = useState('active');
  const [loadError, setLoadError] = useState('');
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [entryDefaults, setEntryDefaults] = useState({});
  const [editingEntry, setEditingEntry] = useState(null);

  useEffect(() => {
    const loadTimetable = async () => {
      if (!isFirebaseConfigured) return;
      try {
        const data = await getTimetableManagementData(academicYear, currentUser);
        if (data.students.length) setStudents(data.students);
        if (data.staff.length) setStaff(data.staff.filter((member) => member.status !== 'Archived'));
        if (data.classrooms.length) setClassrooms(data.classrooms);
        setEntries(data.timetableEntries);
      } catch (error) {
        console.warn('Using demo timetable because Firestore is not reachable.', error);
        setLoadError('Unable to load Firestore timetable records. Showing demo/local records.');
      }
    };
    loadTimetable();
  }, [academicYear, currentUser]);

  const currentRoleId = currentUser?.roleId || 'admin';
  const canCreate = canAccess(defaultRoles, currentRoleId, 'timetable.create');
  const canEdit = canAccess(defaultRoles, currentRoleId, 'timetable.edit');
  const canManageTimetable = canCreate || canEdit;

  const faculty = staff.filter((member) => member.staffType === 'Faculty' && member.status !== 'Archived');
  const courseStudents = scopedStudents.length ? scopedStudents : filterStudentsByCourse(students, selectedCourseCode, selectedCourse);
  const parentCourseCodes = new Set(courseStudents.map((student) => student.courseCode).filter(Boolean));
  const courseEntries = filterTimetableEntriesByCourse(
    entries,
    selectedCourseCode,
    currentRoleId === 'parent' ? [...parentCourseCodes] : []
  );
  const visibleCourseEntries = courseEntries.filter((entry) => (
    statusView === 'archived' ? entry.status === 'Archived' : entry.status !== 'Archived'
  ));
  const classOptions = getClassOptions(courseStudents);
  const timeSlotOptions = getTimeSlotOptions(courseEntries);
  const filteredEntries = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return visibleCourseEntries;
    return visibleCourseEntries.filter((entry) =>
      [entry.subject, entry.classKey, entry.facultyName, entry.classroomName, entry.day]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(term))
    );
  }, [search, visibleCourseEntries]);

  const buildEntryPayload = (form) => {
    const facultyMember = faculty.find((item) => item.id === form.facultyId);
    const classroom = classrooms.find((item) => item.id === form.classroomId);
    const classStudent = courseStudents.find((student) => `${student.className} - ${student.section}` === form.classKey);
    const normalizedForm = normalizeTimeSlotFields(form);
    return {
      ...form,
      ...normalizedForm,
      subject: form.subject.trim(),
      facultyName: facultyMember?.name || '',
      classroomName: classroom?.roomNo || '',
      courseCode: selectedCourseCode === 'all' ? classStudent?.courseCode || '' : selectedCourseCode,
      courseName: selectedCourseCode === 'all'
        ? classStudent?.courseName || classStudent?.program || ''
        : selectedCourse?.courseName || selectedCourse?.name || '',
      status: 'Draft',
    };
  };

  const saveEntry = async (form) => {
    if (!canCreate && !editingEntry) {
      toast.error('You do not have permission to create timetable entries.');
      return;
    }
    if (!canEdit && editingEntry) {
      toast.error('You do not have permission to edit timetable entries.');
      return;
    }

    const validationMessage = validateTimetableEntry(form);
    if (validationMessage) {
      toast.error(validationMessage);
      return;
    }

    const payload = buildEntryPayload(form);
    if (hasTimetableConflict(courseEntries, payload, editingEntry?.id)) {
      toast.error('Conflict detected for class, faculty, or classroom in the same slot.');
      return;
    }

    if (editingEntry) {
      const updates = { ...payload, updatedAtText: formatDisplayDate() };
      try {
        await updateTimetableEntry(editingEntry.id, updates);
        setEntries((prev) => prev.map((entry) => entry.id === editingEntry.id ? { ...entry, ...updates } : entry));
        toast.success('Timetable entry updated');
      } catch {
        setEntries((prev) => prev.map((entry) => entry.id === editingEntry.id ? { ...entry, ...updates } : entry));
        toast.success('Timetable entry updated locally. Check Firebase setup to persist it.');
      } finally {
        setEditingEntry(null);
      }
      return;
    }

    const createdAtText = formatDisplayDate();
    const createPayload = { ...payload, academicYear, createdAtText };
    try {
      const id = await createTimetableEntry(createPayload);
      setEntries((prev) => [{ id: id || `local-tt-${Date.now()}`, ...createPayload }, ...prev]);
      toast.success('Timetable entry saved');
    } catch {
      setEntries((prev) => [{ id: `local-tt-${Date.now()}`, ...createPayload }, ...prev]);
      toast.success('Timetable entry saved locally. Check Firebase setup to persist it.');
    } finally {
      setShowEntryModal(false);
    }
  };

  const archiveEntry = async (entry) => {
    if (!canEdit) {
      toast.error('You do not have permission to archive timetable entries.');
      return;
    }
    const updates = { status: 'Archived', archivedAtText: formatDisplayDate() };
    try {
      await archiveTimetableEntry(entry.id, updates);
      setEntries((prev) => prev.map((item) => item.id === entry.id ? { ...item, ...updates } : item));
      toast.success('Timetable entry archived');
    } catch {
      setEntries((prev) => prev.map((item) => item.id === entry.id ? { ...item, ...updates } : item));
      toast.success('Timetable entry archived locally');
    }
  };

  const restoreEntry = async (entry) => {
    if (!canEdit) {
      toast.error('You do not have permission to restore timetable entries.');
      return;
    }
    const updates = { status: 'Draft', restoredAtText: formatDisplayDate() };
    try {
      await restoreTimetableEntry(entry.id, updates);
      setEntries((prev) => prev.map((item) => item.id === entry.id ? { ...item, ...updates } : item));
      toast.success('Timetable entry restored');
    } catch {
      setEntries((prev) => prev.map((item) => item.id === entry.id ? { ...item, ...updates } : item));
      toast.success('Timetable entry restored locally');
    }
  };

  const openEntryModal = (defaults = {}) => {
    setEntryDefaults(defaults);
    setShowEntryModal(true);
  };

  return (
    <div>
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <div className="text-sm font-bold text-slate-500 mb-2">Academics / <span className="text-[#f39a5f]">Timetable Management</span></div>
          <h1 className="text-2xl font-bold text-slate-900">Timetable Management</h1>
          <p className="text-sm text-slate-500 mt-1">Class timetable creation and schedule management.</p>
          {!isFirebaseConfigured && <p className="text-xs text-orange-600 mt-2">Demo mode: add Firebase keys to persist timetables.</p>}
          {loadError && <p className="text-xs text-rose-600 mt-2">{loadError}</p>}
        </div>
        {canCreate && (
          <div className="flex items-center gap-3">
            <button onClick={() => openEntryModal()} className="h-10 px-5 rounded-full bg-[#fb9a5b] text-white font-semibold text-sm flex items-center gap-2">
              <Plus size={16} /> New Entry
            </button>
          </div>
        )}
      </div>

      <div>
        <div className="min-w-0">
          <div className="relative mb-4">
            <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search subject, faculty, classroom..." className="w-full h-11 rounded-lg bg-[#f0f0f2] border-0 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-orange-100" />
          </div>
          <div className="flex items-center gap-2 mb-4">
            {[
              ['active', 'Active Timetable'],
              ['archived', 'Archive'],
            ].map(([value, label]) => (
              <button
                key={value}
                onClick={() => setStatusView(value)}
                className={`h-9 px-4 rounded-md border text-xs font-semibold ${statusView === value ? 'bg-[#33373e] text-white border-[#33373e]' : 'bg-white text-slate-600 border-slate-200'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <TimetableGrid
            entries={filteredEntries}
            canCreate={canCreate}
            canEdit={canEdit}
            canArchive={canEdit}
            statusView={statusView}
            onCreate={openEntryModal}
            onEdit={setEditingEntry}
            onArchive={archiveEntry}
            onRestore={restoreEntry}
          />
        </div>
      </div>

      {showEntryModal && (
        <TimetableEntryModal
          classOptions={classOptions}
          classrooms={classrooms}
          faculty={faculty}
          initialValues={entryDefaults}
          timeSlotOptions={timeSlotOptions}
          onClose={() => {
            setShowEntryModal(false);
            setEntryDefaults({});
          }}
          onSave={saveEntry}
        />
      )}
      {editingEntry && canManageTimetable && (
        <TimetableEntryModal
          mode="edit"
          initialEntry={editingEntry}
          classOptions={classOptions}
          classrooms={classrooms}
          faculty={faculty}
          timeSlotOptions={timeSlotOptions}
          onClose={() => setEditingEntry(null)}
          onSave={saveEntry}
        />
      )}
    </div>
  );
}
