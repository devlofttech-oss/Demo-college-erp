import { useEffect, useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  archiveTimetableEntry,
  createClassroom,
  createTimetableEntry,
  createTimetablePublication,
  getTimetableManagementData,
  updateTimetableEntry,
} from '../../firebase/db';
import { isFirebaseConfigured } from '../../firebase/config';
import { canAccess, defaultRoles } from '../userRoles/rolePermissions';
import { demoStaffMembers } from '../facultyStaff/demoFacultyStaff';
import { demoStudents } from '../students/demoStudents';
import { demoClassrooms, demoTimetableEntries, demoTimetablePublications } from './demoTimetable';
import { formatDisplayDate, getClassOptions, hasTimetableConflict, validateTimetableEntry } from './timetableUtils';
import TimetableEntryModal from './components/TimetableEntryModal';
import TimetableGrid from './components/TimetableGrid';
import TimetableSidePanel from './components/TimetableSidePanel';

export default function TimetableManagement({ currentUser, academicYear = '2026-2027' }) {
  const [students, setStudents] = useState(isFirebaseConfigured ? [] : demoStudents);
  const [staff, setStaff] = useState(isFirebaseConfigured ? [] : demoStaffMembers);
  const [classrooms, setClassrooms] = useState(isFirebaseConfigured ? [] : demoClassrooms);
  const [entries, setEntries] = useState(isFirebaseConfigured ? [] : demoTimetableEntries);
  const [publications, setPublications] = useState(isFirebaseConfigured ? [] : demoTimetablePublications);
  const [selectedClass, setSelectedClass] = useState('All');
  const [search, setSearch] = useState('');
  const [loadError, setLoadError] = useState('');
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [entryDefaults, setEntryDefaults] = useState({});
  const [editingEntry, setEditingEntry] = useState(null);

  useEffect(() => {
    const loadTimetable = async () => {
      if (!isFirebaseConfigured) return;
      try {
        const data = await getTimetableManagementData(academicYear);
        if (data.students.length) setStudents(data.students);
        if (data.staff.length) setStaff(data.staff.filter((member) => member.status !== 'Archived'));
        if (data.classrooms.length) setClassrooms(data.classrooms);
        setEntries(data.timetableEntries);
        setPublications(data.publications);
      } catch (error) {
        console.warn('Using demo timetable because Firestore is not reachable.', error);
        setLoadError('Unable to load Firestore timetable records. Showing demo/local records.');
      }
    };
    loadTimetable();
  }, [academicYear]);

  const currentRoleId = currentUser?.roleId || 'admin';
  const canCreate = canAccess(defaultRoles, currentRoleId, 'timetable.create');
  const canEdit = canAccess(defaultRoles, currentRoleId, 'timetable.edit');
  const canPublish = canAccess(defaultRoles, currentRoleId, 'timetable.publish');
  const canManageClassrooms = canAccess(defaultRoles, currentRoleId, 'timetable.classrooms');

  const faculty = staff.filter((member) => member.staffType === 'Faculty' && member.status !== 'Archived');
  const classOptions = getClassOptions(students);
  const filteredEntries = useMemo(() => {
    const term = search.trim().toLowerCase();
    const byClass = selectedClass === 'All' ? entries : entries.filter((entry) => entry.classKey === selectedClass);
    if (!term) return byClass;
    return byClass.filter((entry) =>
      [entry.subject, entry.classKey, entry.facultyName, entry.classroomName, entry.day]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(term))
    );
  }, [entries, search, selectedClass]);

  const buildEntryPayload = (form) => {
    const facultyMember = faculty.find((item) => item.id === form.facultyId);
    const classroom = classrooms.find((item) => item.id === form.classroomId);
    return {
      ...form,
      subject: form.subject.trim(),
      facultyName: facultyMember?.name || '',
      classroomName: classroom?.roomNo || '',
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
    if (hasTimetableConflict(entries, payload, editingEntry?.id)) {
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

  const publishTimetable = async () => {
    if (!canPublish) {
      toast.error('You do not have permission to publish timetables.');
      return;
    }
    const classKey = selectedClass === 'All' ? 'All Classes' : selectedClass;
    const payload = {
      classKey,
      status: 'Published',
      publishedAtText: formatDisplayDate(),
      entryCount: filteredEntries.filter((entry) => entry.status !== 'Archived').length,
    };
    try {
      const id = await createTimetablePublication(payload);
      setPublications((prev) => [{ id: id || `local-pub-${Date.now()}`, ...payload }, ...prev]);
      setEntries((prev) => prev.map((entry) => selectedClass === 'All' || entry.classKey === selectedClass ? { ...entry, status: 'Published' } : entry));
      toast.success('Timetable published');
    } catch {
      setPublications((prev) => [{ id: `local-pub-${Date.now()}`, ...payload }, ...prev]);
      setEntries((prev) => prev.map((entry) => selectedClass === 'All' || entry.classKey === selectedClass ? { ...entry, status: 'Published' } : entry));
      toast.success('Timetable published locally. Check Firebase setup to persist it.');
    }
  };

  const seedClassrooms = async () => {
    if (!canManageClassrooms) {
      toast.error('You do not have permission to manage classrooms.');
      return;
    }
    try {
      const missing = demoClassrooms.filter((room) => !classrooms.some((item) => item.roomNo === room.roomNo));
      await Promise.all(missing.map((room) => createClassroom(room)));
      setClassrooms((prev) => [...prev, ...missing]);
      toast.success(missing.length ? 'Classrooms synced' : 'Classrooms already available');
    } catch {
      toast.success('Classrooms available locally. Check Firebase setup to persist them.');
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
          <p className="text-sm text-slate-500 mt-1">Class timetable creation, faculty timetable, classroom allocation, and publishing.</p>
          {!isFirebaseConfigured && <p className="text-xs text-orange-600 mt-2">Demo mode: add Firebase keys to persist timetables.</p>}
          {loadError && <p className="text-xs text-rose-600 mt-2">{loadError}</p>}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={seedClassrooms} disabled={!canManageClassrooms} className="h-10 px-5 rounded-lg bg-[#33373e] text-white font-semibold text-sm disabled:bg-slate-300">
            Sync Classrooms
          </button>
          <button onClick={publishTimetable} disabled={!canPublish} className="h-10 px-5 rounded-lg bg-[#33373e] text-white font-semibold text-sm disabled:bg-slate-300">
            Publish
          </button>
          <button onClick={() => openEntryModal()} disabled={!canCreate} className="h-10 px-5 rounded-full bg-[#fb9a5b] text-white font-semibold text-sm flex items-center gap-2 disabled:bg-slate-300">
            <Plus size={16} /> New Entry
          </button>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-5">
        <div className="xl:w-[68%] min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-5">
            {['All', ...classOptions].map((classKey) => (
              <button
                key={classKey}
                onClick={() => setSelectedClass(classKey)}
                className={`h-10 px-4 rounded-md border text-sm ${selectedClass === classKey ? 'bg-[#33373e] text-white border-[#33373e]' : 'bg-white text-slate-600 border-slate-200'}`}
              >
                {classKey}
              </button>
            ))}
          </div>
          <div className="relative mb-4">
            <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search subject, faculty, classroom..." className="w-full h-11 rounded-lg bg-[#f0f0f2] border-0 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-orange-100" />
          </div>
          <TimetableGrid
            entries={filteredEntries}
            canCreate={canCreate}
            canEdit={canEdit}
            canArchive={canEdit}
            selectedClass={selectedClass}
            onCreate={openEntryModal}
            onEdit={setEditingEntry}
            onArchive={archiveEntry}
          />
        </div>

        <TimetableSidePanel classrooms={classrooms} facultyEntries={filteredEntries} publications={publications} selectedClass={selectedClass === 'All' ? '' : selectedClass} />
      </div>

      {showEntryModal && (
        <TimetableEntryModal
          classOptions={classOptions}
          classrooms={classrooms}
          faculty={faculty}
          initialValues={entryDefaults}
          onClose={() => {
            setShowEntryModal(false);
            setEntryDefaults({});
          }}
          onSave={saveEntry}
        />
      )}
      {editingEntry && (
        <TimetableEntryModal
          mode="edit"
          initialEntry={editingEntry}
          classOptions={classOptions}
          classrooms={classrooms}
          faculty={faculty}
          onClose={() => setEditingEntry(null)}
          onSave={saveEntry}
        />
      )}
    </div>
  );
}
