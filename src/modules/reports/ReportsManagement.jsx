import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, BookOpen, CalendarDays, ClipboardList, Download, FileText, GraduationCap } from 'lucide-react';
import toast from 'react-hot-toast';
import AttendanceReports from '../attendance/components/AttendanceReports';
import {
  ATTENDANCE_STATUSES,
  formatAttendanceDateInput,
  formatAttendanceTimeRange,
  getAttendanceDateInput,
  getAttendanceReportDateText,
  normalizeAttendanceStatus,
  summarizeAttendance,
} from '../attendance/attendanceUtils';
import FinancialReports from '../financialReports/FinancialReports';
import StatusBadge from '../students/components/StatusBadge';
import { canAccess, canAccessFinancialReports, defaultRoles } from '../userRoles/rolePermissions';
import { downloadCsv, openPrintableReport, sanitizeFilenamePart } from '../shared/reportExport';

function getAttendanceDayLabel(selectedDate = '') {
  return formatAttendanceDateInput(selectedDate) || 'No date selected';
}

function getAttendanceRangeLabel(fromDate = '', toDate = '') {
  const fromText = formatAttendanceDateInput(fromDate);
  const toText = formatAttendanceDateInput(toDate);
  if (fromDate && toDate && fromDate === toDate) return fromText;
  if (fromDate && toDate) return `${fromText} to ${toText}`;
  if (fromDate) return `From ${fromText}`;
  if (toDate) return `Until ${toText}`;
  return 'No report range selected';
}

function getAvailableAttendanceDates(records = []) {
  return [...new Set(records.map(getAttendanceDateInput).filter(Boolean))].sort();
}

function getAttendanceStatus(record = {}) {
  return normalizeAttendanceStatus(record.status) || 'Unmarked';
}

function recordMatchesAttendanceFilters(record = {}, statusFilter = 'all', searchTerm = '') {
  const normalizedStatus = String(statusFilter || 'all').toLowerCase();
  if (normalizedStatus !== 'all' && getAttendanceStatus(record).toLowerCase() !== normalizedStatus) return false;

  const term = String(searchTerm || '').trim().toLowerCase();
  if (!term) return true;
  return [
    record.entityName,
    record.studentName,
    record.entityId,
    record.studentId,
    record.admissionNo,
    record.semester,
    record.className,
    record.subjectName,
    record.subject,
    record.topic,
    record.facultyName,
  ].filter(Boolean).some((value) => String(value).toLowerCase().includes(term));
}

function buildAttendanceDetailRow(record = {}, index = 0) {
  const studentName = record.entityName || record.studentName || record.name || record.student || 'Unknown student';
  const studentId = record.entityId || record.studentId || record.admissionNo || '-';
  const subject = record.subjectName || record.subject || (record.attendanceScope === 'general' ? 'General Attendance' : '-');
  const dateInput = getAttendanceDateInput(record);
  return {
    classLabel: record.semester || record.className || record.classKey || 'Unassigned',
    date: getAttendanceReportDateText(record),
    dateInput,
    faculty: record.facultyName || '-',
    id: record.id || `${studentId}-${dateInput || index}-${index}`,
    status: getAttendanceStatus(record),
    studentId,
    studentName,
    subject,
    time: formatAttendanceTimeRange(record) || '-',
    topic: record.topic || record.syllabusTopic || '-',
  };
}

function sortAttendanceDetailRows(first, second) {
  return (
    (second.dateInput || '').localeCompare(first.dateInput || '')
    || first.studentName.localeCompare(second.studentName)
    || first.subject.localeCompare(second.subject)
  );
}

const ATTENDANCE_DETAIL_HEADERS = ['Date', 'Student', 'Student ID', 'Semester / Class', 'Subject', 'Time', 'Topic', 'Faculty', 'Status'];

function toAttendanceDetailCells(row) {
  return [row.date, row.studentName, row.studentId, row.classLabel, row.subject, row.time, row.topic, row.faculty, row.status];
}

