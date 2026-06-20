import { useEffect, useMemo, useState } from 'react';
import { BookOpen, CalendarDays, GraduationCap, Layers, Plus, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { createAcademicBatch, createAcademicCalendarEvent, createAcademicProgram, createAcademicSubject, getAcademicsData } from '../../firebase/db';
import { isFirebaseConfigured } from '../../firebase/config';
import { canAccess, defaultRoles } from '../userRoles/rolePermissions';
import StatusBadge from '../students/components/StatusBadge';
import { demoAcademicBatches, demoAcademicCalendarEvents, demoAcademicPrograms, demoAcademicSubjects } from './demoAcademics';
import { filterAcademicItems, formatDisplayDate, summarizeAcademics, validateBatch, validateCalendarEvent, validateProgram, validateSubject } from './academicUtils';

const tabs = [
  ['programs', 'Programs'],
  ['subjects', 'Subjects'],
  ['batches', 'Batches'],
  ['calendar', 'Calendar'],
];

export default function AcademicsManagement({ currentUser, academicYear = '2026-2027' }) {
  const [programs, setPrograms] = useState(demoAcademicPrograms);
  const [subjects, setSubjects] = useState(demoAcademicSubjects);
  const [batches, setBatches] = useState(demoAcademicBatches);
  const [events, setEvents] = useState(demoAcademicCalendarEvents);
  const [activeTab, setActiveTab] = useState('programs');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    const loadAcademics = async () => {
      try {
        const data = await getAcademicsData(academicYear);
        setPrograms(data.academicPrograms);
        setSubjects(data.academicSubjects);
        setBatches(data.academicBatches);
        setEvents(data.academicCalendarEvents);
      } catch (error) {
        console.warn('Using demo academic data because Firestore is not reachable.', error);
        setLoadError('Unable to load Firestore academic records. Showing demo/local records.');
      } finally {
        setLoading(false);
      }
    };
    loadAcademics();
  }, [academicYear]);

  const currentRoleId = currentUser?.roleId || 'admin';
  const canManage = canAccess(defaultRoles, currentRoleId, 'academics.manage');
  const summary = summarizeAcademics(programs, subjects, batches, events);
  const activeRows = useMemo(() => {
    const map = { programs, subjects, batches, calendar: events };
    return filterAcademicItems(map[activeTab] || [], search);
  }, [activeTab, batches, events, programs, search, subjects]);

  const stats = [
    { label: 'Programs', value: summary.programs, icon: <GraduationCap size={22} /> },
    { label: 'Subjects', value: summary.subjects, icon: <BookOpen size={22} /> },
    { label: 'Batches', value: summary.batches, icon: <Layers size={22} /> },
    { label: 'Published Events', value: summary.publishedEvents, icon: <CalendarDays size={22} /> },
  ];

  const createQuickRecord = async () => {
    if (!canManage) {
      toast.error('You do not have permission to manage academics.');
      return;
    }
    const createdAtText = formatDisplayDate();
    try {
      if (activeTab === 'programs') {
        const payload = { name: `Academic Program ${programs.length + 1}`, code: `PRG-${programs.length + 1}`, academicYear, status: 'Active', createdAtText };
        const message = validateProgram(payload);
        if (message) return toast.error(message);
        const id = await createAcademicProgram(payload);
        setPrograms((prev) => [{ id: id || `local-program-${Date.now()}`, ...payload }, ...prev]);
      } else if (activeTab === 'subjects') {
        const payload = { subjectName: `Subject ${subjects.length + 1}`, subjectCode: `SUB-${subjects.length + 1}`, programName: programs[0]?.name || 'General', creditHours: 5, academicYear, status: 'Active', createdAtText };
        const message = validateSubject(payload);
        if (message) return toast.error(message);
        const id = await createAcademicSubject(payload);
        setSubjects((prev) => [{ id: id || `local-subject-${Date.now()}`, ...payload }, ...prev]);
      } else if (activeTab === 'batches') {
        const payload = { className: `Class ${batches.length + 1}`, section: 'A', programName: programs[0]?.name || 'General', classTeacher: 'Unassigned', capacity: 45, academicYear, status: 'Active', createdAtText };
        const message = validateBatch(payload);
        if (message) return toast.error(message);
        const id = await createAcademicBatch(payload);
        setBatches((prev) => [{ id: id || `local-batch-${Date.now()}`, ...payload }, ...prev]);
      } else {
        const payload = { title: `Academic Event ${events.length + 1}`, eventType: 'Academic', eventDate: new Date().toISOString().slice(0, 10), audience: 'All', academicYear, status: 'Published', createdAtText };
        const message = validateCalendarEvent(payload);
        if (message) return toast.error(message);
        const id = await createAcademicCalendarEvent(payload);
        setEvents((prev) => [{ id: id || `local-event-${Date.now()}`, ...payload }, ...prev]);
      }
      toast.success('Academic record created');
    } catch {
      toast.success('Academic record created locally');
    }
  };

  const renderRow = (item) => {
    if (activeTab === 'programs') return [item.name, item.code, item.academicYear, item.status];
    if (activeTab === 'subjects') return [item.subjectName, item.subjectCode, item.programName, item.status];
    if (activeTab === 'batches') return [`${item.className} - ${item.section}`, item.programName, item.classTeacher, item.status];
    return [item.title, item.eventType, item.eventDate, item.status];
  };

  return (
    <div>
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <div className="text-sm font-bold text-slate-500 mb-2">Academics / <span className="text-[#f39a5f]">Academic Setup</span></div>
          <h1 className="text-2xl font-bold text-slate-900">Academics</h1>
          <p className="text-sm text-slate-500 mt-1">Programs, subjects, batches, sections, and academic calendar setup.</p>
          {!isFirebaseConfigured && <p className="text-xs text-orange-600 mt-2">Demo mode: add Firebase keys to persist academic setup.</p>}
          {loadError && <p className="text-xs text-rose-600 mt-2">{loadError}</p>}
        </div>
        <button onClick={createQuickRecord} disabled={!canManage} className="h-10 px-5 rounded-full bg-[#fb9a5b] text-white font-semibold text-sm flex items-center gap-2 disabled:bg-slate-300">
          <Plus size={16} /> Create {tabs.find(([id]) => id === activeTab)?.[1]}
        </button>
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 py-5">
        {stats.map(({ label, value, icon }) => (
          <div key={label} className="bg-[#f5f5f6] rounded-lg p-4 flex items-center gap-4">
            <div className="h-12 w-12 bg-white rounded-lg flex items-center justify-center text-[#34363d] shadow-sm">{icon}</div>
            <div><div className="text-xs text-slate-500">{label}</div><div className="text-xl font-bold">{loading ? '...' : value}</div></div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {tabs.map(([id, label]) => (
          <button key={id} onClick={() => setActiveTab(id)} className={`h-10 px-4 rounded-md border text-sm font-semibold ${activeTab === id ? 'bg-[#33373e] text-white border-[#33373e]' : 'bg-white text-slate-600 border-slate-200'}`}>{label}</button>
        ))}
      </div>
      <div className="relative mb-4">
        <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search academics..." className="w-full h-11 rounded-lg bg-[#f0f0f2] border-0 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-orange-100" />
      </div>
      <div className="overflow-hidden border border-slate-100 rounded-lg bg-white">
        <table className="w-full text-sm">
          <thead className="bg-[#f5f5f6] text-slate-500">
            <tr>{['Name', 'Code/Type', 'Owner/Year', 'Status'].map((item) => <th key={item} className="text-left px-4 py-3 font-semibold">{item}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {activeRows.map((item) => {
              const [a, b, c, d] = renderRow(item);
              return <tr key={item.id} className="hover:bg-slate-50"><td className="px-4 py-3 font-semibold">{a}</td><td className="px-4 py-3">{b}</td><td className="px-4 py-3">{c}</td><td className="px-4 py-3"><StatusBadge value={d} /></td></tr>;
            })}
            {!activeRows.length && <tr><td colSpan="4" className="px-4 py-10 text-center text-slate-500">No academic records found.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
