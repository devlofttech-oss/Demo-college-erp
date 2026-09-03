import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Download, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  buildAttendanceGroupRows,
  buildConsolidatedRows,
  buildDailySummaryRows,
  buildStudentAttendanceRows,
  buildSubjectFacultyRows,
  getAttendancePeriodLabel,
  getAttendanceReportDateText,
  getAttendanceSubjectLabel,
  summarizeAttendance,
} from '../attendanceUtils';
import { downloadCsv, openPrintableReport, sanitizeFilenamePart } from '../../shared/reportExport';

const REPORT_TABS = [
  { id: 'daily', label: 'Daily Summary', hint: 'Period or class wise present, late and absent counts' },
  { id: 'subject', label: 'Subject Wise', hint: 'Attendance per subject and faculty' },
  { id: 'student', label: 'Individual Student', hint: 'Per student totals with subject breakdown' },
  { id: 'consolidated', label: 'Consolidated', hint: 'Monthly or semester aggregate for management review' },
];

const COUNT_HEADERS = ['Present', 'Late', 'Absent', 'Leave', 'Total', 'Present %', 'Attended %'];

function countCells(row) {
  return [row.present, row.late, row.absent, row.leave, row.total, `${row.percentage}%`, `${row.attendedPercentage}%`];
}

function ToggleGroup({ ariaLabel, onChange, options, value }) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={ariaLabel}>
      {options.map(([optionValue, optionLabel]) => (
        <button
          key={optionValue}
          type="button"
          onClick={() => onChange(optionValue)}
          className={`h-9 px-3 rounded-md border text-xs font-bold ${value === optionValue ? 'bg-[#33373e] text-white border-[#33373e]' : 'bg-white text-slate-600 border-slate-200'}`}
        >
          {optionLabel}
        </button>
      ))}
    </div>
  );
}

function CountBar({ row }) {
  const total = row.total || 1;
  const segments = [
    ['#10b981', row.present],
    ['#f59e0b', row.late],
    ['#f43f5e', row.absent],
    ['#94a3b8', row.leave],
  ];
  return (
    <div className="mt-2 flex h-2 w-full overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
      {segments.map(([color, count]) => (
        count ? <span key={color} style={{ background: color, width: `${(count / total) * 100}%` }} /> : null
      ))}
    </div>
  );
}

function ReportSection({ children, controls, onExportCsv, onExportPdf, subtitle, title }) {
  return (
    <section className="rounded-lg border border-slate-100 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h3 className="font-bold text-slate-900">{title}</h3>
          <p className="mt-1 text-xs font-semibold text-slate-500">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {controls}
          <button
            type="button"
            onClick={onExportCsv}
            className="h-9 rounded-md bg-[#33373e] px-3 text-xs font-bold text-white flex items-center gap-2"
          >
            <Download size={14} /> CSV
          </button>
          <button
            type="button"
            onClick={onExportPdf}
            className="h-9 rounded-md bg-[#33373e] px-3 text-xs font-bold text-white flex items-center gap-2"
          >
            <FileText size={14} /> PDF
          </button>
        </div>
      </div>
      {children}
    </section>
  );
}

