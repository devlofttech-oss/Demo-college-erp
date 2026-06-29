import { useEffect, useMemo, useState } from 'react';
import { Download, Plus, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { createAcademicCalendarEvent, getAcademicsData, updateAcademicCalendarEvent } from '../../firebase/db';
import { isFirebaseConfigured } from '../../firebase/config';
import { canAccess, defaultRoles } from '../userRoles/rolePermissions';
import StatusBadge from '../students/components/StatusBadge';
import { demoAcademicCalendarEvents } from '../academics/demoAcademics';
import { formatDisplayDate, validateCalendarEvent } from '../academics/academicUtils';
import { filterByCourse } from '../shared/courseFilters';

const eventTypes = ['Academic', 'Exam', 'Holiday', 'Admission', 'Activity'];
const audiences = ['All', 'Students', 'Faculty', 'Parents'];

function csvValue(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function CurriculumEventModal({ initialEvent = null, onClose, onSave }) {
  const [form, setForm] = useState({
    title: initialEvent?.title || '',
    eventType: initialEvent?.eventType || 'Academic',
    eventDate: initialEvent?.eventDate || new Date().toISOString().slice(0, 10),
    audience: initialEvent?.audience || 'All',
    status: initialEvent?.status || 'Draft',
  });

  const submit = (event) => {
    event.preventDefault();
    onSave(form);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-xl bg-white rounded-xl shadow-2xl border border-slate-200">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Add Curriculum Event</h2>
            <p className="text-sm text-slate-500">Create a calendar item for this academic year.</p>
          </div>
          <button type="button" onClick={onClose} className="h-9 w-9 rounded-full hover:bg-slate-100 text-slate-500">x</button>
        </div>
        <div className="p-6 grid sm:grid-cols-2 gap-4">
          <label className="sm:col-span-2">
            <span className="block text-xs font-semibold text-slate-500 mb-1.5">Title</span>
            <input value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm" />
          </label>
          <label>
            <span className="block text-xs font-semibold text-slate-500 mb-1.5">Type</span>
            <select value={form.eventType} onChange={(event) => setForm((prev) => ({ ...prev, eventType: event.target.value }))} className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm">
              {eventTypes.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label>
            <span className="block text-xs font-semibold text-slate-500 mb-1.5">Audience</span>
            <select value={form.audience} onChange={(event) => setForm((prev) => ({ ...prev, audience: event.target.value }))} className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm">
              {audiences.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label>
            <span className="block text-xs font-semibold text-slate-500 mb-1.5">Date</span>
            <input type="date" value={form.eventDate} onChange={(event) => setForm((prev) => ({ ...prev, eventDate: event.target.value }))} className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm" />
          </label>
          <label>
            <span className="block text-xs font-semibold text-slate-500 mb-1.5">Status</span>
            <select value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))} className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm">
              {['Draft', 'Active', 'Published'].map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="h-10 px-5 rounded-lg bg-slate-100 text-slate-700 font-semibold text-sm">Cancel</button>
          <button type="submit" className="h-10 px-5 rounded-lg bg-[#33373e] text-white font-semibold text-sm">Save Event</button>
        </div>
      </form>
    </div>
  );
}

export default function CurriculumManagement({ currentUser, academicYear = '2026-2027', selectedCourse = null, selectedCourseCode = 'all' }) {
  const [events, setEvents] = useState(isFirebaseConfigured ? [] : demoAcademicCalendarEvents);
  const [selectedEvent, setSelectedEvent] = useState(isFirebaseConfigured ? null : demoAcademicCalendarEvents[0] || null);
  const [showModal, setShowModal] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    const loadCurriculum = async () => {
      if (!isFirebaseConfigured) return;
      try {
        const data = await getAcademicsData(academicYear);
        if (data.academicCalendarEvents.length) {
          setEvents(data.academicCalendarEvents);
          setSelectedEvent(data.academicCalendarEvents[0]);
        }
      } catch (error) {
        console.warn('Using demo curriculum because Firestore is not reachable.', error);
        setLoadError('Unable to load Firestore curriculum records. Showing demo/local records.');
      }
    };
    loadCurriculum();
  }, [academicYear]);

  const currentRoleId = currentUser?.roleId || 'admin';
  const canManage = canAccess(defaultRoles, currentRoleId, 'academics.manage');

  const courseEvents = useMemo(() => filterByCourse(events, selectedCourseCode, selectedCourse), [events, selectedCourse, selectedCourseCode]);
  const sortedEvents = useMemo(() => [...courseEvents].sort((a, b) => String(a.eventDate).localeCompare(String(b.eventDate))), [courseEvents]);

  const saveEvent = async (form) => {
    if (!canManage) {
      toast.error('You do not have permission to manage curriculum.');
      return;
    }
    const payload = {
      ...form,
      title: form.title.trim(),
      academicYear,
      courseCode: selectedCourseCode === 'all' ? '' : selectedCourseCode,
      courseName: selectedCourse?.courseName || '',
      createdAtText: formatDisplayDate(),
    };
    const validationMessage = validateCalendarEvent(payload);
    if (validationMessage) {
      toast.error(validationMessage);
      return;
    }
    try {
      const id = await createAcademicCalendarEvent(payload);
      const created = { id: id || `local-curriculum-${Date.now()}`, ...payload };
      setEvents((prev) => [created, ...prev]);
      setSelectedEvent(created);
      toast.success('Curriculum event added');
    } catch {
      const created = { id: `local-curriculum-${Date.now()}`, ...payload };
      setEvents((prev) => [created, ...prev]);
      setSelectedEvent(created);
      toast.success('Curriculum event added locally');
    } finally {
      setShowModal(false);
    }
  };

  const publishCurriculum = async () => {
    if (!canManage) {
      toast.error('You do not have permission to publish curriculum.');
      return;
    }
    const updates = { status: 'Published', publishedAtText: formatDisplayDate() };
    const publishable = courseEvents.filter((item) => item.status !== 'Published');
    if (!publishable.length) {
      toast.success('Curriculum is already published');
      return;
    }
    try {
      await Promise.all(publishable.filter((item) => !String(item.id).startsWith('demo-') && !String(item.id).startsWith('local-')).map((item) => updateAcademicCalendarEvent(item.id, updates)));
      setEvents((prev) => prev.map((item) => item.status === 'Published' ? item : { ...item, ...updates }));
      setSelectedEvent((prev) => prev ? { ...prev, ...updates } : prev);
      toast.success('Curriculum published');
    } catch {
      setEvents((prev) => prev.map((item) => item.status === 'Published' ? item : { ...item, ...updates }));
      setSelectedEvent((prev) => prev ? { ...prev, ...updates } : prev);
      toast.success('Curriculum published locally');
    }
  };

  const downloadCurriculum = () => {
    const rows = [
      ['Title', 'Type', 'Date', 'Audience', 'Status'],
      ...sortedEvents.map((item) => [item.title, item.eventType, item.eventDate, item.audience, item.status]),
    ];
    const csv = rows.map((row) => row.map(csvValue).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `curriculum-${academicYear}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Curriculum downloaded');
  };

  return (
    <div>
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <div className="text-sm font-bold text-slate-500 mb-2">Academics / <span className="text-[#f39a5f]">Curriculum</span></div>
          <h1 className="text-2xl font-bold text-slate-900">Curriculum</h1>
          <p className="text-sm text-slate-500 mt-1">Calendar view for classes, tests, holidays, admissions, and academic events.</p>
          {!isFirebaseConfigured && <p className="text-xs text-orange-600 mt-2">Demo mode: add Firebase keys to persist curriculum events.</p>}
          {loadError && <p className="text-xs text-rose-600 mt-2">{loadError}</p>}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {canManage && (
            <>
              <button onClick={() => setShowModal(true)} className="h-10 px-5 rounded-full bg-[#fb9a5b] text-white font-semibold text-sm flex items-center gap-2">
                <Plus size={16} /> Add Event
              </button>
              <button onClick={publishCurriculum} className="h-10 px-5 rounded-lg bg-[#33373e] text-white font-semibold text-sm flex items-center gap-2">
                <Send size={16} /> Publish
              </button>
            </>
          )}
          <button onClick={downloadCurriculum} className="h-10 px-5 rounded-lg bg-[#33373e] text-white font-semibold text-sm flex items-center gap-2">
            <Download size={16} /> Download
          </button>
        </div>
      </div>

      <div className="grid xl:grid-cols-[1fr_340px] gap-5">
        <div className="erp-demo-table border border-slate-100 rounded-xl shadow-sm overflow-hidden">
          <div className="grid grid-cols-4 bg-[#101e26] text-sm font-bold text-slate-500">
            <div className="px-5 py-3">Item</div>
            <div className="px-5 py-3">Date</div>
            <div className="px-5 py-3">Audience</div>
            <div className="px-5 py-3">Status</div>
          </div>
          {sortedEvents.map((item) => (
            <button
              key={item.id}
              onClick={() => setSelectedEvent(item)}
              className="grid grid-cols-4 w-full text-left border-t border-slate-100 bg-transparent hover:bg-[#101e26] text-sm"
            >
              <div className="px-5 py-4 font-semibold text-slate-900">{item.title}</div>
              <div className="px-5 py-4 text-slate-600">{item.eventDate}</div>
              <div className="px-5 py-4 text-slate-600">{item.audience}</div>
              <div className="px-5 py-4"><StatusBadge value={item.status} /></div>
            </button>
          ))}
          {!sortedEvents.length && <div className="px-5 py-10 text-center text-sm text-slate-500">No curriculum events found.</div>}
        </div>

        <aside className="erp-sticky-inspector bg-white border border-slate-100 rounded-lg p-5 shadow-sm">
          <h3 className="font-bold text-slate-900 mb-4">Event Details</h3>
          {selectedEvent ? (
            <div className="space-y-3 text-sm">
              <div className="rounded-lg bg-[#f5f5f6] p-4">
                <div className="text-xs font-semibold text-slate-500">{selectedEvent.eventType}</div>
                <h2 className="text-xl font-bold text-slate-900 mt-2">{selectedEvent.title}</h2>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs text-slate-600">
                <div className="rounded-lg bg-[#f5f5f6] p-3">Date<br /><b>{selectedEvent.eventDate}</b></div>
                <div className="rounded-lg bg-[#f5f5f6] p-3">Audience<br /><b>{selectedEvent.audience}</b></div>
                <div className="rounded-lg bg-[#f5f5f6] p-3">Created<br /><b>{selectedEvent.createdAtText || '-'}</b></div>
                <div className="rounded-lg bg-[#f5f5f6] p-3">Status<br /><StatusBadge value={selectedEvent.status} /></div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg bg-[#f5f5f6] p-4 text-sm text-slate-500">Select an event to inspect it.</div>
          )}
        </aside>
      </div>

      {showModal && <CurriculumEventModal onClose={() => setShowModal(false)} onSave={saveEvent} />}
    </div>
  );
}
