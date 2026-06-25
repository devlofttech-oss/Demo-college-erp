import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, ClipboardList, FileText, GraduationCap, Plus, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  createExamSchedule,
  createInternalAssessment,
  createMarksEntry,
  createReportCard,
  createStudentResult,
  getExaminationResultData,
  updateExamSchedule,
  updateMarksEntry,
} from '../../firebase/db';
import { isFirebaseConfigured } from '../../firebase/config';
import { canAccess, defaultRoles } from '../userRoles/rolePermissions';
import { getClassOptions } from '../timetable/timetableUtils';
import { demoAssessments, demoExamSchedules, demoExamStaff, demoExamStudents, demoMarksEntries, demoReportCards, demoResults } from './demoExams';
import { calculateGrade, calculatePercentage, calculateResultStatus, formatDisplayDate, summarizeStudentMarks, validateExamSchedule, validateMarksEntry } from './examUtils';
import ExamScheduleModal from './components/ExamScheduleModal';
import ExamScheduleTable from './components/ExamScheduleTable';
import MarksEntryModal from './components/MarksEntryModal';
import ResultsPanel from './components/ResultsPanel';

export default function ExaminationResultManagement({ currentUser, academicYear = '2026-2027' }) {
  const [students, setStudents] = useState(isFirebaseConfigured ? [] : demoExamStudents);
  const [staff, setStaff] = useState(isFirebaseConfigured ? [] : demoExamStaff);
  const [schedules, setSchedules] = useState(isFirebaseConfigured ? [] : demoExamSchedules);
  const [, setAssessments] = useState(isFirebaseConfigured ? [] : demoAssessments);
  const [marks, setMarks] = useState(isFirebaseConfigured ? [] : demoMarksEntries);
  const [results, setResults] = useState(isFirebaseConfigured ? [] : demoResults);
  const [reportCards, setReportCards] = useState(isFirebaseConfigured ? [] : demoReportCards);
  const [search, setSearch] = useState('');
  const [loadError, setLoadError] = useState('');
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showMarksModal, setShowMarksModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [activeExamTask, setActiveExamTask] = useState('');
  const [activeExamBranch, setActiveExamBranch] = useState('');
  const [selectedScheduleId, setSelectedScheduleId] = useState('');

  useEffect(() => {
    const loadExams = async () => {
      if (!isFirebaseConfigured) return;
      try {
        const data = await getExaminationResultData(academicYear);
        if (data.students.length) setStudents(data.students.filter((student) => student.status !== 'Archived'));
        if (data.staff.length) setStaff(data.staff.filter((member) => member.staffType === 'Faculty' && member.status !== 'Archived'));
        setSchedules(data.examSchedules);
        setAssessments(data.assessments);
        setMarks(data.marks);
        setResults(data.results);
        setReportCards(data.reportCards);
      } catch (error) {
        console.warn('Using demo exam data because Firestore is not reachable.', error);
        setLoadError('Unable to load Firestore exam records. Showing demo/local records.');
      }
    };
    loadExams();
  }, [academicYear]);

  useEffect(() => {
    const currentState = window.history.state || {};
    window.history.replaceState({
      ...currentState,
      examFlow: currentState.examFlow || { task: '', branch: '' },
    }, '');

    const handleHistoryBack = (event) => {
      const flow = event.state?.examFlow;
      setShowScheduleModal(false);
      setShowMarksModal(false);
      setEditingSchedule(null);
      if (!flow) {
        setActiveExamTask('');
        setActiveExamBranch('');
        setSelectedScheduleId('');
        return;
      }
      setActiveExamTask(flow.task || '');
      setActiveExamBranch(flow.branch || '');
      setSelectedScheduleId('');
      setSearch('');
    };

    window.addEventListener('popstate', handleHistoryBack);
    return () => window.removeEventListener('popstate', handleHistoryBack);
  }, []);

  const currentRoleId = currentUser?.roleId || 'admin';
  const canSchedule = canAccess(defaultRoles, currentRoleId, 'exams.schedule');
  const canAssess = canAccess(defaultRoles, currentRoleId, 'exams.assessments');
  const canEnterMarks = canAccess(defaultRoles, currentRoleId, 'exams.marks');
  const canGenerateResults = canAccess(defaultRoles, currentRoleId, 'exams.results');
  const canGenerateReportCards = canAccess(defaultRoles, currentRoleId, 'exams.reportCards');

  const classOptions = getClassOptions(students);
  const faculty = staff.filter((member) => member.staffType === 'Faculty');
  const filteredSchedules = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return schedules;
    return schedules.filter((schedule) =>
      [schedule.examName, schedule.classKey, schedule.subject, schedule.facultyName]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(term))
    );
  }, [schedules, search]);

  const selectedSchedule = selectedScheduleId ? schedules.find((schedule) => schedule.id === selectedScheduleId) || null : null;
  const selectedScheduleMarks = selectedSchedule
    ? marks.filter((mark) => mark.examScheduleId === selectedSchedule.id)
    : [];

  const openExamTask = (taskId) => {
    setActiveExamTask(taskId);
    setActiveExamBranch('');
    setSelectedScheduleId('');
    setSearch('');
    window.history.pushState({ ...(window.history.state || {}), examFlow: { task: taskId, branch: '' } }, '');
  };

  const openExamBranch = (branch) => {
    setActiveExamBranch(branch.id);
    setSelectedScheduleId('');
    setSearch('');
    window.history.pushState({ ...(window.history.state || {}), examFlow: { task: activeExamTask, branch: branch.id } }, '');
    if (branch.openSchedule) setShowScheduleModal(true);
    if (branch.openMarks) setShowMarksModal(true);
  };

  const goBackOneExamStep = () => {
    if (window.history.state?.examFlow) {
      window.history.back();
      return;
    }
    if (activeExamBranch) {
      setActiveExamBranch('');
      setSelectedScheduleId('');
      return;
    }
    setActiveExamTask('');
  };

  const examTaskOptions = [
    {
      id: 'schedules',
      title: 'Exam Schedules',
      description: 'Create and review exam schedules.',
      icon: <ClipboardList size={22} />,
      meta: [`${schedules.length} schedules`, canSchedule ? 'Schedule enabled' : 'View only'],
    },
    {
      id: 'marks',
      title: 'Marks Entry',
      description: 'Enter and review student marks.',
      icon: <GraduationCap size={22} />,
      meta: [`${marks.length} entries`, canEnterMarks ? 'Entry enabled' : 'View only'],
    },
    {
      id: 'results',
      title: 'Results & Cards',
      description: 'Generate results and report cards.',
      icon: <FileText size={22} />,
      meta: [`${results.length} results`, `${reportCards.length} cards`],
    },
  ];

  const examBranchOptions = {
    schedules: [
      { id: 'create-schedule', title: 'Create Schedule', description: 'Open a new exam schedule form.', icon: <Plus size={20} />, disabled: !canSchedule, openSchedule: true },
      { id: 'review-schedules', title: 'Review Schedules', description: 'Select an exam schedule to view or edit.', icon: <ClipboardList size={20} /> },
    ],
    marks: [
      { id: 'enter-marks', title: 'Enter Marks', description: 'Open marks entry, or select a schedule first.', icon: <GraduationCap size={20} />, disabled: !canEnterMarks, openMarks: true },
      { id: 'review-marks', title: 'Review Marks', description: 'Select a schedule to review entered marks.', icon: <Search size={20} /> },
      { id: 'internal-assessment', title: 'Internal Assessment', description: 'Create an internal assessment from an exam schedule.', icon: <FileText size={20} />, disabled: !canAssess },
    ],
    results: [
      { id: 'generate-results', title: 'Generate Results', description: 'Generate combined student results.', icon: <FileText size={20} />, disabled: !canGenerateResults },
      { id: 'report-cards', title: 'Report Cards', description: 'Generate and review report cards.', icon: <FileText size={20} />, disabled: !canGenerateReportCards },
    ],
  };

  const activeTask = examTaskOptions.find((task) => task.id === activeExamTask);
  const activeBranches = examBranchOptions[activeExamTask] || [];
  const activeBranch = activeBranches.find((branch) => branch.id === activeExamBranch);
  const branchAccentText = activeExamTask === 'schedules'
    ? 'Schedule work'
    : activeExamTask === 'marks'
      ? 'Marks work'
      : 'Result work';

  const buildSchedulePayload = (form) => {
    const facultyMember = faculty.find((item) => item.id === form.facultyId);
    return {
      ...form,
      examName: form.examName.trim(),
      subject: form.subject.trim(),
      maxMarks: Number(form.maxMarks),
      facultyName: facultyMember?.name || '',
      status: form.status || 'Scheduled',
    };
  };

  const saveSchedule = async (form) => {
    if (!canSchedule && !editingSchedule) {
      toast.error('You do not have permission to schedule exams.');
      return;
    }
    const validationMessage = validateExamSchedule(form);
    if (validationMessage) {
      toast.error(validationMessage);
      return;
    }
    const payload = buildSchedulePayload(form);
    if (editingSchedule) {
      const updates = { ...payload, updatedAtText: formatDisplayDate() };
      try {
        await updateExamSchedule(editingSchedule.id, updates);
        setSchedules((prev) => prev.map((item) => item.id === editingSchedule.id ? { ...item, ...updates } : item));
        toast.success('Exam schedule updated');
      } catch {
        setSchedules((prev) => prev.map((item) => item.id === editingSchedule.id ? { ...item, ...updates } : item));
        toast.success('Exam schedule updated locally');
      } finally {
        setEditingSchedule(null);
      }
      return;
    }
    const createPayload = { ...payload, academicYear, createdAtText: formatDisplayDate() };
    try {
      const id = await createExamSchedule(createPayload);
      setSchedules((prev) => [{ id: id || `local-exam-${Date.now()}`, ...createPayload }, ...prev]);
      toast.success('Exam scheduled');
    } catch {
      setSchedules((prev) => [{ id: `local-exam-${Date.now()}`, ...createPayload }, ...prev]);
      toast.success('Exam scheduled locally');
    } finally {
      setShowScheduleModal(false);
    }
  };

  const createAssessment = async () => {
    if (!canAssess) {
      toast.error('You do not have permission to manage assessments.');
      return;
    }
    const base = schedules[0];
    if (!base) {
      toast.error('Create an exam schedule first.');
      return;
    }
    const payload = {
      title: `${base.subject} Internal Assessment`,
      classKey: base.classKey,
      subject: base.subject,
      maxMarks: 20,
      status: 'Active',
      academicYear,
      createdAtText: formatDisplayDate(),
    };
    try {
      const id = await createInternalAssessment(payload);
      setAssessments((prev) => [{ id: id || `local-assessment-${Date.now()}`, ...payload }, ...prev]);
      toast.success('Assessment created');
    } catch {
      setAssessments((prev) => [{ id: `local-assessment-${Date.now()}`, ...payload }, ...prev]);
      toast.success('Assessment created locally');
    }
  };

  const saveMarks = async (form) => {
    if (!canEnterMarks) {
      toast.error('You do not have permission to enter marks.');
      return;
    }
    const schedule = schedules.find((item) => item.id === form.examScheduleId);
    const student = students.find((item) => item.id === form.studentRecordId);
    const validationMessage = validateMarksEntry({ ...form, maxMarks: schedule?.maxMarks || form.maxMarks });
    if (validationMessage) {
      toast.error(validationMessage);
      return;
    }
    const percentage = calculatePercentage(form.marksObtained, schedule.maxMarks);
    const payload = {
      examScheduleId: schedule.id,
      studentRecordId: student.id,
      studentId: student.studentId,
      studentName: student.name,
      classKey: schedule.classKey,
      subject: schedule.subject,
      academicYear,
      marksObtained: Number(form.marksObtained),
      maxMarks: Number(schedule.maxMarks),
      percentage,
      grade: calculateGrade(percentage),
      status: 'Entered',
      enteredAtText: formatDisplayDate(),
    };
    const existing = marks.find((item) => item.examScheduleId === payload.examScheduleId && item.studentRecordId === payload.studentRecordId);
    try {
      if (existing) {
        await updateMarksEntry(existing.id, payload);
        setMarks((prev) => prev.map((item) => item.id === existing.id ? { ...item, ...payload } : item));
      } else {
        const id = await createMarksEntry(payload);
        setMarks((prev) => [{ id: id || `local-marks-${Date.now()}`, ...payload }, ...prev]);
      }
      toast.success('Marks saved');
    } catch {
      setMarks((prev) => existing
        ? prev.map((item) => item.id === existing.id ? { ...item, ...payload } : item)
        : [{ id: `local-marks-${Date.now()}`, ...payload }, ...prev]);
      toast.success('Marks saved locally');
    } finally {
      setShowMarksModal(false);
    }
  };

  const generateResults = async () => {
    if (!canGenerateResults) {
      toast.error('You do not have permission to generate results.');
      return;
    }
    const generated = students.map((student) => {
      const studentMarks = marks.filter((item) => item.studentRecordId === student.id);
      const summary = summarizeStudentMarks(studentMarks);
      return {
        studentRecordId: student.id,
        studentId: student.studentId,
        studentName: student.name,
        classKey: `${student.className} - ${student.section}`,
        examName: 'Combined Result',
        academicYear,
        ...summary,
        status: calculateResultStatus(summary.percentage),
        generatedAtText: formatDisplayDate(),
      };
    }).filter((item) => item.totalMax > 0);
    try {
      const ids = await Promise.all(generated.map((item) => createStudentResult(item)));
      setResults((prev) => [...generated.map((item, index) => ({ id: ids[index] || `local-result-${Date.now()}-${index}`, ...item })), ...prev]);
      toast.success('Results generated');
    } catch {
      setResults((prev) => [...generated.map((item, index) => ({ id: `local-result-${Date.now()}-${index}`, ...item })), ...prev]);
      toast.success('Results generated locally');
    }
  };

  const generateReportCards = async () => {
    if (!canGenerateReportCards) {
      toast.error('You do not have permission to generate report cards.');
      return;
    }
    const cards = results.map((result) => ({
      studentRecordId: result.studentRecordId,
      studentId: result.studentId,
      examName: result.examName,
      academicYear,
      status: 'Generated',
      generatedAtText: formatDisplayDate(),
    }));
    try {
      const ids = await Promise.all(cards.map((item) => createReportCard(item)));
      setReportCards((prev) => [...cards.map((item, index) => ({ id: ids[index] || `local-card-${Date.now()}-${index}`, ...item })), ...prev]);
      toast.success('Report cards generated');
    } catch {
      setReportCards((prev) => [...cards.map((item, index) => ({ id: `local-card-${Date.now()}-${index}`, ...item })), ...prev]);
      toast.success('Report cards generated locally');
    }
  };

  return (
    <div>
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <div className="text-sm font-bold text-slate-500 mb-2">Academics / <span className="text-[#f39a5f]">Examination & Result Management</span></div>
          <h1 className="text-2xl font-bold text-slate-900">Examination & Result Management</h1>
          <p className="text-sm text-slate-500 mt-1">Exam scheduling, internal assessment, marks entry, grade calculation, results, and report cards.</p>
          {!isFirebaseConfigured && <p className="text-xs text-orange-600 mt-2">Demo mode: add Firebase keys to persist exams and results.</p>}
          {loadError && <p className="text-xs text-rose-600 mt-2">{loadError}</p>}
        </div>
      </div>

      {!activeExamTask ? (
      <>
      <div className="grid md:grid-cols-3 gap-4">
        {examTaskOptions.map((task) => (
          <button key={task.id} onClick={() => openExamTask(task.id)} className="group min-h-40 text-left rounded-lg border border-slate-100 bg-white p-5 shadow-sm hover:-translate-y-1 transition-all">
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
      ) : !activeExamBranch ? (
      <>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 my-5 rounded-lg bg-[#f5f5f6] p-4">
        <div>
          <div className="text-xs font-bold text-slate-500">Exams / <span className="text-[#fb8d49]">{activeTask?.title}</span></div>
          <h2 className="text-lg font-bold text-slate-900 mt-1">Choose next step</h2>
        </div>
        <button onClick={goBackOneExamStep} className="h-10 px-4 rounded-lg bg-white border border-slate-200 text-slate-700 font-semibold text-sm flex items-center gap-2">
          <ArrowLeft size={15} /> Back
        </button>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {activeBranches.map((branch) => (
          <button
            key={branch.id}
            onClick={() => openExamBranch(branch)}
            disabled={branch.disabled}
            className="group min-h-36 text-left rounded-lg border border-slate-100 bg-white p-5 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="h-11 w-11 rounded-lg bg-[#f5f5f6] text-[#34363d] flex items-center justify-center">{branch.icon}</div>
              <ArrowRight size={17} className="text-slate-400 group-hover:text-[#fb8d49]" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mt-4">{branch.title}</h3>
            <p className="text-sm text-slate-500 mt-2">{branch.disabled ? 'Not available right now.' : branch.description}</p>
          </button>
        ))}
      </div>
      </>
      ) : (
      <>
      <div className="erp-branch-focus flex flex-col lg:flex-row lg:items-center justify-between gap-4 my-5 rounded-lg bg-[#f5f5f6] p-5 border border-slate-100">
        <div className="flex items-center gap-4 min-w-0">
          <div className="erp-branch-icon h-16 w-16 rounded-lg bg-white text-[#fb8d49] flex items-center justify-center shrink-0">{activeBranch?.icon}</div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-slate-500">Exams / {activeTask?.title}</div>
            <h2 className="text-2xl font-extrabold text-slate-900 mt-1">{activeBranch?.title}</h2>
            <p className="text-sm text-slate-500 mt-1">{activeBranch?.description}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="h-10 px-4 rounded-full bg-white border border-slate-200 text-slate-700 font-bold text-xs flex items-center">{branchAccentText}</span>
          {activeExamBranch === 'create-schedule' && canSchedule && (
            <button onClick={() => setShowScheduleModal(true)} className="h-10 px-4 rounded-full bg-[#fb9a5b] text-white font-semibold text-sm flex items-center gap-2"><Plus size={16} /> Open Form</button>
          )}
          <button onClick={goBackOneExamStep} className="h-10 px-4 rounded-lg bg-white border border-slate-200 text-slate-700 font-semibold text-sm flex items-center gap-2">
            <ArrowLeft size={15} /> Back
          </button>
        </div>
      </div>

      {['generate-results', 'report-cards', 'internal-assessment'].includes(activeExamBranch) ? (
        <div className="max-w-3xl">
          <ResultsPanel marks={marks} results={results} reportCards={reportCards} />
          <div className="grid sm:grid-cols-2 gap-3 mt-5">
            {activeExamBranch === 'internal-assessment' && (
              <button onClick={createAssessment} disabled={!canAssess} className="h-11 rounded-full bg-[#fb9a5b] text-white font-semibold text-sm disabled:bg-slate-300">Create Assessment</button>
            )}
            {activeExamBranch === 'generate-results' && (
              <button onClick={generateResults} disabled={!canGenerateResults} className="h-11 rounded-full bg-[#fb9a5b] text-white font-semibold text-sm disabled:bg-slate-300">Generate Results</button>
            )}
            {activeExamBranch === 'report-cards' && (
              <button onClick={generateReportCards} disabled={!canGenerateReportCards} className="h-11 rounded-full bg-[#fb9a5b] text-white font-semibold text-sm disabled:bg-slate-300">Generate Report Cards</button>
            )}
          </div>
        </div>
      ) : (
      <div className="flex flex-col xl:flex-row gap-5">
        <div className="xl:w-[68%] min-w-0">
          <div className="relative mb-4">
            <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search exams, classes, subjects, faculty..." className="w-full h-11 rounded-lg bg-[#f0f0f2] border-0 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-orange-100" />
          </div>
          <ExamScheduleTable schedules={filteredSchedules} canEdit={canSchedule} showActions={false} selectedId={selectedScheduleId} onSelect={setSelectedScheduleId} onEdit={setEditingSchedule} />
        </div>
        <aside className="xl:w-[32%]">
          {selectedSchedule ? (
            <div className="erp-selected-detail bg-white border border-slate-100 rounded-lg p-5 shadow-sm">
              <h3 className="font-bold text-slate-900">{selectedSchedule.examName}</h3>
              <p className="text-xs text-slate-500 mt-1">{selectedSchedule.classKey} | {selectedSchedule.subject}</p>
              <div className="grid grid-cols-2 gap-3 text-sm mt-5">
                <div className="rounded-lg bg-[#f5f5f6] p-3"><div className="text-xs text-slate-500">Date</div><b>{selectedSchedule.examDate}</b></div>
                <div className="rounded-lg bg-[#f5f5f6] p-3"><div className="text-xs text-slate-500">Max Marks</div><b>{selectedSchedule.maxMarks}</b></div>
                <div className="rounded-lg bg-[#f5f5f6] p-3"><div className="text-xs text-slate-500">Faculty</div><b>{selectedSchedule.facultyName || '-'}</b></div>
                <div className="rounded-lg bg-[#f5f5f6] p-3"><div className="text-xs text-slate-500">Marks</div><b>{selectedScheduleMarks.length}</b></div>
              </div>
              {activeExamBranch === 'review-schedules' && (
                <button onClick={() => setEditingSchedule(selectedSchedule)} disabled={!canSchedule} className="mt-5 w-full h-10 rounded-full bg-[#fb9a5b] text-white font-semibold text-sm disabled:bg-slate-300">Edit Schedule</button>
              )}
              {activeExamBranch === 'review-marks' && (
                <button onClick={() => setShowMarksModal(true)} disabled={!canEnterMarks} className="mt-5 w-full h-10 rounded-full bg-[#fb9a5b] text-white font-semibold text-sm disabled:bg-slate-300">Enter Marks</button>
              )}
              {activeExamBranch === 'enter-marks' && (
                <button onClick={() => setShowMarksModal(true)} disabled={!canEnterMarks} className="mt-5 w-full h-10 rounded-full bg-[#fb9a5b] text-white font-semibold text-sm disabled:bg-slate-300">Open Marks Entry</button>
              )}
            </div>
          ) : (
            <div className="bg-white border border-slate-100 rounded-lg p-6 shadow-sm text-sm text-slate-600 min-h-72 flex flex-col items-center justify-center text-center">
              <div className="h-14 w-14 rounded-lg bg-[#f5f5f6] text-[#fb8d49] flex items-center justify-center mb-4">{activeBranch?.icon}</div>
              <h3 className="font-bold text-slate-900 mb-2">Exam Details</h3>
              <p>{filteredSchedules.length ? 'Click an exam schedule row to view details and available actions.' : 'No matching exam schedules found.'}</p>
            </div>
          )}
        </aside>
      </div>
      )}
      </>
      )}

      {showScheduleModal && <ExamScheduleModal classOptions={classOptions} faculty={faculty} onClose={() => setShowScheduleModal(false)} onSave={saveSchedule} />}
      {editingSchedule && <ExamScheduleModal mode="edit" initialSchedule={editingSchedule} classOptions={classOptions} faculty={faculty} onClose={() => setEditingSchedule(null)} onSave={saveSchedule} />}
      {showMarksModal && <MarksEntryModal schedules={schedules} students={students} onClose={() => setShowMarksModal(false)} onSave={saveMarks} />}
    </div>
  );
}