function openAttendancePdf({ rows = [], summary = {}, subtitle = '', title = 'Attendance Report' }) {
  return openPrintableReport({
    headers: ATTENDANCE_DETAIL_HEADERS,
    metrics: [
      ['Total', summary.total || 0],
      ['Present', summary.present || 0],
      ['Late', summary.late || 0],
      ['Absent', summary.absent || 0],
      ['Attendance', `${summary.percentage || 0}%`],
    ],
    rows: rows.map(toAttendanceDetailCells),
    subtitle,
    title,
  });
}

function SummaryCard({ label, value }) {
  return (
    <div className="rounded-lg bg-[#f5f5f6] p-4">
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-extrabold text-slate-900">{value}</div>
    </div>
  );
}

function EmptyReport({ message }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 bg-white p-8 text-center text-sm font-semibold text-slate-500">
      {message}
    </div>
  );
}

function StudentReportsPanel({ academicYear, admissions = [], documents = [], promotions = [], students = [] }) {
  const activeStudents = students.filter((student) => student.status !== 'Archived');
  const archivedStudents = students.filter((student) => student.status === 'Archived');
  const pendingStudents = students.filter((student) => ['Pending Approval', 'Admission Review'].includes(student.status));
  const approvedStudents = students.filter((student) => ['Active', 'Approved', 'Admitted'].includes(student.status));
  const pendingDocuments = documents.filter((item) => item.verificationStatus === 'Pending Review');
  const classBreakdown = Object.entries(students.reduce((summary, student) => {
    const classKey = `${student.className || 'Unassigned'} - ${student.section || '-'}`;
    summary[classKey] = (summary[classKey] || 0) + 1;
    return summary;
  }, {}));

  const downloadReport = () => {
    downloadCsv(`student-report-${academicYear}.csv`, [
      ['Student Name', 'Student ID', 'Admission No', 'Class', 'Program', 'Guardian', 'ID Holder', 'Status', 'Created On'],
      ...students.map((student) => [
        student.name,
        student.studentId,
        student.admissionNo,
        `${student.className || ''} ${student.section || ''}`.trim(),
        student.program,
        student.guardianName,
        student.idHolder,
        student.status,
        student.createdAtText,
      ]),
    ]);
    toast.success('Student report downloaded');
  };

  return (
    <div>
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Student Reports</h2>
          <p className="text-sm text-slate-500 mt-1">Admissions, approval queue, documents, and student status for {academicYear}.</p>
        </div>
        <button onClick={downloadReport} className="h-10 px-5 rounded-lg bg-[#33373e] text-white font-semibold text-sm flex items-center justify-center gap-2">
          <Download size={16} /> Download CSV
        </button>
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-4 mb-5">
        <SummaryCard label="Students" value={students.length} />
        <SummaryCard label="Active" value={activeStudents.length} />
        <SummaryCard label="Pending Approval" value={pendingStudents.length} />
        <SummaryCard label="Approved" value={approvedStudents.length} />
        <SummaryCard label="Archived" value={archivedStudents.length} />
      </div>

      <div className="grid xl:grid-cols-[.75fr_1.25fr] gap-5">
        <section className="rounded-lg border border-slate-100 bg-white p-5 shadow-sm">
          <h3 className="font-bold text-slate-900 mb-4">Report Categories</h3>
          <div className="space-y-2 text-sm">
            {[
              ['Admissions', admissions.length],
              ['Documents', documents.length],
              ['Pending Documents', pendingDocuments.length],
              ['Promotions', promotions.length],
              ['Classes', classBreakdown.length],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between rounded-lg bg-[#f5f5f6] px-3 py-2">
                <span>{label}</span>
                <b>{value}</b>
              </div>
            ))}
          </div>
        </section>

        <section className="overflow-x-auto rounded-lg border border-slate-100 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-[#e7e7e9] text-left text-slate-900">
              <tr>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Admission / ID</th>
                <th className="px-4 py-3">Class</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-semibold">{student.name}<div className="text-xs font-normal text-slate-500">{student.guardianName}</div></td>
                  <td className="px-4 py-3">{student.admissionNo}<div className="text-xs text-slate-500">{student.studentId}</div></td>
                  <td className="px-4 py-3">{student.className} - {student.section}<div className="text-xs text-slate-500">{student.program}</div></td>
                  <td className="px-4 py-3"><StatusBadge value={student.status} /></td>
                </tr>
              ))}
              {!students.length && (
                <tr><td colSpan="4" className="px-4 py-10 text-center text-slate-500">No student records found for {academicYear}.</td></tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}

function AttendanceReportsPanel({ academicYear = '', records = [], selectedCourse = null, selectedCourseCode = 'all' }) {
  const [selectedDateState, setSelectedDateState] = useState({ contextKey: '', value: '' });
  const [exportRangeState, setExportRangeState] = useState({ contextKey: '', from: '', to: '' });
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const selectedCourseLabel = selectedCourseCode === 'all'
    ? 'All Courses'
    : selectedCourse?.courseName || selectedCourse?.name || selectedCourseCode || 'Selected Course';
  const dateContextKey = `${academicYear || 'all-years'}|${selectedCourseCode || 'all-courses'}`;
  const selectedDate = selectedDateState.contextKey === dateContextKey ? selectedDateState.value : '';
  const availableDates = useMemo(() => getAvailableAttendanceDates(records), [records]);
  const latestDate = availableDates[availableDates.length - 1] || '';
  const effectiveSelectedDate = selectedDate || latestDate;
  const selectedDayLabel = getAttendanceDayLabel(effectiveSelectedDate);
  const exportRange = exportRangeState.contextKey === dateContextKey
    ? exportRangeState
    : { contextKey: dateContextKey, from: '', to: '' };
  // The range defaults to every marked date so the subject, student and consolidated
  // reports open on a full term rather than collapsing to the single selected day.
  const exportFromDate = exportRange.from || availableDates[0] || effectiveSelectedDate;
  const exportToDate = exportRange.to || latestDate || exportFromDate;
  const exportRangeLabel = getAttendanceRangeLabel(exportFromDate, exportToDate);

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const recordDateInput = getAttendanceDateInput(record);
      if (!effectiveSelectedDate || recordDateInput !== effectiveSelectedDate) return false;
      return recordMatchesAttendanceFilters(record, statusFilter, search);
    });
  }, [effectiveSelectedDate, records, search, statusFilter]);
  const attendanceRows = useMemo(() => filteredRecords
    .map(buildAttendanceDetailRow)
    .sort(sortAttendanceDetailRows), [filteredRecords]);
  const exportRecords = useMemo(() => {
    return records.filter((record) => {
      const recordDateInput = getAttendanceDateInput(record);
      if (!exportFromDate || !exportToDate || !recordDateInput) return false;
      if (recordDateInput < exportFromDate || recordDateInput > exportToDate) return false;
      return recordMatchesAttendanceFilters(record, statusFilter, search);
    });
  }, [exportFromDate, exportToDate, records, search, statusFilter]);
  const exportRows = useMemo(() => exportRecords
    .map(buildAttendanceDetailRow)
    .sort(sortAttendanceDetailRows), [exportRecords]);
  const detailSummary = summarizeAttendance(filteredRecords);
  const exportSummary = summarizeAttendance(exportRecords);
  const exportSubtitle = `${selectedCourseLabel} - ${academicYear || 'All academic years'} - ${selectedDayLabel}`;
  const exportRangeSubtitle = `${selectedCourseLabel} - ${academicYear || 'All academic years'} - ${exportRangeLabel}`;
  const updateExportRange = (updates) => {
    setExportRangeState((current) => ({
      ...(current.contextKey === dateContextKey ? current : { contextKey: dateContextKey, from: '', to: '' }),
      ...updates,
      contextKey: dateContextKey,
    }));
  };

  const downloadDayAttendanceCsv = () => {
    if (!attendanceRows.length) {
      toast.error(`No attendance was marked on ${selectedDayLabel}.`);
      return;
    }
    downloadCsv(
      `attendance-report-${sanitizeFilenamePart(selectedCourseLabel)}-${sanitizeFilenamePart(effectiveSelectedDate || 'no-date')}.csv`,
      [
        ['Attendance Report'],
        ['Course', selectedCourseLabel],
        ['Academic Year', academicYear || 'All academic years'],
        ['Attendance Date', selectedDayLabel],
        ['Total', detailSummary.total, 'Present', detailSummary.present, 'Late', detailSummary.late, 'Absent', detailSummary.absent, 'Attendance %', detailSummary.percentage],
        [],
        ATTENDANCE_DETAIL_HEADERS,
        ...attendanceRows.map(toAttendanceDetailCells),
      ]
    );
    toast.success('Attendance CSV downloaded');
  };

  const downloadDayAttendancePdf = () => {
    if (!attendanceRows.length) {
      toast.error(`No attendance was marked on ${selectedDayLabel}.`);
      return;
    }
    const opened = openAttendancePdf({
      rows: attendanceRows,
      summary: detailSummary,
      subtitle: exportSubtitle,
    });
    if (opened) toast.success('PDF report opened');
    else toast.error('Allow popups to export PDF.');
  };

  const downloadRangeAttendanceCsv = () => {
    if (!exportRows.length) {
      toast.error(`No attendance was marked in ${exportRangeLabel}.`);
      return;
    }
    downloadCsv(
      `attendance-range-${sanitizeFilenamePart(selectedCourseLabel)}-${sanitizeFilenamePart(exportFromDate || 'no-from')}-${sanitizeFilenamePart(exportToDate || 'no-to')}.csv`,
      [
        ['Attendance Report'],
        ['Course', selectedCourseLabel],
        ['Academic Year', academicYear || 'All academic years'],
        ['Report Range', exportRangeLabel],
        ['Total', exportSummary.total, 'Present', exportSummary.present, 'Late', exportSummary.late, 'Absent', exportSummary.absent, 'Attendance %', exportSummary.percentage],
        [],
        ATTENDANCE_DETAIL_HEADERS,
        ...exportRows.map(toAttendanceDetailCells),
      ]
    );
    toast.success('Attendance range CSV downloaded');
  };

  const downloadRangeAttendancePdf = () => {
    if (!exportRows.length) {
      toast.error(`No attendance was marked in ${exportRangeLabel}.`);
      return;
    }
    const opened = openAttendancePdf({
      rows: exportRows,
      summary: exportSummary,
      subtitle: exportRangeSubtitle,
      title: 'Attendance Range Report',
    });
    if (opened) toast.success('PDF range report opened');
    else toast.error('Allow popups to export PDF.');
  };

  return (
    <div>
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Attendance Reports</h2>
          <p className="text-sm text-slate-500 mt-1">
            {selectedCourseLabel} day view for {selectedDayLabel}. Analytical reports below run over {exportRangeLabel}.
          </p>
        </div>
      </div>

      <section className="mb-5 rounded-lg border border-slate-100 bg-white p-4 shadow-sm">
        <div className="grid md:grid-cols-2 xl:grid-cols-[1.1fr_1fr_2fr_auto] gap-3">
          <label className="text-xs font-semibold text-slate-500">
            Attendance Date
            <span className="relative mt-1 block">
              <CalendarDays size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="date"
                value={effectiveSelectedDate}
                min={availableDates[0] || undefined}
                max={latestDate || undefined}
                onChange={(event) => setSelectedDateState({ contextKey: dateContextKey, value: event.target.value })}
                className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-900"
              />
            </span>
          </label>
          <label className="text-xs font-semibold text-slate-500">
            Status
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="mt-1 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900"
            >
              <option value="all">All Statuses</option>
              {ATTENDANCE_STATUSES.map((status) => (
                <option key={status} value={status.toLowerCase()}>{status}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-500">
            Search
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Student, subject, topic..."
              className="mt-1 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900"
            />
          </label>
          <div className="flex flex-col gap-2 md:flex-row xl:flex-col xl:justify-end">
            <button
              type="button"
              onClick={downloadDayAttendanceCsv}
              className="h-11 rounded-lg bg-[#33373e] px-4 text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Download size={16} /> Day CSV
            </button>
            <button
              type="button"
              onClick={downloadDayAttendancePdf}
              className="h-11 rounded-lg bg-[#33373e] px-4 text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <FileText size={16} /> Day PDF
            </button>
          </div>
        </div>
      </section>

      <section className="mb-5 rounded-lg border border-slate-100 bg-white p-4 shadow-sm">
        <div className="grid md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_auto] gap-3">
          <div className="rounded-lg bg-[#f5f5f6] px-4 py-3">
            <div className="text-xs font-semibold text-slate-500">Report Range</div>
            <div className="mt-1 text-sm font-extrabold text-slate-900">{exportRangeLabel}</div>
            <div className="mt-1 text-xs font-semibold text-slate-500">{exportRows.length} row{exportRows.length === 1 ? '' : 's'}</div>
          </div>
          <label className="text-xs font-semibold text-slate-500">
            Report From
            <span className="relative mt-1 block">
              <CalendarDays size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="date"
                value={exportFromDate}
                min={availableDates[0] || undefined}
                max={latestDate || undefined}
                onChange={(event) => {
                  const nextFromDate = event.target.value;
                  updateExportRange({
                    from: nextFromDate,
                    to: exportToDate && nextFromDate && exportToDate < nextFromDate ? nextFromDate : exportToDate,
                  });
                }}
                className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-900"
              />
            </span>
          </label>
          <label className="text-xs font-semibold text-slate-500">
            Report To
            <span className="relative mt-1 block">
              <CalendarDays size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="date"
                value={exportToDate}
                min={availableDates[0] || undefined}
                max={latestDate || undefined}
                onChange={(event) => {
                  const nextToDate = event.target.value;
                  updateExportRange({
                    from: exportFromDate && nextToDate && exportFromDate > nextToDate ? nextToDate : exportFromDate,
                    to: nextToDate,
                  });
                }}
                className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-900"
              />
            </span>
          </label>
          <div className="flex flex-col gap-2 md:flex-row xl:flex-col xl:justify-end">
            <button
              type="button"
              onClick={downloadRangeAttendanceCsv}
              className="h-11 rounded-lg bg-[#33373e] px-4 text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Download size={16} /> Range CSV
            </button>
            <button
              type="button"
              onClick={downloadRangeAttendancePdf}
              className="h-11 rounded-lg bg-[#33373e] px-4 text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <FileText size={16} /> Range PDF
            </button>
          </div>
        </div>
      </section>

      <div className="grid sm:grid-cols-2 xl:grid-cols-6 gap-4 mb-5">
        <SummaryCard label="Date" value={selectedDayLabel} />
        <SummaryCard label="Rows" value={detailSummary.total} />
        <SummaryCard label="Present" value={detailSummary.present} />
        <SummaryCard label="Late" value={detailSummary.late} />
        <SummaryCard label="Absent" value={detailSummary.absent} />
        <SummaryCard label="Attendance %" value={`${detailSummary.percentage}%`} />
      </div>

      <section className="mb-5 overflow-x-auto rounded-lg border border-slate-100 bg-white shadow-sm">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="bg-[#e7e7e9] text-left text-slate-900">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Student</th>
              <th className="px-4 py-3">Semester / Class</th>
              <th className="px-4 py-3">Subject</th>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Topic</th>
              <th className="px-4 py-3">Faculty</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {attendanceRows.map((row) => (
              <tr key={row.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-semibold">{row.date}</td>
                <td className="px-4 py-3 font-semibold">
                  {row.studentName}
                  <div className="text-xs font-normal text-slate-500">{row.studentId}</div>
                </td>
                <td className="px-4 py-3">{row.classLabel}</td>
                <td className="px-4 py-3">{row.subject}</td>
                <td className="px-4 py-3">{row.time}</td>
                <td className="px-4 py-3">{row.topic}</td>
                <td className="px-4 py-3">{row.faculty}</td>
                <td className="px-4 py-3"><StatusBadge value={row.status} /></td>
              </tr>
            ))}
            {!attendanceRows.length && (
              <tr>
                <td colSpan="8" className="px-4 py-10 text-center text-slate-500">
                  No attendance rows match the selected course and attendance date.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {exportRecords.length ? (
        <AttendanceReports
          academicYear={academicYear}
          courseLabel={selectedCourseLabel}
          rangeLabel={exportRangeLabel}
          records={exportRecords}
        />
      ) : (
        <EmptyReport message="No attendance report records are available for the selected report range." />
      )}
    </div>
  );
}

function DocumentReportsPanel({ documents = [] }) {
  const byStatus = Object.entries(documents.reduce((summary, document) => {
    const status = document.verificationStatus || 'Pending Review';
    summary[status] = (summary[status] || 0) + 1;
    return summary;
  }, {}));
  const byCategory = Object.entries(documents.reduce((summary, document) => {
    const category = document.category || document.documentType || 'Uncategorized';
    summary[category] = (summary[category] || 0) + 1;
    return summary;
  }, {}));

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-900">Document Reports</h2>
      <p className="text-sm text-slate-500 mt-1 mb-5">Verification and category reports for student documents.</p>
      <div className="grid sm:grid-cols-3 gap-4 mb-5">
        <SummaryCard label="Documents" value={documents.length} />
        <SummaryCard label="Verified" value={documents.filter((item) => ['Verified', 'Source PDF'].includes(item.verificationStatus)).length} />
        <SummaryCard label="Pending Review" value={documents.filter((item) => item.verificationStatus === 'Pending Review').length} />
      </div>
      <div className="grid lg:grid-cols-2 gap-5">
        {[['By Status', byStatus], ['By Category', byCategory]].map(([title, rows]) => (
          <section key={title} className="rounded-lg border border-slate-100 bg-white p-5 shadow-sm">
            <h3 className="font-bold text-slate-900 mb-4">{title}</h3>
            <div className="space-y-2 text-sm">
              {rows.map(([label, value]) => (
                <div key={label} className="flex items-center justify-between rounded-lg bg-[#f5f5f6] px-3 py-2">
                  <span>{label}</span>
                  <b>{value}</b>
                </div>
              ))}
              {!rows.length && <div className="text-slate-500">No document records available.</div>}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function ExamReportsPanel({ marksEntries = [], studentResults = [] }) {
  const rows = [
    ...marksEntries.map((item) => ({ ...item, reportType: 'Marks Entry', label: item.examName || item.subject || 'Marks Entry' })),
    ...studentResults.map((item) => ({ ...item, reportType: 'Student Result', label: item.examName || item.subject || 'Student Result' })),
  ];
  const subjectRows = Object.entries(rows.reduce((summary, row) => {
    const subject = row.subject || row.subjectName || row.examName || 'General';
    summary[subject] = (summary[subject] || 0) + 1;
    return summary;
  }, {}));

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-900">Exam Reports</h2>
      <p className="text-sm text-slate-500 mt-1 mb-5">Marks entries, generated results, and report-card readiness.</p>
      <div className="grid sm:grid-cols-3 gap-4 mb-5">
        <SummaryCard label="Marks Entries" value={marksEntries.length} />
        <SummaryCard label="Student Results" value={studentResults.length} />
        <SummaryCard label="Subjects / Exams" value={subjectRows.length} />
      </div>
      <section className="overflow-x-auto rounded-lg border border-slate-100 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-[#e7e7e9] text-left text-slate-900">
            <tr>
              <th className="px-4 py-3">Report</th>
              <th className="px-4 py-3">Student</th>
              <th className="px-4 py-3">Subject / Exam</th>
              <th className="px-4 py-3">Score</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id || `${row.reportType}-${index}`} className="border-t border-slate-100">
                <td className="px-4 py-3 font-semibold">{row.reportType}</td>
                <td className="px-4 py-3">{row.studentName || row.name || row.studentId || '-'}</td>
                <td className="px-4 py-3">{row.label}</td>
                <td className="px-4 py-3">{row.percentage ? `${row.percentage}%` : row.grade || row.status || '-'}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan="4" className="px-4 py-10 text-center text-slate-500">No exam report records available.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

export default function ReportsManagement({
  academicYear = '',
  admissions = [],
  attendanceRecords = [],
  currentUser,
  documents = [],
  initialCategoryId = '',
  marksEntries = [],
  promotions = [],
  scopedStudents = [],
  selectedCourse = null,
  selectedCourseCode = 'all',
  studentResults = [],
}) {
  const navigate = useNavigate();
  const currentRoleId = currentUser?.roleId || 'admin';
  const categories = useMemo(() => [
    {
      id: 'attendance',
      label: 'Attendance',
      description: 'Daily, monthly, yearly',
      icon: <ClipboardList size={18} />,
      enabled: canAccess(defaultRoles, currentRoleId, 'attendance.reports'),
      content: (
        <AttendanceReportsPanel
          academicYear={academicYear}
          records={attendanceRecords}
          selectedCourse={selectedCourse}
          selectedCourseCode={selectedCourseCode}
        />
      ),
    },
    {
      id: 'documents',
      label: 'Documents',
      description: 'Verification reports',
      icon: <FileText size={18} />,
      enabled: canAccess(defaultRoles, currentRoleId, 'documents.view') || canAccess(defaultRoles, currentRoleId, 'students.documents'),
      content: <DocumentReportsPanel documents={documents} />,
    },
    {
      id: 'exams',
      label: 'Exams',
      description: 'Marks and results',
      icon: <BookOpen size={18} />,
      enabled: canAccess(defaultRoles, currentRoleId, 'exams.view') || canAccess(defaultRoles, currentRoleId, 'exams.results'),
      content: <ExamReportsPanel marksEntries={marksEntries} studentResults={studentResults} />,
    },
    {
      id: 'financial',
      label: 'Financial',
      description: 'Collections and dues',
      icon: <BarChart3 size={18} />,
      enabled: canAccessFinancialReports(defaultRoles, currentRoleId),
      content: (
        <FinancialReports
          academicYear={academicYear}
          currentUser={currentUser}
          scopedStudents={scopedStudents}
          selectedCourse={selectedCourse}
          selectedCourseCode={selectedCourseCode}
        />
      ),
    },
    {
      id: 'students',
      label: 'Student',
      description: 'Admissions and approval queue',
      icon: <GraduationCap size={18} />,
      enabled: canAccess(defaultRoles, currentRoleId, 'students.view'),
      content: <StudentReportsPanel academicYear={academicYear} admissions={admissions} documents={documents} promotions={promotions} students={scopedStudents} />,
    },
  ], [academicYear, admissions, attendanceRecords, currentRoleId, currentUser, documents, marksEntries, promotions, scopedStudents, selectedCourse, selectedCourseCode, studentResults]);
  const visibleCategories = categories.filter((category) => category.enabled);
  const activeCategory = visibleCategories.find((category) => category.id === initialCategoryId) || visibleCategories[0];
  const openCategory = (categoryId) => {
    if (categoryId === activeCategory?.id) return;
    navigate('/modules/reports', { state: { reportCategory: categoryId } });
  };

  if (!visibleCategories.length) {
    return (
      <div className="rounded-lg bg-[#f5f5f6] p-6 text-sm text-slate-600">
        You do not have permission to view reports.
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <div className="text-sm font-bold text-slate-500 mb-2">ERP / <span className="text-[#f39a5f]">Reports</span></div>
          <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
          <p className="text-sm text-slate-500 mt-1">Category-wise reports for the modules available to your role.</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-3 py-5">
        {visibleCategories.map((category) => {
          const active = activeCategory?.id === category.id;
          return (
            <button
              key={category.id}
              type="button"
              onClick={() => openCategory(category.id)}
              aria-pressed={active}
              className={`erp-report-category-card min-h-28 rounded-lg border p-4 text-left transition-colors ${
                active
                  ? 'is-active border-emerald-300 bg-emerald-50'
                  : 'border-slate-100 bg-white hover:border-emerald-200'
              }`}
            >
              <span className="flex items-start justify-between gap-3">
                <span className="erp-report-category-icon h-10 w-10 rounded-lg bg-[#f5f5f6] text-[#34363d] flex items-center justify-center">{category.icon}</span>
                <span className="erp-report-category-pill rounded-full bg-[#f5f5f6] px-3 py-1 text-[11px] font-bold text-slate-600">{active ? 'Open' : 'View'}</span>
              </span>
              <span className="mt-4 block text-sm font-bold text-slate-900">{category.label}</span>
              <span className="mt-1 block text-xs text-slate-500">{category.description}</span>
            </button>
          );
        })}
      </div>

      <section className="min-w-0 pt-5">
        {activeCategory?.content}
      </section>
    </div>
  );
}
