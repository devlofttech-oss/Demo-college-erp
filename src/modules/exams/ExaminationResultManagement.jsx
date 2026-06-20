import { useEffect, useMemo, useState } from 'react';
import { ClipboardList, FileText, GraduationCap, Plus, Search } from 'lucide-react';
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
  const [students, setStudents] = useState(demoExamStudents);
  const [staff, setStaff] = useState(demoExamStaff);
  const [schedules, setSchedules] = useState(demoExamSchedules);
  const [assessments, setAssessments] = useState(demoAssessments);
  const [marks, setMarks] = useState(demoMarksEntries);
  const [results, setResults] = useState(demoResults);
  const [reportCards, setReportCards] = useState(demoReportCards);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showMarksModal, setShowMarksModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);

  useEffect(() => {
    const loadExams = async () => {
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
      } finally {
        setLoading(false);
      }
    };
    loadExams();
  }, [academicYear]);

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

  const stats = [
    { label: 'Schedules', value: schedules.length, icon: <ClipboardList size={22} /> },
    { label: 'Assessments', value: assessments.length, icon: <FileText size={22} /> },
    { label: 'Marks Entries', value: marks.length, icon: <GraduationCap size={22} /> },
    { label: 'Report Cards', value: reportCards.length, icon: <FileText size={22} /> },
  ];

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
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={createAssessment} disabled={!canAssess} className="h-10 px-5 rounded-lg bg-[#33373e] text-white font-semibold text-sm disabled:bg-slate-300">Assessment</button>
          <button onClick={generateResults} disabled={!canGenerateResults} className="h-10 px-5 rounded-lg bg-[#33373e] text-white font-semibold text-sm disabled:bg-slate-300">Generate Results</button>
          <button onClick={generateReportCards} disabled={!canGenerateReportCards} className="h-10 px-5 rounded-lg bg-[#33373e] text-white font-semibold text-sm disabled:bg-slate-300">Report Cards</button>
          <button onClick={() => setShowMarksModal(true)} disabled={!canEnterMarks} className="h-10 px-5 rounded-full bg-[#fb9a5b] text-white font-semibold text-sm disabled:bg-slate-300">Marks Entry</button>
          <button onClick={() => setShowScheduleModal(true)} disabled={!canSchedule} className="h-10 px-5 rounded-full bg-[#fb9a5b] text-white font-semibold text-sm flex items-center gap-2 disabled:bg-slate-300"><Plus size={16} /> Schedule</button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 py-5">
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

      <div className="flex flex-col xl:flex-row gap-5">
        <div className="xl:w-[68%] min-w-0">
          <div className="relative mb-4">
            <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search exams, classes, subjects, faculty..." className="w-full h-11 rounded-lg bg-[#f0f0f2] border-0 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-orange-100" />
          </div>
          <ExamScheduleTable schedules={filteredSchedules} canEdit={canSchedule} onEdit={setEditingSchedule} />
        </div>
        <ResultsPanel marks={marks} results={results} reportCards={reportCards} />
      </div>

      {showScheduleModal && <ExamScheduleModal classOptions={classOptions} faculty={faculty} onClose={() => setShowScheduleModal(false)} onSave={saveSchedule} />}
      {editingSchedule && <ExamScheduleModal mode="edit" initialSchedule={editingSchedule} classOptions={classOptions} faculty={faculty} onClose={() => setEditingSchedule(null)} onSave={saveSchedule} />}
      {showMarksModal && <MarksEntryModal schedules={schedules} students={students} onClose={() => setShowMarksModal(false)} onSave={saveMarks} />}
    </div>
  );
}