function ReportTable({ emptyMessage, headers, children }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-100">
      <table className="w-full min-w-[880px] text-sm">
        <thead className="bg-[#e7e7e9] text-left text-slate-900">
          <tr>{headers.map((header) => <th key={header} className="px-4 py-3 font-semibold">{header}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
      {emptyMessage && (
        <div className="px-4 py-10 text-center text-sm font-semibold text-slate-500">{emptyMessage}</div>
      )}
    </div>
  );
}

function CountCells({ row }) {
  return (
    <>
      <td className="px-4 py-3 font-semibold text-emerald-700">{row.present}</td>
      <td className="px-4 py-3 font-semibold text-amber-600">{row.late}</td>
      <td className="px-4 py-3 font-semibold text-rose-600">{row.absent}</td>
      <td className="px-4 py-3">{row.leave}</td>
      <td className="px-4 py-3">{row.total}</td>
      <td className="px-4 py-3 font-bold">{row.percentage}%</td>
      <td className="px-4 py-3 font-bold">{row.attendedPercentage}%</td>
    </>
  );
}

function useReportExport({ academicYear, courseLabel, rangeLabel }) {
  return useMemo(() => {
    const subtitle = `${courseLabel} - ${academicYear || 'All academic years'} - ${rangeLabel}`;
    return {
      exportCsv: ({ filenamePrefix, headers, rows, summary, title }) => {
        if (!rows.length) {
          toast.error('No rows to export for this report.');
          return;
        }
        downloadCsv(`${filenamePrefix}-${sanitizeFilenamePart(courseLabel)}-${sanitizeFilenamePart(rangeLabel)}.csv`, [
          [title],
          ['Course', courseLabel],
          ['Academic Year', academicYear || 'All academic years'],
          ['Range', rangeLabel],
          [
            'Total', summary.total,
            'Present', summary.present,
            'Late', summary.late,
            'Absent', summary.absent,
            'Leave', summary.leave,
            'Present %', summary.percentage,
            'Attended %', summary.attendedPercentage,
          ],
          [],
          headers,
          ...rows,
        ]);
        toast.success(`${title} CSV downloaded`);
      },
      exportPdf: ({ headers, rows, summary, title }) => {
        if (!rows.length) {
          toast.error('No rows to export for this report.');
          return;
        }
        const opened = openPrintableReport({
          headers,
          metrics: [
            ['Present', summary.present],
            ['Late', summary.late],
            ['Absent', summary.absent],
            ['Total', summary.total],
            ['Attended %', `${summary.attendedPercentage}%`],
          ],
          rows,
          subtitle,
          title,
        });
        if (opened) toast.success(`${title} PDF opened`);
        else toast.error('Allow popups to export PDF.');
      },
    };
  }, [academicYear, courseLabel, rangeLabel]);
}

function DailySummaryReport({ exporter, records }) {
  const [groupBy, setGroupBy] = useState('class');
  const rows = useMemo(() => buildDailySummaryRows(records, groupBy), [groupBy, records]);
  const summary = useMemo(() => summarizeAttendance(records), [records]);
  const groupHeader = groupBy === 'period' ? 'Period' : 'Class / Section';
  const headers = ['Date', groupHeader, 'Subjects', ...COUNT_HEADERS];
  const exportRows = rows.map((row) => [row.dateText, row.groupLabel, row.subjects.join('; '), ...countCells(row)]);
  const title = groupBy === 'period' ? 'Period Wise Daily Attendance Summary' : 'Class Wise Daily Attendance Summary';

  return (
    <ReportSection
      title={title}
      subtitle={`${rows.length} summary row${rows.length === 1 ? '' : 's'} across the selected range.`}
      controls={(
        <ToggleGroup
          ariaLabel="Daily summary grouping"
          value={groupBy}
          onChange={setGroupBy}
          options={[['class', 'By Class / Section'], ['period', 'By Period']]}
        />
      )}
      onExportCsv={() => exporter.exportCsv({ filenamePrefix: 'attendance-daily-summary', headers, rows: exportRows, summary, title })}
      onExportPdf={() => exporter.exportPdf({ headers, rows: exportRows, summary, title })}
    >
      <ReportTable headers={headers} emptyMessage={rows.length ? '' : 'No attendance was marked in this range.'}>
        {rows.map((row) => (
          <tr key={row.label} className="border-t border-slate-100">
            <td className="px-4 py-3 font-semibold text-slate-900">{row.dateText}</td>
            <td className="px-4 py-3 font-semibold">
              {row.groupLabel}
              <CountBar row={row} />
            </td>
            <td className="px-4 py-3 text-xs text-slate-500">{row.subjects.join(', ')}</td>
            <CountCells row={row} />
          </tr>
        ))}
      </ReportTable>
    </ReportSection>
  );
}

function SubjectReport({ exporter, records }) {
  const [groupBy, setGroupBy] = useState('faculty');
  const rows = useMemo(() => {
    if (groupBy === 'faculty') return buildSubjectFacultyRows(records);
    if (groupBy === 'period') {
      return buildAttendanceGroupRows(records, {
        getKey: (record) => `${getAttendanceSubjectLabel(record)}||${getAttendancePeriodLabel(record)}`,
        getMeta: (items, key) => {
          const [subject, period] = key.split('||');
          return {
            subject,
            secondary: period,
            label: `${subject} - ${period}`,
            sessions: new Set(items.map((item) => item.sessionId || getAttendanceReportDateText(item))).size,
          };
        },
      });
    }
    return buildAttendanceGroupRows(records, {
      getKey: getAttendanceSubjectLabel,
      getMeta: (items, key) => ({
        subject: key,
        secondary: [...new Set(items.map((item) => item.facultyName).filter(Boolean))].join(', ') || '-',
        sessions: new Set(items.map((item) => item.sessionId || `${getAttendanceReportDateText(item)}|${getAttendancePeriodLabel(item)}`)).size,
      }),
    });
  }, [groupBy, records]);
  const summary = useMemo(() => summarizeAttendance(records), [records]);
  const secondHeader = groupBy === 'period' ? 'Period' : 'Faculty';
  const headers = ['Subject', secondHeader, 'Sessions', ...COUNT_HEADERS];
  const exportRows = rows.map((row) => [row.subject, row.secondary ?? row.faculty, row.sessions, ...countCells(row)]);
  const title = 'Subject Wise Attendance Report';

  return (
    <ReportSection
      title={title}
      subtitle={`${rows.length} subject row${rows.length === 1 ? '' : 's'} across the selected range.`}
      controls={(
        <ToggleGroup
          ariaLabel="Subject report grouping"
          value={groupBy}
          onChange={setGroupBy}
          options={[['faculty', 'Subject + Faculty'], ['period', 'Subject + Period'], ['subject', 'Subject Only']]}
        />
      )}
      onExportCsv={() => exporter.exportCsv({ filenamePrefix: 'attendance-subject-report', headers, rows: exportRows, summary, title })}
      onExportPdf={() => exporter.exportPdf({ headers, rows: exportRows, summary, title })}
    >
      <ReportTable headers={headers} emptyMessage={rows.length ? '' : 'No subject attendance was marked in this range.'}>
        {rows.map((row) => (
          <tr key={row.label} className="border-t border-slate-100">
            <td className="px-4 py-3 font-semibold text-slate-900">
              {row.subject}
              <CountBar row={row} />
            </td>
            <td className="px-4 py-3">{row.secondary ?? row.faculty}</td>
            <td className="px-4 py-3">{row.sessions}</td>
            <CountCells row={row} />
          </tr>
        ))}
      </ReportTable>
    </ReportSection>
  );
}

function StudentReport({ exporter, records }) {
  const [expandedKey, setExpandedKey] = useState('');
  const [studentFilter, setStudentFilter] = useState('all');
  const allRows = useMemo(() => buildStudentAttendanceRows(records), [records]);
  const rows = studentFilter === 'shortfall' ? allRows.filter((row) => row.attendedPercentage < 75) : allRows;
  const summary = useMemo(() => summarizeAttendance(records), [records]);
  const headers = ['Student', 'Student ID', 'Class / Section', 'Department', 'Subjects', ...COUNT_HEADERS];
  const exportRows = rows.map((row) => [
    row.label,
    row.studentId,
    row.classLabel,
    row.department,
    row.subjects.join('; '),
    ...countCells(row),
  ]);
  const title = 'Individual Student Attendance Report';

  return (
    <ReportSection
      title={title}
      subtitle={`${rows.length} student${rows.length === 1 ? '' : 's'}, lowest attendance first. Select a row for its subject breakdown.`}
      controls={(
        <ToggleGroup
          ariaLabel="Student attendance filter"
          value={studentFilter}
          onChange={setStudentFilter}
          options={[['all', 'All Students'], ['shortfall', 'Below 75%']]}
        />
      )}
      onExportCsv={() => exporter.exportCsv({ filenamePrefix: 'attendance-student-report', headers, rows: exportRows, summary, title })}
      onExportPdf={() => exporter.exportPdf({ headers, rows: exportRows, summary, title })}
    >
      <ReportTable
        headers={['Student', 'Class / Section', ...COUNT_HEADERS]}
        emptyMessage={rows.length ? '' : 'No students match this attendance range.'}
      >
        {rows.map((row) => {
          const rowKey = `${row.label}-${row.studentId}`;
          const expanded = expandedKey === rowKey;
          const subjectRows = expanded
            ? buildAttendanceGroupRows(row.records, { getKey: getAttendanceSubjectLabel })
            : [];
          return [
            <tr
              key={rowKey}
              className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
              onClick={() => setExpandedKey(expanded ? '' : rowKey)}
            >
              <td className="px-4 py-3 font-semibold text-slate-900">
                <span className="flex items-center gap-2">
                  {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  {row.label}
                </span>
                <span className="block pl-6 text-xs font-normal text-slate-500">{row.studentId || 'No student ID'}</span>
              </td>
              <td className="px-4 py-3">
                {row.classLabel}
                <CountBar row={row} />
              </td>
              <CountCells row={row} />
            </tr>,
            expanded ? (
              <tr key={`${rowKey}-detail`} className="border-t border-slate-100 bg-[#f9fafb]">
                <td colSpan={9} className="px-4 py-3">
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {subjectRows.map((subjectRow) => (
                      <div key={subjectRow.label} className="rounded-lg bg-white p-3 text-xs shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-bold text-slate-900">{subjectRow.label}</span>
                          <span className="font-bold">{subjectRow.percentage}%</span>
                        </div>
                        <CountBar row={subjectRow} />
                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-slate-500">
                          <span>Present {subjectRow.present}</span>
                          <span>Late {subjectRow.late}</span>
                          <span>Absent {subjectRow.absent}</span>
                          <span>Total {subjectRow.total}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </td>
              </tr>
            ) : null,
          ];
        })}
      </ReportTable>
    </ReportSection>
  );
}

function ConsolidatedReport({ exporter, records }) {
  const [period, setPeriod] = useState('monthly');
  const [dimension, setDimension] = useState('department');
  const rows = useMemo(() => buildConsolidatedRows(records, { dimension, period }), [dimension, period, records]);
  const summary = useMemo(() => summarizeAttendance(records), [records]);
  const dimensionHeader = { class: 'Class / Section', department: 'Department', semester: 'Semester', subject: 'Subject' }[dimension];
  const periodHeader = period === 'yearly' ? 'Year' : 'Month';
  const headers = [periodHeader, dimensionHeader, 'Students', ...COUNT_HEADERS];
  const exportRows = rows.map((row) => [row.periodLabel, row.dimensionLabel, row.students, ...countCells(row)]);
  const title = `${period === 'yearly' ? 'Yearly' : 'Monthly'} Consolidated Attendance Report`;

  return (
    <ReportSection
      title={title}
      subtitle={`${dimensionHeader} aggregate for management review.`}
      controls={(
        <div className="flex flex-wrap gap-2">
          <ToggleGroup
            ariaLabel="Consolidation period"
            value={period}
            onChange={setPeriod}
            options={[['monthly', 'Monthly'], ['yearly', 'Yearly']]}
          />
          <ToggleGroup
            ariaLabel="Consolidation dimension"
            value={dimension}
            onChange={setDimension}
            options={[['department', 'Department'], ['class', 'Class'], ['semester', 'Semester'], ['subject', 'Subject']]}
          />
        </div>
      )}
      onExportCsv={() => exporter.exportCsv({ filenamePrefix: 'attendance-consolidated', headers, rows: exportRows, summary, title })}
      onExportPdf={() => exporter.exportPdf({ headers, rows: exportRows, summary, title })}
    >
      <ReportTable headers={headers} emptyMessage={rows.length ? '' : 'No attendance was marked in this range.'}>
        {rows.map((row) => (
          <tr key={row.label} className="border-t border-slate-100">
            <td className="px-4 py-3 font-semibold text-slate-900">{row.periodLabel}</td>
            <td className="px-4 py-3 font-semibold">
              {row.dimensionLabel}
              <CountBar row={row} />
            </td>
            <td className="px-4 py-3">{row.students}</td>
            <CountCells row={row} />
          </tr>
        ))}
      </ReportTable>
    </ReportSection>
  );
}

export default function AttendanceReports({
  academicYear = '',
  courseLabel = 'All Courses',
  initialTab = 'daily',
  rangeLabel = 'Selected range',
  records = [],
}) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const exporter = useReportExport({ academicYear, courseLabel, rangeLabel });
  const activeReport = REPORT_TABS.find((tab) => tab.id === activeTab) || REPORT_TABS[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {REPORT_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            title={tab.hint}
            className={`h-10 px-4 rounded-md border text-sm font-semibold ${activeTab === tab.id ? 'bg-[#33373e] text-white border-[#33373e]' : 'bg-white text-slate-600 border-slate-200'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <p className="text-xs font-semibold text-slate-500">{activeReport.hint} - {rangeLabel}</p>

      {activeTab === 'daily' && <DailySummaryReport exporter={exporter} records={records} />}
      {activeTab === 'subject' && <SubjectReport exporter={exporter} records={records} />}
      {activeTab === 'student' && <StudentReport exporter={exporter} records={records} />}
      {activeTab === 'consolidated' && <ConsolidatedReport exporter={exporter} records={records} />}
    </div>
  );
}
